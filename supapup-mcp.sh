#!/bin/bash
# Supapup MCP Server Wrapper

# Change to the supapup directory
cd "$(dirname "$0")"

# Run the server with node
exec node dist/index.js "$@"