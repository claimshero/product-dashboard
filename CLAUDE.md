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

The dashboard reads/writes directly to Josh's Obsidian vault:
- Vault path: `/Users/joshroberts/Workspace/Josh Vault`
- `Product/Context/` — Company context, operating model, bet structure, workflow docs
- `Product/Strategy/` — Strategic context snapshot
- `Product/Bets/` — Active product bets (each with bet.md and notes/)
- `Business/Clients/` — Client profiles and scoped notes
- `Business/Partners/` — Partner profiles, partnership analysis, scoped notes
- `Business/Competitors/` — Competitor profiles and signals
- `Business/Context/` — Watch list and intelligence sources
- `Business/Briefings/` — Daily and weekly competitive intelligence briefings
- `Business/Market/` — Market-level signals and trends
- `Daily/` — Daily notes as YYYY-MM-DD.md files
- `Tasks/` — Persistent task list by category
- `Agents/` — Claude agent definitions (symlinked from ~/.claude/agents/)
- `Templates/` — always use the real template file, never hardcode fallbacks. If the template can't be read, throw an error.

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
