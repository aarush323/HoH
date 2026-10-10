# Loadline integration boundary

**Loadline** (separate repo: NeatHacks) boots this project via Docker Compose, load-tests HTTP routes, and runs an investigator agent. It does **not** patch HoH automatically.

## What repos must provide

1. **An HTTP application service in `docker-compose.yml`** — the `api` service (FastAPI on port 8000, `GET /health`). The `Dockerfile` must include every Python package imported at startup (`app`, `graph`, `db`, `pipeline`, `voice_agent`, etc.).
2. **Infra services** (Kafka, Postgres, Redis, Cassandra, Zookeeper) stay as-is; Loadline discovers the **app** from `build` + HTTP healthcheck, not from broker images.
3. **Do not set `container_name`** on services — Loadline runs multiple isolated compose projects; fixed names (`redis`, `api`, …) cause Docker name conflicts.
4. **No Loadline-specific hacks** in the HoH codebase — if compose only had data pipelines, Loadline correctly returned *no application service* until `api` was added here.

## Commands (from Loadline repo)

```bash
uv run loadline load  --repo /home/aarush_linux/projects/HoH
uv run loadline run   --repo /home/aarush_linux/projects/HoH --fast
```

First `api` image build can take several minutes (ML dependencies). Use `docker compose build api` in this repo to pre-warm.

## Local dev (unchanged)

```bash
uvicorn app.api:app --host 0.0.0.0 --port 8000
```

Host `.env` still uses `localhost` ports; **compose** overrides with service hostnames (`postgres`, `redis`, etc.).
