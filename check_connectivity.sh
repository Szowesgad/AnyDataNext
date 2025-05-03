#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="192.168.1.200" # Fallback to the IP we found earlier
fi

BACKEND_LOCAL="http://localhost:8000"
BACKEND_LAN="http://$LOCAL_IP:8000"
FRONTEND_LOCAL="http://localhost:3000"
FRONTEND_LAN="http://$LOCAL_IP:3000"

echo -e "${YELLOW}=== AnyDataNext Connectivity Check ===${NC}"
echo -e "${YELLOW}Local IP: $LOCAL_IP${NC}"
echo ""

# Function to check endpoint
check_endpoint() {
  local url=$1
  local description=$2
  
  echo -e "${YELLOW}Checking $description: $url${NC}"
  
  # Using curl with a 5-second timeout
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url")
  
  if [ "$response" = "000" ]; then
    echo -e "${RED}✘ Connection failed: Unable to connect to $url${NC}"
    return 1
  elif [ "$response" -ge 200 ] && [ "$response" -lt 400 ]; then
    echo -e "${GREEN}✓ Success: $url returned HTTP $response${NC}"
    return 0
  else
    echo -e "${RED}✘ Error: $url returned HTTP $response${NC}"
    return 1
  fi
}

echo -e "${YELLOW}=== Backend Endpoints ===${NC}"
check_endpoint "$BACKEND_LOCAL" "Backend on localhost"
check_endpoint "$BACKEND_LAN" "Backend on LAN IP"
check_endpoint "$BACKEND_LOCAL/" "Backend root on localhost"
check_endpoint "$BACKEND_LAN/" "Backend root on LAN IP"
check_endpoint "$BACKEND_LOCAL/api/models" "Backend models API on localhost"
check_endpoint "$BACKEND_LAN/api/models" "Backend models API on LAN IP"

echo ""
echo -e "${YELLOW}=== Frontend Endpoints ===${NC}"
check_endpoint "$FRONTEND_LOCAL" "Frontend on localhost"
check_endpoint "$FRONTEND_LAN" "Frontend on LAN IP"

echo ""
echo -e "${YELLOW}=== Summary ===${NC}"
echo "For local development:"
echo "- Backend: $BACKEND_LOCAL"
echo "- Frontend: $FRONTEND_LOCAL"
echo ""
echo "For LAN access from other devices:"
echo "- Backend: $BACKEND_LAN"
echo "- Frontend: $FRONTEND_LAN"
echo ""
echo -e "${YELLOW}Note: Make sure both servers are running before checking connectivity${NC}"