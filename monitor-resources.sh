#!/bin/bash

# Medicine Man Resource Monitoring Script
# Shows real-time resource usage for all containers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to get container stats
get_stats() {
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" \
        medicine_man_backend medicine_man_postgres medicine_man_redis medicine_man_frontend 2>/dev/null
}

# Function to check if containers are running
check_containers() {
    local running=$(docker-compose ps -q | wc -l)
    if [ "$running" -eq 0 ]; then
        echo -e "${RED}Error: No Medicine Man containers are running!${NC}"
        echo "Start them with: docker-compose up -d"
        exit 1
    fi
}

# Function to get database pool stats (if monitoring endpoint exists)
get_db_pool() {
    local pool_stats=$(curl -s http://localhost:3000/api/admin/metrics/db-pool 2>/dev/null)
    if [ -n "$pool_stats" ]; then
        echo -e "${CYAN}${BOLD}Database Connection Pool:${NC}"
        echo "$pool_stats" | jq . 2>/dev/null || echo "$pool_stats"
    fi
}

# Function to calculate resource utilization
show_allocation() {
    echo -e "${CYAN}${BOLD}Allocated Resources (20% of Unraid):${NC}"
    echo -e "  ${GREEN}CPU:${NC} 4.0 cores (out of 20 cores)"
    echo -e "  ${GREEN}RAM:${NC} 16GB (out of 80GB)"
    echo ""
    echo -e "${CYAN}${BOLD}Per-Service Limits:${NC}"
    echo -e "  ${BLUE}PostgreSQL:${NC}  1.0 CPU,  4GB RAM"
    echo -e "  ${BLUE}Redis:${NC}       0.5 CPU,  2GB RAM"
    echo -e "  ${BLUE}Backend:${NC}     2.0 CPU,  8GB RAM"
    echo -e "  ${BLUE}Frontend:${NC}    0.5 CPU,  2GB RAM"
}

# Main monitoring loop
main() {
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Error: docker-compose not found!${NC}"
        exit 1
    fi

    # Check if containers are running
    check_containers

    # Check if we should run in loop mode
    if [ "$1" == "--watch" ] || [ "$1" == "-w" ]; then
        echo -e "${GREEN}${BOLD}Medicine Man Resource Monitor${NC}"
        echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
        echo ""

        while true; do
            clear
            echo -e "${GREEN}${BOLD}=== Medicine Man Resource Monitor ===${NC}"
            echo -e "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
            echo ""

            show_allocation
            echo ""

            echo -e "${CYAN}${BOLD}Current Resource Usage:${NC}"
            get_stats
            echo ""

            get_db_pool
            echo ""

            echo -e "${YELLOW}Refreshing in 5 seconds... (Ctrl+C to exit)${NC}"
            sleep 5
        done
    else
        # Single run mode
        echo -e "${GREEN}${BOLD}=== Medicine Man Resource Monitor ===${NC}"
        echo -e "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
        echo ""

        show_allocation
        echo ""

        echo -e "${CYAN}${BOLD}Current Resource Usage:${NC}"
        get_stats
        echo ""

        get_db_pool
        echo ""

        echo -e "${CYAN}Tip: Use ${BOLD}./monitor-resources.sh --watch${NC} for continuous monitoring"
    fi
}

# Run main function
main "$@"
