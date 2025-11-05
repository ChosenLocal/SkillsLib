#!/bin/bash

###############################################################################
# Auth Testing Script
#
# This script temporarily enables authentication, runs auth tests,
# and restores the original DISABLE_AUTH setting.
#
# Use this for weekly auth health checks while developing with auth disabled.
#
# Usage:
#   ./scripts/test-with-auth.sh
#
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 Auth Testing Script"
echo "====================="
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Must run from project root${NC}"
  exit 1
fi

# Backup current env files
API_ENV="apps/api/.env.local"
WEB_ENV="apps/web/.env.local"

echo "📋 Step 1: Backing up environment files..."

cp "$API_ENV" "$API_ENV.backup" 2>/dev/null || true
cp "$WEB_ENV" "$WEB_ENV.backup" 2>/dev/null || true

echo -e "${GREEN}✓${NC} Backup created"
echo ""

# Function to restore backups
restore_backups() {
  echo ""
  echo "🔄 Restoring original environment files..."
  mv "$API_ENV.backup" "$API_ENV" 2>/dev/null || true
  mv "$WEB_ENV.backup" "$WEB_ENV" 2>/dev/null || true
  echo -e "${GREEN}✓${NC} Restored"
}

# Trap to ensure backups are restored on exit
trap restore_backups EXIT

# Enable auth in env files
echo "📝 Step 2: Enabling authentication..."

# Update API .env.local
if [ -f "$API_ENV" ]; then
  sed -i.tmp 's/DISABLE_AUTH="true"/DISABLE_AUTH="false"/' "$API_ENV"
  sed -i.tmp 's/DISABLE_AUTH=true/DISABLE_AUTH=false/' "$API_ENV"
  rm "$API_ENV.tmp" 2>/dev/null || true
fi

# Update Web .env.local
if [ -f "$WEB_ENV" ]; then
  sed -i.tmp 's/DISABLE_AUTH="true"/DISABLE_AUTH="false"/' "$WEB_ENV"
  sed -i.tmp 's/DISABLE_AUTH=true/DISABLE_AUTH=false/' "$WEB_ENV"
  sed -i.tmp 's/NEXT_PUBLIC_DISABLE_AUTH="true"/NEXT_PUBLIC_DISABLE_AUTH="false"/' "$WEB_ENV"
  sed -i.tmp 's/NEXT_PUBLIC_DISABLE_AUTH=true/NEXT_PUBLIC_DISABLE_AUTH=false/' "$WEB_ENV"
  rm "$WEB_ENV.tmp" 2>/dev/null || true
fi

echo -e "${GREEN}✓${NC} Auth enabled in environment files"
echo ""

# Check if servers are running
echo "🔍 Step 3: Checking if servers are running..."
API_RUNNING=false
WEB_RUNNING=false

if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  API_RUNNING=true
  echo -e "${GREEN}✓${NC} API server is running"
else
  echo -e "${YELLOW}⚠${NC}  API server not running (will need to start it)"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  WEB_RUNNING=true
  echo -e "${GREEN}✓${NC} Web server is running"
else
  echo -e "${YELLOW}⚠${NC}  Web server not running (will need to start it)"
fi

echo ""

# If servers are running, ask user to restart them
if [ "$API_RUNNING" = true ] || [ "$WEB_RUNNING" = true ]; then
  echo -e "${YELLOW}⚠  Servers need to be restarted with new env vars${NC}"
  echo ""
  echo "Please restart your servers:"
  if [ "$API_RUNNING" = true ]; then
    echo "  1. Stop API server (Ctrl+C)"
    echo "  2. Run: cd apps/api && pnpm dev"
  fi
  if [ "$WEB_RUNNING" = true ]; then
    echo "  3. Stop Web server (Ctrl+C)"
    echo "  4. Run: cd apps/web && pnpm dev"
  fi
  echo ""
  echo "Press Enter when servers are restarted..."
  read -r
fi

# Run auth tests
echo "🧪 Step 4: Running authentication tests..."
echo ""

cd apps/web

if pnpm exec playwright test tests/auth/full-flow.spec.ts --project=chromium; then
  echo ""
  echo -e "${GREEN}✅ All auth tests passed!${NC}"
  TEST_RESULT=0
else
  echo ""
  echo -e "${RED}❌ Auth tests failed!${NC}"
  echo ""
  echo "This means authentication may not work correctly in production."
  echo "Please review the test failures and fix issues before deploying."
  TEST_RESULT=1
fi

cd ../..

echo ""
echo "📊 Step 5: Test Summary"
echo "====================="

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ Authentication is working correctly${NC}"
  echo ""
  echo "Your auth code is healthy! You can continue developing with"
  echo "DISABLE_AUTH=true, but auth will work when you enable it."
else
  echo -e "${RED}❌ Authentication tests failed${NC}"
  echo ""
  echo "Action required:"
  echo "  1. Review test failures above"
  echo "  2. Fix authentication issues"
  echo "  3. Run this script again"
  echo ""
  echo -e "${YELLOW}⚠  DO NOT deploy to production until tests pass!${NC}"
fi

echo ""
echo "Environment files will be restored to original state in 3 seconds..."
sleep 3

# Backups will be restored automatically by trap
exit $TEST_RESULT
