#!/bin/bash

# Noryx Premium VPN - API Testing Script
# Tests all endpoints with different platforms

BASE_URL="http://localhost:3000"
USER_ID=1

echo "🧪 Testing Noryx Premium VPN API"
echo "=================================="
echo ""

# Test 1: Health Check
echo "1️⃣  Testing health endpoint..."
curl -s $BASE_URL/health | jq '.'
echo ""

# Test 2: Get Countries
echo "2️⃣  Testing countries endpoint..."
curl -s $BASE_URL/api/vpn/countries | jq '.'
echo ""

# Test 3: Smart Connect - iOS
echo "3️⃣  Testing smart connect (iOS)..."
curl -s -X POST $BASE_URL/api/vpn/connect \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1" \
  -d "{\"userId\":$USER_ID,\"countryCode\":\"auto\"}" | jq '.'
echo ""

# Test 4: Smart Connect - Android
echo "4️⃣  Testing smart connect (Android)..."
curl -s -X POST $BASE_URL/api/vpn/connect \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36" \
  -d "{\"userId\":$USER_ID,\"countryCode\":\"us\"}" | jq '.'
echo ""

# Test 5: Smart Connect - Windows
echo "5️⃣  Testing smart connect (Windows)..."
curl -s -X POST $BASE_URL/api/vpn/connect \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \
  -d "{\"userId\":$USER_ID,\"countryCode\":\"uk\"}" | jq '.'
echo ""

# Test 6: Smart Connect - macOS
echo "6️⃣  Testing smart connect (macOS)..."
curl -s -X POST $BASE_URL/api/vpn/connect \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \
  -d "{\"userId\":$USER_ID,\"countryCode\":\"de\"}" | jq '.'
echo ""

# Test 7: Smart Connect - Unknown Platform (QR Code)
echo "7️⃣  Testing smart connect (Unknown - QR Code)..."
curl -s -X POST $BASE_URL/api/vpn/connect \
  -H "Content-Type: application/json" \
  -H "User-Agent: CustomBot/1.0" \
  -d "{\"userId\":$USER_ID,\"countryCode\":\"auto\"}" | jq 'del(.qrCode) | . + {qrCode: "<base64-data-omitted>"}'
echo ""

# Test 8: Change Country
echo "8️⃣  Testing change country..."
curl -s -X POST $BASE_URL/api/vpn/change-country \
  -H "Content-Type: application/json" \
  -d "{\"userId\":$USER_ID,\"countryCode\":\"jp\"}" | jq '.'
echo ""

echo "✅ All tests completed!"
