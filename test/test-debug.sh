#!/bin/bash

# Start an HTTP server for our test page
echo "Starting HTTP server on port 3000..."
cd "$(dirname "$0")"
python3 -m http.server 3000 &
SERVER_PID=$!

# Give the server a moment to start
sleep 2

echo "Server started with PID: $SERVER_PID"
echo "Test page available at: http://localhost:3000/test-debug.html"
echo ""
echo "To test debugging:"
echo "1. Launch browser: launch_browser"
echo "2. Navigate to page: navigate --url 'http://localhost:3000/test-debug.html'"
echo "3. Set breakpoint at line 30: set_breakpoint --lineNumber 30"
echo "4. Click increment button to trigger breakpoint"
echo "5. When paused, use: debug_get_variables"
echo "6. Inspect values: debug_evaluate --expression 'count'"
echo "7. Step through: debug_step_over"
echo "8. Continue: debug_continue"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for user to stop
trap "kill $SERVER_PID 2>/dev/null; exit" INT
wait