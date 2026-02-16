# Consulting OS MVP

## Overview

Consulting OS is a cloud-hosted MVP that demonstrates sequenced AI agents operating on shared, persistent project state with human approval gates. It follows a consulting workflow pattern where users create projects with objectives and constraints, then run AI agents through a structured pipeline: Issues Tree → Hypotheses & Analysis Plan → Execution (with real tool calling) → Executive Summary → Presentation. Each stage requires human approval before the next can proceed.

The app is built as a pure React web application (Vite + React + TypeScript) with an Express.js backend and PostgreSQL database. It supports both real OpenAI LLM calls and a mock mode when no API key is configured.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2026-02-16**: Replaced custom SVG graph visualizations with React Flow (@xyflow/react) for both IssuesGraph (tree layout in ProjectDetail) and Pipeline Builder (agent nodes + approval gates + revision loop).
- **2026-02-16**: Converted frontend from Expo/React Native to pure React web app (Vite + React Router + standard HTML/CSS). Removed mobile-specific dependencies. Server now uses Vite dev middleware in development mode and serves static build in production.

## System Architecture

### Frontend (Vite + React + TypeScript)

- **Framework**: Vite with React 19 and TypeScript
- **Routing**: React Router DOM v7 with BrowserRouter
- **State Management**: TanStack React Query for server state, with `queryClient` and `apiRequest` helpers in `client/src/lib/query-client.ts`
- **Pages**:
  - `client/src/pages/Projects.tsx` — Project list with creation modal (tab: Projects)
  - `client/src/pages/ProjectDetail.tsx` — Full project detail with 7 sub-tabs (overview, issues, hypotheses, runs, summary, presentation, logs)
  - `client/src/pages/Pipeline.tsx` — SVG pipeline builder diagram (tab: Pipeline)
  - `client/src/pages/Settings.tsx` — Agent configuration admin panel (tab: Settings)
  - `client/src/pages/AgentDetail.tsx` — Individual agent detail page
- **Components**: `client/src/components/IssuesGraph.tsx` — Interactive SVG tree visualization with pan/zoom
- **Styling**: CSS files with CSS custom properties defined in `client/src/styles/index.css`
- **Icons**: Lucide React (Bot, Briefcase, GitFork, Settings, etc.)
- **Fonts**: Inter (400, 500, 600, 700) via Google Fonts
- **Layout**: `App.tsx` defines Layout component with header (logo + tab nav) wrapping Projects, Pipeline, Settings. ProjectDetail and AgentDetail have their own headers with back buttons.
- **API Communication**: All API calls go through relative paths via `apiRequest()` — works with Vite proxy in dev and same-origin in production

### Backend (Express.js)

- **Server**: Express 5 running on port 5000, defined in `server/index.ts`
- **Vite Integration**: In development (`NODE_ENV=development`), Express uses Vite's `createServer` middleware to serve the React frontend with HMR. In production, serves static files from `dist/public`.
- **Routes**: Registered in `server/routes.ts` — handles project CRUD, stage transitions (approve/run-next/redo), and data retrieval for issues, hypotheses, analysis plans, model runs, narratives, slides, and run logs
- **CORS**: Dynamic CORS based on Replit domain environment variables, plus localhost support

### Workflow Engine

The core business logic enforces a strict stage-based workflow with these transitions:

```
created → issues_draft → issues_approved → hypotheses_draft → hypotheses_approved → execution_done → execution_approved → summary_draft → summary_approved → presentation_draft → complete
```

- **Pending stages** (require approval): `issues_draft`, `hypotheses_draft`, `execution_done`, `summary_draft`, `presentation_draft`
- **Run-next mapping**: Only allowed from approved/created stages to the next draft stage
- **Approval mapping**: Each draft/done stage maps to its approved/complete counterpart. `presentation_draft` approves directly to `complete`.

### AI Agents (`server/agents/`)

- **Architecture**: Six sequential agents — Issues Tree, MECE Critic (quality gate with revision loop), Hypothesis, Execution, Summary, and Presentation
- **LLM Integration**: Uses OpenAI SDK pointed at Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`). Model: `gpt-5-nano`
- **Mock Mode**: When no API key is present, agents return deterministic stub outputs so the app still functions
- **Tool Calling**: The execution agent uses a scenario calculator tool (`server/agents/scenario-tool.ts`) that performs financial scenario analysis (baseline, optimistic, pessimistic projections with NPV calculations)
- **JSON Extraction**: Agent responses are parsed from LLM output using regex to find JSON blocks in markdown code fences or raw JSON

### Database (PostgreSQL + Drizzle ORM)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` — shared between frontend (for types) and backend
- **Connection**: `server/db.ts` creates a pg Pool from `DATABASE_URL` environment variable
- **Schema Push**: Use `npm run db:push` (drizzle-kit push) to sync schema to database

**Core Tables:**
- `projects` — id, name, objective, constraints, stage, timestamps
- `issue_nodes` — id, project_id, parent_id, text, priority, version, timestamps (tree structure)
- `hypotheses` — id, project_id, issue_node_id, statement, metric, data_source, method, version, timestamps
- `analysis_plan` — id, project_id, hypothesis_id, method, parameters_json, required_dataset, timestamps
- `model_runs` — audit log of agent executions (inputs, outputs, stage, status, timestamps)
- `narratives` — executive summaries generated by the summary agent
- `slides` — presentation slides with layout, title, subtitle, bodyJson, notesText, version tracking
- `run_logs` — detailed logging of every agent run

### Storage Layer

- `server/storage.ts` exports a `storage` object with methods for all database operations (CRUD for each table, stage updates, etc.)

### Replit Integration Modules (`server/replit_integrations/`)

Pre-built integration modules included but not central to the consulting workflow:
- **Chat**: Conversation CRUD with streaming LLM responses
- **Audio**: Voice recording, speech-to-text, text-to-speech with format detection and ffmpeg conversion
- **Image**: Image generation via `gpt-image-1`
- **Batch**: Rate-limited batch processing with retry logic (uses `p-limit` and `p-retry`)

### Build System

- **Development**: Single process — `npm run server:dev` runs Express with Vite dev middleware (tsx for server hot reload, Vite HMR for frontend)
- **Production Build**: `vite build` (from client dir) builds to `dist/public`, `server:build` uses esbuild to bundle server code
- **Production Run**: `server:prod` serves the built application with static file serving

## External Dependencies

### Required Services
- **PostgreSQL**: Database provisioned via Replit, connection string in `DATABASE_URL` environment variable
- **Replit AI Integrations (OpenAI-compatible)**: LLM calls for AI agents. Configured via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`. App works in mock mode without these.

### Key NPM Dependencies
- **vite** (^7.3.1): Build tool and dev server
- **react** (19.1.0) + **react-dom**: UI framework
- **react-router-dom** (^7.13.0): Client-side routing
- **lucide-react** (^0.564.0): Icon library
- **express** (^5.0.1): Backend HTTP server
- **drizzle-orm** (^0.39.3) + **drizzle-kit**: Database ORM and migration tooling
- **openai** (^6.22.0): OpenAI API client for LLM calls
- **@tanstack/react-query** (^5.83.0): Server state management
- **pg** (^8.16.3): PostgreSQL client
- **zod** + **drizzle-zod**: Schema validation
- **p-limit** / **p-retry**: Rate limiting and retry utilities for batch processing

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key via Replit integrations (optional, mock mode without) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL via Replit integrations (optional) |
| `REPLIT_DEV_DOMAIN` | Replit development domain (set automatically) |
| `REPLIT_DOMAINS` | Replit deployment domains for CORS (set automatically) |
