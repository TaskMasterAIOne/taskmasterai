# TaskMaster AI Backend Functions

This directory contains Firebase Cloud Functions for the TaskMaster AI web application.

## Setup

1. Install the Firebase CLI globally (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Navigate to the functions directory and install dependencies:
   ```bash
   cd functions
   npm install
   ```

4. Deploy the functions:
   ```bash
   cd ..
   firebase deploy --only functions
   ```

## Functions

### `askQuestion`
An HTTP endpoint that accepts a question about TaskMaster AI and returns an AI-generated response using Google's Gemini API.

**Endpoint:** `POST https://askquestion-<project-id>.<region>.run.app`

**Request Body:**
```json
{
  "question": "How do I parse a PRD file?"
}
```

**Response:**
```json
{
  "answer": "To parse a PRD file, use the command...",
  "success": true
}
```

## Local Development

To test functions locally:

```bash
cd functions
npm run serve
```

This will start the Firebase emulators. Make sure to set `VITE_USE_EMULATORS=true` in your frontend `.env` file.

## Environment

- Node.js 20
- Docs assistant uses Google Gemini `gemini-3.1-flash-lite-preview` for text responses (aligned with CLI supported models)
