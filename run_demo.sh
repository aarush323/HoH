#!/bin/bash

# ============================================================
# HoH (Heart of Hoarders) - Full Stack Demo Script
# ============================================================
# 
# This script manages the complete HoH stack for your hackathon demo.
#
# Usage: ./run_demo.sh [command]
#
# Commands:
#   start       - Start Docker services + init DB (default)
#   stop        - Stop all Docker containers
#   restart     - Restart Docker services
#   status      - Check service status
#   cleanup     - Clear producer tracking (allow re-streaming same data)
#   clean       - Stop and remove all containers/volumes
#   help        - Show this help
#
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERROR]${NC} $1"; }

wait_for_port() {
    local host=$1
    local port=$2
    local name=$3
    local max_attempts=30
    local attempt=1

    log "Waiting for $name..."
    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            log_ok "$name is ready"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    log_warn "$name may not be ready"
    return 1
}

wait_for_kafka() {
    log "Waiting for Kafka..."
    local max_attempts=60
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec hoh-kafka-1 kafka-topics.sh --bootstrap-server localhost:9092 --list &>/dev/null 2>&1; then
            log_ok "Kafka is ready"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    log_warn "Kafka may not be ready"
    return 1
}

start_docker() {
    log "Starting Docker services..."
    
    if ! docker info &>/dev/null; then
        log_err "Docker is not running. Please start Docker first."
        exit 1
    fi

    docker compose -f "$COMPOSE_FILE" up -d
    log "Containers starting..."
    sleep 5

    wait_for_port localhost 5433 "PostgreSQL"
    wait_for_port localhost 6379 "Redis"
    wait_for_port localhost 9042 "Cassandra"
    wait_for_kafka

    log_ok "Docker services started"
}

init_database() {
    log "Initializing database..."

    python3 -c "
from db.postgres import create_tables_if_not_exist
create_tables_if_not_exist()
print('PostgreSQL tables ready')
" 2>/dev/null || log_warn "Could not init PostgreSQL (may already exist)"

    python3 -c "
from db.redis_client import test_connection
test_connection()
" 2>/dev/null || log_warn "Could not connect to Redis"

    python3 -c "
from db.cassandra_component import test_connection
test_connection()
" 2>/dev/null || log_warn "Could not connect to Cassandra"

    log_ok "Database initialization complete"
}

check_status() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         SERVICE STATUS                 ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${BLUE}Docker Containers:${NC}"
    docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || echo "  (not running)"
    echo ""

    echo -e "${BLUE}Local Services:${NC}"

    if curl -s http://localhost:8000/health &>/dev/null; then
        echo -e "  API Server:     ${GREEN}✓ Running${NC} (http://localhost:8000)"
    else
        echo -e "  API Server:     ${RED}✗ Not Running${NC}"
    fi

    if nc -z localhost 6379 2>/dev/null; then
        echo -e "  Redis:          ${GREEN}✓ Running${NC} (localhost:6379)"
    else
        echo -e "  Redis:          ${RED}✗ Not Running${NC}"
    fi

    if nc -z localhost 5433 2>/dev/null; then
        echo -e "  PostgreSQL:     ${GREEN}✓ Running${NC} (localhost:5433)"
    else
        echo -e "  PostgreSQL:     ${RED}✗ Not Running${NC}"
    fi

    if docker exec hoh-kafka-1 kafka-topics.sh --bootstrap-server localhost:9092 --list &>/dev/null 2>&1; then
        echo -e "  Kafka:          ${GREEN}✓ Running${NC} (localhost:9093)"
    else
        echo -e "  Kafka:          ${RED}✗ Not Running${NC}"
    fi

    if nc -z localhost 3000 2>/dev/null; then
        echo -e "  Frontend:       ${GREEN}✓ Running${NC} (http://localhost:3000)"
    else
        echo -e "  Frontend:       ${RED}✗ Not Running${NC}"
    fi

    echo ""
}

show_help() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         HoH DEMO - QUICK START           ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  ./run_demo.sh start     Start Docker + init DB"
    echo "  ./run_demo.sh stop      Stop Docker containers"
    echo "  ./run_demo.sh restart   Restart Docker"
    echo "  ./run_demo.sh status    Check what's running"
    echo "  ./run_demo.sh clean     Stop + remove volumes"
    echo "  ./run_demo.sh help      Show this help"
    echo ""
    echo -e "${YELLOW}For the Demo (3 terminals):${NC}"
    echo ""
    echo -e "${GREEN}Terminal 1 - Docker & API${NC}"
    echo "  ./run_demo.sh start"
    echo "  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    echo ""
    echo -e "${GREEN}Terminal 2 - Kafka Consumer${NC}"
    echo "  python pipeline/consumer.py"
    echo ""
    echo -e "${GREEN}Terminal 3 - Frontend (optional)${NC}"
    echo "  cd frontend && npm run dev"
    echo ""
    echo -e "${YELLOW}To Demo:${NC}"
    echo "  1. Open http://localhost:3000"
    echo "  2. Click 'START STREAM' button"
    echo "  3. Watch data flow in real-time!"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo ""
}

# ============================================================
# MAIN
# ============================================================

COMMAND=${1:-start}

case "$COMMAND" in
    start)
        echo ""
        echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║         Starting HoH Demo Stack          ║${NC}"
        echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
        echo ""
        
        start_docker
        init_database
        
        echo ""
        echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
        echo -e "${CYAN}  Setup Complete!                           ║${NC}"
        echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
        echo ""
        echo -e "${YELLOW}Next steps (run in separate terminals):${NC}"
        echo ""
        echo -e "${GREEN}Terminal 1 - API Server:${NC}"
        echo "  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
        echo ""
        echo -e "${GREEN}Terminal 2 - Kafka Consumer:${NC}"
        echo "  python pipeline/consumer.py"
        echo ""
        echo -e "${GREEN}Terminal 3 - Frontend (optional):${NC}"
        echo "  cd frontend && npm run dev"
        echo ""
        echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
        echo -e "${CYAN}  How to Demo:                              ║${NC}"
        echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
        echo ""
        echo "  1. Open http://localhost:3000 (or 8000 for API docs)"
        echo "  2. Make sure API + Consumer are running"
        echo "  3. Click the ${YELLOW}START STREAM${NC} button"
        echo "  4. Watch real-time data flow!"
        echo ""
        echo "  ${DIM}The button triggers: Frontend → API → Kafka → Consumer → DB → ML → SSE → Frontend${NC}"
        echo ""
        ;;
        
    stop)
        log "Stopping Docker containers..."
        docker compose -f "$COMPOSE_FILE" stop
        log_ok "Docker stopped"
        ;;
        
    restart)
        log "Restarting Docker..."
        docker compose -f "$COMPOSE_FILE" restart
        init_database
        log_ok "Restart complete"
        ;;
        
    status)
        check_status
        ;;
        
    cleanup)
        log "Clearing producer tracking state..."
        docker exec redis redis-cli DEL producer:sent_customers 2>/dev/null || \
        redis-cli -h localhost -p 6379 DEL producer:sent_customers 2>/dev/null || \
        log_warn "Could not connect to Redis - is it running?"
        log_ok "Producer state cleared - next stream will send fresh data"
        ;;
        
    clean)
        log_warn "Stopping and removing all containers and volumes..."
        docker compose -f "$COMPOSE_FILE" down -v
        log_ok "Clean complete"
        ;;
        
    help|--help|-h)
        show_help
        ;;
        
    *)
        log_err "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac
