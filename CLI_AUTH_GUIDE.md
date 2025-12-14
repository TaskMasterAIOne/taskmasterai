# TaskMaster AI CLI Authentication Guide

## 🔐 New Authentication System (v1.0.16+)

TaskMaster AI CLI now uses **secure authentication** to verify your identity and automatically manage your license.

## 🚀 Quick Start

### 1. Login to TaskMaster AI

```bash
# Interactive login
taskmaster login

# Or login with Google
taskmaster login --google

# Or provide credentials directly
taskmaster login --email your@email.com --password yourpassword
```

### 2. Verify Login

```bash
taskmaster whoami
```

You should see:
```
👤 Current User

Email:        your@email.com
User ID:      abc123...
Login method: email
Logged in:    Dec 14, 2025 at 12:00 PM

📜 License Info

Plan:         Pro
Status:       active
Tasks/month:  1,000
Expires:      Jan 14, 2026
```

### 3. Use TaskMaster AI

Once logged in, all commands work automatically:

```bash
# Initialize project (auto-checks auth & license)
taskmaster init

# All other commands just work!
tm list
tm next
tm plan prd.txt
```

## 🎯 Authentication Commands

| Command | Description |
|---------|-------------|
| `taskmaster login` | Login with email/password (interactive) |
| `taskmaster login --email <email>` | Login with email (will prompt for password) |
| `taskmaster login --google` | Login with Google (opens browser) |
| `taskmaster whoami` | Show current user and license status |
| `taskmaster logout` | Logout and clear session |

## 🔒 Security Features

### Secure Token Storage
- Auth tokens stored in `~/.taskmaster-ai/auth.json`
- Tokens automatically refresh before expiring
- Encrypted communication with Firebase

### License Verification
- Only the license owner can activate
- License automatically fetched during login
- No manual license key copying needed

### API Key Management

**Plus Plan Users:**
- Configure API keys in dashboard at https://taskmaster.one/app/api-keys
- Keys are synced to CLI on login
- Secure vault encryption

**Pro/Enterprise Users:**
- Hosted API keys included - no configuration needed!
- Automatic provider access (Claude, GPT-4, Gemini, etc.)
- Zero setup required

## 📋 Common Workflows

### First Time Setup

```bash
# 1. Install CLI
npm install -g @taskmasterai/cli

# 2. Login
taskmaster login

# 3. Initialize your first project
cd your-project
taskmaster init
```

### Daily Usage

```bash
# Check status
taskmaster whoami

# If token expired, it auto-refreshes
# Just continue using commands normally

# Logout at end of day (optional)
taskmaster logout
```

### Switching Accounts

```bash
# Logout from current account
taskmaster logout

# Login to different account
taskmaster login --email other@email.com
```

## 🆘 Troubleshooting

### "Not logged in" Error

```bash
# Solution: Login first
taskmaster login
```

### "Session expired" Error

```bash
# Sessions auto-refresh, but if it fails:
taskmaster logout
taskmaster login
```

### "No license found" Error

This means you don't have an active subscription:
1. Go to https://taskmaster.one/pricing
2. Subscribe to a plan
3. Login again with `taskmaster login`

### Forgot Password

Use the web app to reset:
1. Go to https://taskmaster.one/signin
2. Click "Forgot Password"
3. Follow reset instructions

## 🎓 Migration from Old System

If you were using the old `taskmaster activate <key>` system:

```bash
# Old way (deprecated)
taskmaster activate tm_live_xxxxx

# New way (recommended)
taskmaster login
```

The new system is more secure and convenient - no manual license key copying!

## 📞 Support

Need help?
- **Documentation**: https://taskmaster.one/docs
- **Email**: taskmasteroneai@gmail.com
- **Issues**: Report on GitHub

---

**Last Updated**: December 14, 2025 (v1.0.16)
