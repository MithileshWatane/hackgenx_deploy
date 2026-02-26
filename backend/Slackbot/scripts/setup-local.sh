#!/bin/bash

# Local Development Setup Script

set -e

echo "🏥 Doctor AI Assistant - Local Setup"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Current version: $(node -v)"
  exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check if .env exists
if [ ! -f .env ]; then
  echo ""
  echo "📝 Creating .env file from template..."
  cp .env.example .env
  echo "⚠️  Please edit .env with your credentials:"
  echo "   - SLACK_BOT_TOKEN"
  echo "   - SLACK_SIGNING_SECRET"
  echo "   - SLACK_APP_TOKEN"
  echo "   - OPENAI_API_KEY"
  echo "   - ENCRYPTION_KEY (generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
  echo ""
  read -p "Press Enter after updating .env file..."
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🐳 Starting PostgreSQL and ChromaDB..."
docker-compose up -d postgres chromadb

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check PostgreSQL
until docker-compose exec -T postgres pg_isready -U doctor_ai > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done
echo "✅ PostgreSQL is ready"

# Check ChromaDB
until curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; do
  echo "Waiting for ChromaDB..."
  sleep 2
done
echo "✅ ChromaDB is ready"

echo ""
echo "🗃️  Setting up database..."
npx prisma generate
npx prisma migrate dev --name init

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Start the application with:"
echo "   npm run dev"
echo ""
echo "📊 View database with:"
echo "   npx prisma studio"
echo ""
