#!/bin/bash

# TaskMaster AI Environment Setup Script
# =====================================
# This script sets up both frontend and Firebase Functions environment variables

set -e

echo "🚀 TaskMaster AI Environment Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Frontend Environment Variables Setup
echo -e "${BLUE}📱 Setting up Frontend Environment Variables...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file. Please edit it with your actual values.${NC}"
else
    echo -e "${GREEN}✅ .env file already exists.${NC}"
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not found. Please install it first:${NC}"
    echo "npm install -g firebase-tools"
    exit 1
fi

echo -e "${BLUE}🔥 Setting up Firebase Functions Secrets...${NC}"

# Navigate to functions directory (one level up from taskmasterai)
cd ../functions

echo -e "${YELLOW}📝 Setting Firebase Functions secrets...${NC}"
echo "You'll be prompted to enter each secret value."

# Set Firebase Functions secrets
echo -e "${BLUE}Setting STRIPE_SECRET_KEY...${NC}"
firebase functions:secrets:set STRIPE_SECRET_KEY

echo -e "${BLUE}Setting STRIPE_WEBHOOK_SECRET...${NC}"
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

# Go back to root
cd ..

echo -e "${GREEN}✅ Firebase Functions secrets configured!${NC}"

echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Edit the .env file with your frontend environment variables"
echo "2. Deploy Firebase Functions: cd functions && firebase deploy --only functions"
echo "3. Start your development server: npm run dev"

echo -e "${GREEN}🎉 Environment setup complete!${NC}"
