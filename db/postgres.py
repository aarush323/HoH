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


def create_tables_if_not_exist():
    with get_connection() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS interventions (
                id                   SERIAL PRIMARY KEY,
                customer_id          VARCHAR(50) NOT NULL,
                observation_week     DATE,
                risk_score           FLOAT,
                risk_level           VARCHAR(20),
                hard_stop            BOOLEAN DEFAULT FALSE,
                hard_stop_reason     TEXT,
                selected_channel     VARCHAR(50),
                intervention_method  TEXT,
                message_content      TEXT,
                full_result_json     JSONB,
                created_at           TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id                   SERIAL PRIMARY KEY,
                customer_id          VARCHAR(50) NOT NULL,
                intervention_id      INT REFERENCES interventions(id),
                voice_outcome        VARCHAR(50),
                voice_turns          INT,
                offer_accepted       BOOLEAN,
                intent_history       JSONB,
                sentiment_trajectory JSONB,
                topics_raised        JSONB,
                escalate             BOOLEAN DEFAULT FALSE,
                escalate_reason      TEXT,
                created_at           TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.commit()
