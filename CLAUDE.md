# Work Dashboard

## What this is

A personal work dashboard that combines an AI chat assistant (Claude Agent SDK) with tools for managing daily work. Built with React Router 7, Mantine UI, Tailwind CSS, and Express.

## Architecture

- **Web server** (port 3000): React Router SSR + static assets
- **Chat server** (port 3001): REST API for conversations, daily notes, and Claude Agent streaming
- Both started together via `npm run dev`

### Key directories

- `app/` — React frontend (components, hooks, routes, types)
- `server/` — Express backend (chat.ts is the main server, daily-notes.ts for Obsidian integration)
- `~/Library/Application Support/work-dashboard/` — Persistent data (conversations.json)

### Obsidian vault integration

The dashboard reads/writes directly to the user's Obsidian vault on Google Drive:
- Vault path: `/Users/trevorr/Library/CloudStorage/GoogleDrive-richardson.trev@gmail.com/My Drive/Trevor/Second Brain/Second Brain`
- Daily notes live in `Areas/Work/Daily Rundown/` as `YYYY-MM-DD.md` files
- Templates live in `Templates/` — always use the real template file, never hardcode fallbacks. If the template can't be read, throw an error.

## UI patterns

- Dark mode only (Mantine dark color scheme)
- Mantine components + Tailwind utility classes for layout
- Monospace font in text editors

## Development

```
npm run dev        # Start both servers
npm run dev:web    # Web server only
npm run dev:chat   # Chat server only
```

## Important rules

- Never hardcode fallback templates for Obsidian content. The source of truth is always the template file in the vault. If it can't be read, surface the error.
- The chat server has `bypassPermissions` mode for the Claude Agent SDK — it can read/write files in the vault and the project directory.
