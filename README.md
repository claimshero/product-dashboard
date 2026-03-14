# Work Dashboard

A personal work dashboard that combines an AI chat assistant (Claude Agent SDK) with tools for managing daily work. Built with React Router 7, Mantine UI, Tailwind CSS, and Express.

## Scheduler Architecture

```mermaid
flowchart TD
    subgraph Startup
        A[chat.ts server boot] --> B[Load MCP servers from ~/.claude.json]
        B --> C[Seed daily-briefing task if missing]
        C --> D[startScheduler mcpServers]
    end

    subgraph Scheduler ["scheduler.ts"]
        D --> E[Load all task definitions]
        E --> F{For each task}
        F --> G[scheduleTask]
        G --> H{enabled && valid cron?}
        H -- Yes --> I[cron.schedule job]
        H -- No --> J[Skip]
        I --> K[Store in cronJobs Map]
    end

    subgraph Execution ["Task Execution"]
        K --> L{Cron fires}
        L --> M{Already running?}
        M -- Yes --> N[Skip execution]
        M -- No --> O[Add to runningTasks Set]
        O --> P[executeTask]
        P --> Q[Save 'running' placeholder result]
        Q --> R[Interpolate prompt templates]
        R --> S[Claude Agent SDK query]
        S --> T[Stream messages]
        T --> U{Message type?}
        U -- stream_event --> V[Accumulate text deltas]
        U -- assistant --> W[Accumulate text blocks]
        U -- result --> X[Accumulate final content]
        V & W & X --> Y{Stream complete?}
        Y -- Yes --> Z[Update result: success]
        Y -- Error --> AA[Update result: error]
        Z & AA --> AB[Remove from runningTasks]
    end

    subgraph Manual ["Manual Run (API)"]
        AC[POST /api/scheduled-tasks/:id/run] --> AD{Already running?}
        AD -- Yes --> AE[409 Conflict]
        AD -- No --> AF[Return 200 immediately]
        AF --> AG[runTaskNow fire & forget]
        AG --> O
    end

    subgraph Storage ["Persistence (scheduled-tasks.ts)"]
        direction LR
        AH["scheduled-tasks.json<br/>Task definitions"]
        AI["task-results.json<br/>Execution results<br/>(max 7 per task)"]
    end

    subgraph API ["REST API (scheduled-tasks-router.ts)"]
        AJ[GET /api/scheduled-tasks] --> AH
        AK[POST /api/scheduled-tasks] --> AH
        AL[PATCH /api/scheduled-tasks/:id] --> AH
        AM[DELETE /api/scheduled-tasks/:id] --> AH
        AN[GET /api/scheduled-tasks/:id/results] --> AI
        AO[GET /api/scheduled-tasks/:id/results/latest] --> AI
        AP[GET /api/scheduled-tasks/:id/status] --> AB
    end

    subgraph Frontend ["Frontend (DailyBriefing.tsx)"]
        AQ[useDailyBriefing hook] --> AO
        AQ --> AP
        AQ -- Poll every 3s while running --> AO
        AQ -- Auto-refresh every 5min --> AO
        AR[Run Now button] --> AC
    end

    P --> AI
    AL & AK & AM --> D
```

## Development

```
npm run dev        # Start both servers (web + chat)
npm run dev:web    # Web server only (port 4000)
npm run dev:chat   # Chat server only (port 4001)
```
