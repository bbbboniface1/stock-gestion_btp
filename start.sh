#!/bin/bash
PORT=8080 pnpm --filter @workspace/api-server run dev &
API_PID=$!

PORT=5000 pnpm --filter @workspace/stock-pwa run dev &
FRONTEND_PID=$!

wait $API_PID $FRONTEND_PID
