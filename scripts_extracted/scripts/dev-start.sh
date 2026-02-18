#!/bin/bash

echo "==================================="
echo "VPN Platform - Development Startup"
echo "==================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠ .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✓ .env file created. Please configure it before running the app."
    echo ""
    echo "Edit .env file:"
    echo "  nano .env"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Check ports
echo "Checking required ports..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo "✗ Port 3000 is already in use!"
    echo "  Kill the process or change PORT in .env"
    lsof -i :3000
    exit 1
else
    echo "✓ Port 3000 is available"
fi
echo ""

# Start the application
echo "Starting application in development mode..."
echo "Press Ctrl+C to stop"
echo ""
echo "Application will be available at:"
echo "  → http://localhost:3000"
echo ""

npm run dev
