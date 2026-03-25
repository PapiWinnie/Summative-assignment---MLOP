import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def _get_conn():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS uploaded_files (
                    id SERIAL PRIMARY KEY,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    label TEXT,
                    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
                    processed BOOLEAN DEFAULT FALSE
                )
            """)
        conn.commit()


def insert_file(filename: str, file_path: str, label: str | None) -> int:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO uploaded_files (filename, file_path, label) VALUES (%s, %s, %s) RETURNING id",
                (filename, file_path, label),
            )
            row_id = cur.fetchone()[0]
        conn.commit()
    return row_id


def get_unprocessed_files() -> list[dict]:
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, filename, file_path, label FROM uploaded_files WHERE processed = FALSE"
            )
            return [dict(row) for row in cur.fetchall()]


def mark_processed(file_id: int):
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE uploaded_files SET processed = TRUE WHERE id = %s", (file_id,)
            )
        conn.commit()
