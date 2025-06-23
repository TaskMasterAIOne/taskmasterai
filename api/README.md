# API Directory

This directory contains serverless API route handlers used by the TaskMasterAI application.

- **proxy.js**: Provides a simple proxy to fetch external resources, handling CORS and streaming responses to the client.

These endpoints are typically used for handling requests that require interaction with external APIs or for backend logic that should not be exposed to the client directly.

_Example usage:_
- Forwarding requests to third-party APIs while hiding API keys.
- Handling CORS for frontend code.

---
_This README provides a high-level overview. For detailed route documentation, see the code comments in each file._
