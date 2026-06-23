#!/bin/bash
# Start API server in background
PORT=8080 pnpm --filter @workspace/api-server run dev &
API_PID=$!

# Start frontend (blocks, shows webview)
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/stock-pwa run dev
FRONTEND_EXIT=$?

# Cleanup API server when frontend exits
kill $API_PID 2>/dev/null
exit $FRONTEND_EXIT
