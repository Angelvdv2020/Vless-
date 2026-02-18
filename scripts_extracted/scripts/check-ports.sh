#!/bin/bash

echo "==================================="
echo "VPN Platform - Port Check Utility"
echo "==================================="
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    local name=$2

    if command -v lsof &> /dev/null; then
        if lsof -i :$port > /dev/null 2>&1; then
            echo "✓ Port $port ($name) - IN USE"
            lsof -i :$port | grep LISTEN
        else
            echo "○ Port $port ($name) - Available"
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep ":$port " > /dev/null 2>&1; then
            echo "✓ Port $port ($name) - IN USE"
            netstat -tuln | grep ":$port "
        else
            echo "○ Port $port ($name) - Available"
        fi
    else
        echo "⚠ Cannot check port $port - install lsof or netstat"
    fi
    echo ""
}

# Check all required ports
echo "Required Ports:"
echo "==============="
check_port 3000 "Web Application"
check_port 5432 "PostgreSQL Database"
check_port 8000 "3X-UI API"

echo ""
echo "Production Ports:"
echo "================"
check_port 80 "Nginx HTTP"
check_port 443 "Nginx HTTPS"

echo ""
echo "Optional Monitoring Ports:"
echo "========================="
check_port 9090 "Prometheus"
check_port 3001 "Grafana"
check_port 9100 "Node Exporter"

echo ""
echo "Firewall Status:"
echo "================"
if command -v ufw &> /dev/null; then
    sudo ufw status
else
    echo "UFW not installed"
fi
