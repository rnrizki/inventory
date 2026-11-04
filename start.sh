#!/bin/sh
set -e

if [ -f /app/image-optimizer ]; then
  echo "🚀 Starting Rust Axum Image Optimizer on port 3001..."
  chmod +x /app/image-optimizer 2>/dev/null || true
  /app/image-optimizer &
fi

echo "🚀 Starting Next.js server on port 3000..."
exec node server.js
