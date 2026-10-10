FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY graph/ graph/
COPY db/ db/
COPY pipeline/ pipeline/
COPY voice_agent/ voice_agent/
COPY txn_intelligence/ txn_intelligence/
COPY models/ models/

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=120s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
