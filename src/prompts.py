"""All LLM prompts used by QueryMate, including few-shot Text-to-SQL examples for Chinook."""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

# Four question -> SQL pairs for the Chinook demo database (SQLite dialect).
FEW_SHOT_EXAMPLES: list[dict[str, str]] = [
    {
        "question": "Which 5 countries generated the most revenue?",
        "sql": (
            "SELECT BillingCountry AS country, ROUND(SUM(Total), 2) AS revenue\n"
            "FROM Invoice\n"
            "GROUP BY BillingCountry\n"
            "ORDER BY revenue DESC\n"
            "LIMIT 5"
        ),
    },
    {
        "question": "Show monthly revenue for 2013.",
        "sql": (
            "SELECT strftime('%Y-%m', InvoiceDate) AS month, ROUND(SUM(Total), 2) AS revenue\n"
            "FROM Invoice\n"
            "WHERE strftime('%Y', InvoiceDate) = '2013'\n"
            "GROUP BY month\n"
            "ORDER BY month"
        ),
    },
    {
        "question": "What are the top 10 best-selling genres by number of tracks sold?",
        "sql": (
            "SELECT g.Name AS genre, SUM(il.Quantity) AS tracks_sold\n"
            "FROM InvoiceLine il\n"
            "JOIN Track t ON t.TrackId = il.TrackId\n"
            "JOIN Genre g ON g.GenreId = t.GenreId\n"
            "GROUP BY g.Name\n"
            "ORDER BY tracks_sold DESC\n"
            "LIMIT 10"
        ),
    },
    {
        "question": "Which sales support agent brought in the most revenue?",
        "sql": (
            "SELECT e.FirstName || ' ' || e.LastName AS agent, ROUND(SUM(i.Total), 2) AS revenue\n"
            "FROM Employee e\n"
            "JOIN Customer c ON c.SupportRepId = e.EmployeeId\n"
            "JOIN Invoice i ON i.CustomerId = c.CustomerId\n"
            "GROUP BY e.EmployeeId\n"
            "ORDER BY revenue DESC\n"
            "LIMIT 1"
        ),
    },
]


def format_examples(examples: list[dict[str, str]] = FEW_SHOT_EXAMPLES) -> str:
    """Render the few-shot examples as plain text for the system prompt."""
    return "\n\n".join(f"Question: {ex['question']}\nSQL:\n{ex['sql']}" for ex in examples)


TABLE_SELECTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You choose which database tables are needed to answer a question.\n"
            "Available tables:\n{table_list}\n\n"
            "Reply with ONLY a comma-separated list of table names copied exactly from the list. "
            "Include tables needed for joins. No explanation.",
        ),
        ("human", "{history}Question: {question}"),
    ]
)

SQL_GENERATION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert data analyst who writes {dialect} SQL.\n"
            "Rules:\n"
            "- Return ONLY one read-only SQL query (SELECT or WITH ... SELECT). No markdown, no explanation.\n"
            "- Never modify data or schema (no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, PRAGMA, ATTACH).\n"
            "- Use only tables and columns that exist in the schema below; quote identifiers only when needed.\n"
            "- Give result columns short, readable snake_case aliases.\n"
            "- Round money values to 2 decimals. Order results meaningfully.\n"
            "- For time series, return a date/period column first and sort by it.\n"
            "- Use LIMIT for 'top N' questions. Max {max_rows} rows.\n"
            "- If the question is a follow-up, modify the previous SQL accordingly.\n"
            "- If the user asks to change data, still return a SELECT that previews the affected rows.\n\n"
            "Schema:\n{schema}\n\n"
            "Examples (Chinook music store database):\n{examples}",
        ),
        ("human", "{history}Question: {question}\nSQL:"),
    ]
)

SQL_FIX_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You fix broken {dialect} SQL queries. Return ONLY the corrected read-only SELECT query, "
            "no markdown and no explanation. Use only tables/columns from this schema:\n{schema}",
        ),
        (
            "human",
            "Question: {question}\n\nSQL that failed:\n{sql}\n\nDatabase error:\n{error}\n\nCorrected SQL:",
        ),
    ]
)

SUMMARY_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a helpful business analyst. Answer the user's question in 2-3 short sentences of plain "
            "English, citing the key numbers from the result. Do not mention SQL, tables or queries. "
            "If the result looks truncated, say these are the top rows.",
        ),
        ("human", "Question: {question}\n\nResult ({row_count} rows total, first rows shown):\n{rows}"),
    ]
)

EXPLAIN_SQL_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Explain SQL to a non-technical business user. Walk through the query line by line (or clause by "
            "clause) as a short markdown bullet list in simple English, then add one sentence on what the "
            "result shows.",
        ),
        ("human", "Question: {question}\n\nSQL:\n{sql}"),
    ]
)
