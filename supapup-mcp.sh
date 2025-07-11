#!/bin/bash

# Supapup MCP Server Startup Script
# This script starts the Supapup MCP server for Claude Code

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the supapup directory
cd "$SCRIPT_DIR"

# Ensure the project is built
if [ ! -d "dist" ]; then
    echo "Building Supapup..." >&2
    npm run build
fi

# Start the MCP server
exec node dist/index.js