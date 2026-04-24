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

### Obsidian vault integration (dual-vault)

The dashboard reads/writes across two Obsidian vaults. Each folder has a single home vault — never write to the wrong one.

Configure both in `.env`:
- `OBSIDIAN_PERSONAL_VAULT_PATH` — local-only personal vault
- `OBSIDIAN_CLAIMABLE_VAULT_PATH` — team-shared Claimable vault (Obsidian Sync)
- `OBSIDIAN_VAULT_PATH` — transitional legacy fallback; used for either vault if the dedicated var is not set. Remove once the physical vault split is complete.

**Personal vault** (`$OBSIDIAN_PERSONAL_VAULT_PATH`) — local-only, private to Josh:
- `Daily/` — Daily notes as YYYY-MM-DD.md files
- `Daily/meetings/` — Raw meeting archive (transcripts, unfiltered)
- `Tasks/` — Persistent task list by category

**Claimable vault** (`$OBSIDIAN_CLAIMABLE_VAULT_PATH`) — team-shared via Obsidian Sync:
- `Product/Context/` — Company context, operating model, bet structure, workflow docs
- `Product/Strategy/` — Strategic context snapshot
- `Product/Bets/` — Active product bets (each with bet.md and notes/)
- `Business/Clients/` — Client profiles and scoped meeting notes (sanitized)
- `Business/Partners/` — Partner profiles, partnership analysis, scoped notes (sanitized)
- `Business/Competitors/` — Competitor profiles and signals
- `Business/Context/` — Watch list and intelligence sources
- `Business/Briefings/` — Daily and weekly competitive intelligence briefings
- `Business/Market/` — Market-level signals and trends
- `Reference/` — Stable reference docs, white papers, walkthroughs
- `Templates/` — always use the real template file, never hardcode fallbacks. If the template can't be read, throw an error.
- `Agents/` — Claude agent definitions (symlinked from ~/.claude/agents/)

### Vault boundary rule for agents

Agents have a home vault and should not cross the Personal → Claimable boundary silently:

- **Always Claimable** (no prompt): `bet-creator`, `intel-agent`, briefing generation, bet/client/partner/competitor writes
- **Always Personal** (no prompt): daily note creation, raw transcript capture, task list edits
- **Boundary agents** (`meeting-processor` and similar): read raw content from Personal, but MUST surface the Personal → Claimable crossing in the plan and wait for approval before writing sanitized output to Claimable

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
- The chat server has `bypassPermissions` mode for the Claude Agent SDK — it can read/write files in both vaults and the project directory.
