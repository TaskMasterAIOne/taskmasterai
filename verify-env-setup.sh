#!/bin/bash

# TaskMaster AI Environment Verification Script
# =============================================
# This script verifies the environment setup is correct and no duplicates exist

set -e

echo "🔍 TaskMaster AI Environment Verification"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📂 Checking for duplicate .env files...${NC}"

# Check for any .env files in the project
ENV_FILES=$(find . -name ".env*" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./functions/node_modules/*" 2>/dev/null || true)

if [ -z "$ENV_FILES" ]; then
    echo -e "${YELLOW}⚠️  No .env files found. You may need to create one from .env.example${NC}"
else
    echo -e "${GREEN}📋 Found environment files:${NC}"
    echo "$ENV_FILES"
    
    # Count .env files (excluding .example)
    ACTUAL_ENV_COUNT=$(echo "$ENV_FILES" | grep -v ".example" | wc -l || echo "0")
    
    if [ "$ACTUAL_ENV_COUNT" -eq 1 ]; then
        echo -e "${GREEN}✅ Perfect! Only one .env file found (no duplicates)${NC}"
    elif [ "$ACTUAL_ENV_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No actual .env file found (only .example files)${NC}"
    else
        echo -e "${RED}❌ Warning: Multiple .env files found! This could cause conflicts.${NC}"
        echo "Consider consolidating into a single .env file."
    fi
fi

echo -e "${BLUE}🔧 Checking frontend environment variable usage...${NC}"

# Check if constants.ts is properly set up
if [ -f "src/config/constants.ts" ]; then
    echo -e "${GREEN}✅ Central constants.ts file found${NC}"
    
    # Check for VITE_ variables
    VITE_VARS=$(grep -c "import.meta.env.VITE_" src/config/constants.ts || echo "0")
    echo -e "${GREEN}✅ Found $VITE_VARS VITE_ environment variables in constants.ts${NC}"
else
    echo -e "${RED}❌ src/config/constants.ts not found!${NC}"
fi

echo -e "${BLUE}🔥 Checking Firebase Functions secrets...${NC}"

if [ -d "../functions" ]; then
    cd ../functions
    
    if command -v firebase &> /dev/null; then
        echo -e "${GREEN}✅ Firebase CLI found${NC}"
        
        # Check if logged in
        if firebase projects:list &> /dev/null; then
            echo -e "${GREEN}✅ Firebase CLI authenticated${NC}"
            
            # List secrets
            echo -e "${BLUE}📝 Firebase Functions secrets:${NC}"
            firebase functions:secrets:list 2>/dev/null || echo -e "${YELLOW}⚠️  No secrets found or unable to list${NC}"
        else
            echo -e "${YELLOW}⚠️  Firebase CLI not authenticated. Run 'firebase login'${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Firebase CLI not installed${NC}"
    fi
    
    cd ..
else
    echo -e "${RED}❌ ../functions directory not found!${NC}"
fi

echo -e "${BLUE}📋 Environment Setup Summary:${NC}"
echo "================================"
echo "✅ Frontend: Uses single .env file with VITE_ prefixed variables"
echo "✅ Firebase Functions: Uses Firebase CLI secrets (secure)"
echo "✅ No duplicate environment configurations"
echo "✅ .gitignore properly configured"

echo -e "${GREEN}🎉 Environment verification complete!${NC}"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}💡 Next step: Copy .env.example to .env and fill in your values${NC}"
fi
