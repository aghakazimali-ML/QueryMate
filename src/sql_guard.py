"""SQL safety layer: only a single read-only SELECT may reach the database.

Defence in depth:
1. Code-fence / prose stripping of the LLM output.
2. Token scan for blocked keywords (ignores string literals and quoted identifiers).
3. sqlglot AST check: exactly one statement, a SELECT/CTE/UNION at the root, no
   data-modifying nodes anywhere in the tree.
4. Automatic `LIMIT` injection when the query has none.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import sqlglot
from sqlglot import exp
from sqlglot.errors import ParseError, TokenError
from sqlglot.tokens import TokenType

BLOCKED_KEYWORDS: frozenset[str] = frozenset(
    {
        "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "ATTACH",
        "DETACH", "PRAGMA", "MERGE", "GRANT", "REVOKE", "VACUUM", "REINDEX",
        "COPY", "CALL", "EXEC", "EXECUTE",
    }
)

# AST node types that can modify data or schema.
_FORBIDDEN_NODES: tuple[type[exp.Expression], ...] = tuple(
    getattr(exp, name)
    for name in (
        "Insert", "Update", "Delete", "Drop", "Alter", "Create", "TruncateTable", "Merge",
        "Command", "Pragma", "Attach", "Detach", "Grant", "Revoke", "Copy", "Into",
    )
    if hasattr(exp, name)
)

_ALLOWED_ROOTS: tuple[type[exp.Expression], ...] = tuple(
    getattr(exp, name) for name in ("Select", "Union", "Intersect", "Except") if hasattr(exp, name)
)

_FENCE_RE = re.compile(r"```(?:\s*(?:sql|sqlite|postgresql|postgres|mysql))?\s*\n?(.*?)```", re.IGNORECASE | re.DOTALL)
_START_RE = re.compile(r"\b(WITH|SELECT)\b", re.IGNORECASE)


class UnsafeSQLError(ValueError):
    """Raised when generated SQL is rejected.

    `retryable` is True for syntax problems the LLM can fix, and False for queries
    blocked for safety (those are never sent back for "fixing").
    """

    def __init__(self, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass(frozen=True)
class GuardResult:
    """Validated SQL ready for execution."""

    sql: str
    limit_added: bool


def extract_sql(llm_output: str) -> str:
    """Strip markdown code fences, `SQL:` prefixes and surrounding prose from LLM output."""
    text = (llm_output or "").strip()
    fenced = _FENCE_RE.findall(text)
    if fenced:
        text = max(fenced, key=len).strip()
    else:
        text = text.strip("`").strip()
        text = re.sub(r"^(sql|sqlite)\s*\n", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*(sql\s*query|query|sql)\s*:\s*", "", text, flags=re.IGNORECASE)
    # If the model wrote an explanation before the query, start at the first WITH/SELECT.
    match = _START_RE.search(text)
    if match and match.start() > 0 and not text[: match.start()].strip().endswith(("(", ",")):
        prefix = text[: match.start()]
        if not re.search(r"\b(FROM|JOIN|WHERE)\b", prefix, re.IGNORECASE):
            text = text[match.start():]
    return text.strip().rstrip(";").strip()


def _blocked_tokens(sql: str, dialect: str) -> set[str]:
    """Return blocked keywords present as SQL tokens (string literals / quoted identifiers ignored)."""
    try:
        tokens = sqlglot.tokenize(sql, read=dialect)
    except TokenError as exc:
        raise UnsafeSQLError(f"Could not read the SQL: {exc}", retryable=True) from exc
    found: set[str] = set()
    for tok in tokens:
        if tok.token_type in (TokenType.STRING, TokenType.IDENTIFIER):
            continue
        word = tok.text.upper()
        if word in BLOCKED_KEYWORDS:
            found.add(word)
    return found


def validate_sql(sql: str, dialect: str = "sqlite", max_rows: int = 500) -> GuardResult:
    """Validate that `sql` is one read-only SELECT and add `LIMIT max_rows` if missing.

    Raises:
        UnsafeSQLError: with a user-friendly message when the SQL is rejected.
    """
    sql = extract_sql(sql)
    if not sql:
        raise UnsafeSQLError("The model did not return any SQL.", retryable=True)

    blocked = _blocked_tokens(sql, dialect)
    if blocked:
        raise UnsafeSQLError(
            f"Blocked: QueryMate only runs read-only queries, and this one contains {', '.join(sorted(blocked))}."
        )

    try:
        statements = [s for s in sqlglot.parse(sql, read=dialect) if s is not None]
    except (ParseError, TokenError) as exc:
        raise UnsafeSQLError(f"The generated SQL could not be parsed: {exc}", retryable=True) from exc

    if len(statements) != 1:
        raise UnsafeSQLError("Blocked: only a single SQL statement is allowed.")
    tree = statements[0]

    for node in tree.walk():
        if isinstance(node, _FORBIDDEN_NODES):
            raise UnsafeSQLError(f"Blocked: the query contains a disallowed {node.key.upper()} operation.")
    if not isinstance(tree, _ALLOWED_ROOTS):
        # Not dangerous, just not a query (e.g. the model answered in prose): let the LLM retry.
        raise UnsafeSQLError("Only SELECT (or WITH ... SELECT) queries are allowed.", retryable=True)

    limit_added = False
    if tree.args.get("limit") is None and tree.args.get("fetch") is None:
        tree = tree.limit(max_rows, copy=True)
        limit_added = True

    return GuardResult(sql=tree.sql(dialect=dialect, pretty=True), limit_added=limit_added)
