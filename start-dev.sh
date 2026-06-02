#!/bin/bash
# Helper script to run both backend and frontend environments in parallel

echo "🔥 Starting Prometheus AI Dev Environment..."

# Automatically clean up existing processes on ports 5001 and 5173
PID_5001=$(lsof -t -i:5001)
if [ ! -z "$PID_5001" ]; then
  echo "🧹 Cleaning up duplicate process running on port 5001 (PID: $PID_5001)..."
  kill -9 $PID_5001 >/dev/null 2>&1 || true
fi

PID_5173=$(lsof -t -i:5173)
if [ ! -z "$PID_5173" ]; then
  echo "🧹 Cleaning up duplicate process running on port 5173 (PID: $PID_5173)..."
  kill -9 $PID_5173 >/dev/null 2>&1 || true
fi

# Clean up background processes on exit
trap 'kill $(jobs -p)' EXIT

# Start backend in an isolated subshell
echo "🚀 Booting backend (Express)..."
(cd backend && npm install && npm run dev) &

# Start frontend in an isolated subshell
echo "💻 Booting frontend (Vite/React)..."
(cd frontend && npm install && npm run dev) &

# Keep the script active and wait for both commands to finish
wait
