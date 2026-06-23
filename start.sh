#!/bin/bash
# API server only — frontend is served by the stock-pwa artifact workflow
PORT=8080 pnpm --filter @workspace/api-server run dev
