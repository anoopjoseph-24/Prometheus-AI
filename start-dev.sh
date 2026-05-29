#!/bin/bash
# Helper script to run both backend and frontend environments in parallel

echo "🔥 Starting Prometheus AI Dev Environment..."

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
