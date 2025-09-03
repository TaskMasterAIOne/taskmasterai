#!/bin/bash

# Firebase Functions Secrets Setup Script
# =======================================
# This script sets up Firebase Functions secrets

set -e

echo "🔥 Firebase Functions Secrets Setup"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not found. Please install it first:${NC}"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Navigate to functions directory
if [ ! -d "../functions" ]; then
    echo -e "${RED}❌ ../functions directory not found!${NC}"
    echo "Make sure you're running this from the taskmasterai directory"
    exit 1
fi

cd ../functions

echo -e "${YELLOW}📝 Setting Firebase Functions secrets...${NC}"
echo "You'll be prompted to enter each secret value."
echo ""

# Set Firebase Functions secrets one by one
echo -e "${BLUE}Setting STRIPE_SECRET_KEY (starts with sk_test_ or sk_live_)...${NC}"
firebase functions:secrets:set STRIPE_SECRET_KEY

echo -e "${BLUE}Setting STRIPE_WEBHOOK_SECRET (starts with whsec_)...${NC}"
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

echo -e "${BLUE}Setting ELEVENLABS_APIKEY...${NC}"
firebase functions:secrets:set ELEVENLABS_APIKEY

echo -e "${BLUE}Setting NOTION_OAUTH_CLIENT_ID...${NC}"
firebase functions:secrets:set NOTION_OAUTH_CLIENT_ID

echo -e "${BLUE}Setting NOTION_OAUTH_CLIENT_SECRET...${NC}"
firebase functions:secrets:set NOTION_OAUTH_CLIENT_SECRET

echo -e "${BLUE}Setting GOOGLE_OAUTH_CLIENT_ID...${NC}"
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID

echo -e "${BLUE}Setting GOOGLE_OAUTH_CLIENT_SECRET...${NC}"
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET

echo -e "${BLUE}Setting GEMINI_API_KEY_PAID (for Pro/Premium users)...${NC}"
firebase functions:secrets:set GEMINI_API_KEY_PAID

echo -e "${BLUE}Setting GEMINI_API_KEY_FREE (for Basic users)...${NC}"
firebase functions:secrets:set GEMINI_API_KEY_FREE

# Go back to taskmasterai directory
cd ../taskmasterai

echo -e "${GREEN}✅ All Firebase Functions secrets configured!${NC}"
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Deploy Firebase Functions: cd ../functions && firebase deploy --only functions"
echo "2. Your functions should now work without 'key missing' errors"

echo -e "${GREEN}🎉 Firebase secrets setup complete!${NC}"
