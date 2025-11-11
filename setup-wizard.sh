#!/bin/bash

# Medicine Man Setup Wizard
# This script runs the interactive setup wizard for configuring the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Medicine Man - Setup Wizard${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js to continue."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    echo "Please install npm to continue."
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Backend directory not found.${NC}"
    echo "Please run this script from the Medicine Man root directory."
    exit 1
fi

# Check if node_modules exists, if not run npm install
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$BACKEND_DIR"
    npm install
    echo ""
fi

# Run the setup wizard
cd "$BACKEND_DIR"
echo -e "${GREEN}Starting setup wizard...${NC}"
echo ""
node src/scripts/setup-wizard.js

exit 0
