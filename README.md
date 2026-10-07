# Bitrix Task Helper

Next.js app that lists your Bitrix24 tasks, shows description + comments, asks Claude to summarize the requirement, and produces an editable, copyable prompt for an AI coding assistant.

## Setup
1. In Bitrix24 create an inbound webhook with the `task` and `user` scopes.
2. `copy .env.local.example .env.local` and fill in `BITRIX_WEBHOOK_URL` and `ANTHROPIC_API_KEY`.
3. `npm install` then `npm run dev` and open http://localhost:3100

Secrets stay server-side (API routes in `app/api`); the browser never sees them.
