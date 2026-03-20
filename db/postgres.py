import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = (
    f"postgresql://{os.getenv('POSTGRES_USER', 'admin')}:"
    f"{os.getenv('POSTGRES_PASSWORD', 'admin123')}@"
    f"{os.getenv('POSTGRES_HOST', 'localhost')}:"
    f"{os.getenv('POSTGRES_PORT', '5432')}/"
    f"{os.getenv('POSTGRES_DB', 'pre_delinquency')}"
)

engine = create_engine(DATABASE_URL, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(bind=engine)

def get_connection():
    return engine.connect()

def test_connection():
    try:
        with get_connection() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM customers"))
            print(f"Postgres connected. customers rows: {result.scalar()}")
    except Exception as e:
        print(f"Postgres connection failed: {e}")

if __name__ == "__main__":
    test_connection()
