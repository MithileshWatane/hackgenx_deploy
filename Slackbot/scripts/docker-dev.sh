#!/bin/bash

# Docker Compose Development Script

set -e

echo "🚀 Starting Doctor AI Assistant System..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Copying from .env.example..."
  cp .env.example .env
  echo "✅ .env file created. Please update it with your credentials before continuing."
  exit 1
fi

# Build and start containers
echo "📦 Building Docker containers..."
docker-compose build

echo "🔄 Starting services..."
docker-compose up -d postgres chromadb

echo "⏳ Waiting for services to be healthy..."
sleep 10

echo "🗃️  Running database migrations..."
docker-compose run --rm app npx prisma migrate dev --name init

echo "✅ Database setup complete"

echo "🚀 Starting application..."
docker-compose up -d app

echo ""
echo "✅ Doctor AI Assistant System is running!"
echo ""
echo "📊 View logs: docker-compose logs -f app"
echo "🛑 Stop system: docker-compose down"
echo "🔄 Restart system: docker-compose restart app"
echo ""
