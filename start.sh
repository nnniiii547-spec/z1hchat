#!/bin/bash
cd "$(dirname "$0")"

# Kill old server
lsof -ti:3000 | xargs kill 2>/dev/null
sleep 1

# Start server and open browser
nohup node server.js > /dev/null 2>&1 &
sleep 2
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null
