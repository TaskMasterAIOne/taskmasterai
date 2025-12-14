# Hosted API Keys Setup Guide

This guide explains how to set up the hosted API keys feature for PRO plan users.

## Overview

PRO plan subscribers can use TaskMaster AI's hosted API keys instead of providing their own. This is handled securely through Firebase secrets.

## Setting Up Firebase Secrets

Run these commands from the `backend/functions` directory to set up the hosted API keys as Firebase secrets:

```bash
# Navigate to the functions directory
cd backend/functions

# Set each hosted API key as a Firebase secret
# Only set the keys you want to provide for PRO users

# Anthropic (Claude)
firebase functions:secrets:set HOSTED_ANTHROPIC_API_KEY

# OpenAI (GPT-4, etc.)
firebase functions:secrets:set HOSTED_OPENAI_API_KEY

# Google (Gemini)
firebase functions:secrets:set HOSTED_GOOGLE_API_KEY

# Perplexity (for research)
firebase functions:secrets:set HOSTED_PERPLEXITY_API_KEY

# DeepSeek
firebase functions:secrets:set HOSTED_DEEPSEEK_API_KEY

# xAI (Grok)
firebase functions:secrets:set HOSTED_XAI_API_KEY

# OpenRouter
firebase functions:secrets:set HOSTED_OPENROUTER_API_KEY

# Mistral
firebase functions:secrets:set HOSTED_MISTRAL_API_KEY

# Moonshot (Kimi)
firebase functions:secrets:set HOSTED_MOONSHOT_API_KEY

# Zhipu (GLM)
firebase functions:secrets:set HOSTED_ZHIPU_API_KEY

# Ollama (if using hosted Ollama)
firebase functions:secrets:set HOSTED_OLLAMA_API_KEY
```

Each command will prompt you to enter the secret value.

## Your API Keys

Based on your configuration, here are the secrets you need to set:

| Provider | Environment Variable | Example Format |
|----------|---------------------|---------------------------|
| Anthropic | HOSTED_ANTHROPIC_API_KEY | sk-ant-api03-... |
| OpenAI | HOSTED_OPENAI_API_KEY | sk-proj-... |
| Google | HOSTED_GOOGLE_API_KEY | AIzaSy... |
| Perplexity | HOSTED_PERPLEXITY_API_KEY | pplx-... |
| DeepSeek | HOSTED_DEEPSEEK_API_KEY | sk-... |
| xAI | HOSTED_XAI_API_KEY | xai-... |
| OpenRouter | HOSTED_OPENROUTER_API_KEY | sk-or-v1-... |
| Mistral | HOSTED_MISTRAL_API_KEY | (your key) |
| Moonshot | HOSTED_MOONSHOT_API_KEY | sk-... |
| Zhipu | HOSTED_ZHIPU_API_KEY | (your key) |
| Ollama | HOSTED_OLLAMA_API_KEY | (your key) |

## Quick Setup Script

Create a script to set all keys at once:

```bash
#!/bin/bash
# save this as setup-hosted-keys.sh and run it

echo "Setting up hosted API keys for TaskMaster AI PRO users..."

# Set each key (you'll be prompted for the value)
echo "Enter Anthropic API key:"
firebase functions:secrets:set HOSTED_ANTHROPIC_API_KEY

echo "Enter OpenAI API key:"
firebase functions:secrets:set HOSTED_OPENAI_API_KEY

echo "Enter Google API key:"
firebase functions:secrets:set HOSTED_GOOGLE_API_KEY

echo "Enter Perplexity API key:"
firebase functions:secrets:set HOSTED_PERPLEXITY_API_KEY

echo "Enter DeepSeek API key:"
firebase functions:secrets:set HOSTED_DEEPSEEK_API_KEY

echo "Enter xAI API key:"
firebase functions:secrets:set HOSTED_XAI_API_KEY

echo "Enter OpenRouter API key:"
firebase functions:secrets:set HOSTED_OPENROUTER_API_KEY

echo "Enter Mistral API key:"
firebase functions:secrets:set HOSTED_MISTRAL_API_KEY

echo "Enter Moonshot API key:"
firebase functions:secrets:set HOSTED_MOONSHOT_API_KEY

echo "Enter Zhipu API key:"
firebase functions:secrets:set HOSTED_ZHIPU_API_KEY

echo "Done! Now deploy the functions:"
echo "firebase deploy --only functions"
```

## Deploying

After setting the secrets, deploy the functions:

```bash
firebase deploy --only functions
```

## Security Notes

1. **Secrets are encrypted**: Firebase secrets are stored encrypted and only accessible to your functions at runtime
2. **PRO plan only**: The endpoint only returns keys to validated PRO plan license holders
3. **Audit logging**: All access to hosted keys is logged with user ID
4. **No client exposure**: Keys are never sent to the client/browser, only to the CLI

## How It Works

1. PRO user activates their license with `taskmaster activate <key>`
2. CLI detects PRO plan and fetches hosted API keys
3. Keys are cached locally for 1 hour
4. When making AI calls, CLI checks (in order):
   - User's environment variables
   - User's dashboard-synced keys
   - Hosted keys (if PRO plan)

## Testing

To test the setup:

1. Create a test user with PRO plan
2. Activate their license in CLI
3. Run `taskmaster sync-keys` to verify hosted keys are available
4. Run an AI command without any API keys configured
