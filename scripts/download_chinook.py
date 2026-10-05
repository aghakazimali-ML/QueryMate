"""Download the Chinook sample SQLite database into `data/` if it is missing.

Usage:
    python scripts/download_chinook.py
"""

from __future__ import annotations

import logging
import sqlite3
import sys
import urllib.request
from pathlib import Path

# Allow running as a plain script (`python scripts/download_chinook.py`).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import CHINOOK_PATH, get_settings  # noqa: E402

logger = logging.getLogger(__name__)


def _is_valid_sqlite(path: Path) -> bool:
    """Return True if `path` is a readable SQLite file containing the Invoice table."""
    try:
        with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as conn:
            conn.execute("SELECT 1 FROM Invoice LIMIT 1")
        return True
    except sqlite3.Error:
        return False


def ensure_chinook(path: Path = CHINOOK_PATH, url: str | None = None, timeout: float = 60) -> Path:
    """Make sure the Chinook DB exists at `path`, downloading it if needed.

    Raises:
        RuntimeError: if the download fails or the file is not a valid database.
    """
    if path.exists() and _is_valid_sqlite(path):
        return path

    url = url or get_settings().chinook_url
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    logger.info("Downloading Chinook database from %s", url)
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp, open(tmp, "wb") as fh:
            fh.write(resp.read())
    except OSError as exc:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"Could not download the Chinook database: {exc}") from exc

    if not _is_valid_sqlite(tmp):
        tmp.unlink(missing_ok=True)
        raise RuntimeError("Downloaded file is not a valid Chinook SQLite database.")
    tmp.replace(path)
    logger.info("Chinook database saved to %s", path)
    return path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        print_path = ensure_chinook()
    except RuntimeError as err:
        logger.error("%s", err)
        sys.exit(1)
    logger.info("Ready: %s", print_path)
