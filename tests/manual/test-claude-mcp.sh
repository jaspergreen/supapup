#!/bin/bash

echo "Testing Supapup MCP connection like Claude CLI..."

# Start supapup in background
supapup &
SUPAPUP_PID=$!

# Give it time to start
sleep 1

# Check if it's still running
if ps -p $SUPAPUP_PID > /dev/null; then
   echo "✓ Supapup is running (PID: $SUPAPUP_PID)"
else
   echo "✗ Supapup exited immediately"
   exit 1
fi

# Send MCP initialize request
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"claude-cli","version":"1.0.0"}},"id":1}' | nc localhost 9222 2>/dev/null

# Kill the process
kill $SUPAPUP_PID 2>/dev/null

echo "Test complete"