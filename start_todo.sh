#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi

if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install)
fi

trap 'kill $(jobs -p) 2>/dev/null' EXIT

(cd backend && ../backend/.venv/bin/uvicorn main:app --reload --port 8000) &
(cd frontend && npm run dev) &

echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"

wait
