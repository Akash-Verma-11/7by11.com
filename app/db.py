"""Small portable transaction layer. PostgreSQL for deployment; SQLite for local use."""
import os, sqlite3
from contextlib import contextmanager
from pathlib import Path

@contextmanager
def transaction(write=False):
    url = os.getenv('DATABASE_URL', '')
    if url:
        import psycopg
        from psycopg.rows import dict_row
        connection = psycopg.connect(url, row_factory=dict_row, connect_timeout=5)
        # A deliberate v1 throughput tradeoff: serialize mutations across replicas.
        # Replace with scoped row/advisory locks only after concurrency tests.
        if write: connection.execute('SELECT pg_advisory_xact_lock(711001)')
    else:
        path = Path(os.getenv('SQLITE_PATH', 'data/7by11.db'))
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=30, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('BEGIN IMMEDIATE' if write else 'BEGIN')
    class Database:
        def execute(self, sql, args=()):
            return connection.execute(sql.replace('?', '%s') if url else sql, args)
        def one(self, sql, args=()):
            row = self.execute(sql, args).fetchone()
            return dict(row) if row is not None else None
        def all(self, sql, args=()):
            return [dict(row) for row in self.execute(sql, args).fetchall()]
    try:
        yield Database()
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally: connection.close()
