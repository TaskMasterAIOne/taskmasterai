# src/lib

This directory contains helper libraries and integrations for the TaskMasterAI app.

## Key Files

- **api.ts**: Fetches data from the application's backend API, standardizing error handling and headers.
- **utils.ts**: Utility function(s) for class name merging (using `clsx` and `tailwind-merge`).
- **stripe.ts**: Manages Stripe.js integration for payment processing.

## Usage

Import any helper from this directory as needed in your React components or hooks.

```typescript
import { fetchApi } from './lib/api';
import { cn } from './lib/utils';
import { stripePromise } from './lib/stripe';
```

---

_This README describes common helpers and integrations. Add documentation if custom files are added!_
