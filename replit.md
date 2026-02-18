# Consulting OS MVP

## Overview

Consulting OS is a cloud-hosted MVP that demonstrates sequenced AI agents operating on shared, persistent project state with human approval gates. It follows a four-layer architecture: Projects → Workflows → Agents → Data/Models.

Users create projects with objectives and constraints, then run AI agents through a structured workflow pipeline: Project Definition → Issues Tree → MECE Critic → Hypothesis → Execution → Summary → Presentation. Each step produces versioned deliverables that require human approval before proceeding.

The app is built as a pure React web application (Vite + React + TypeScript) with shadcn/ui components, an Express.js backend, and PostgreSQL database. It features a dark sidebar navigation (ChatGPT/Harvey AI-style), Cmd+K command palette, and supports both real OpenAI LLM calls and mock mode.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2026-02-18**: Removed all Expo/React Native iOS app remnants — deleted root-level `components/`, `constants/`, `lib/`, `assets/`, `patches/`, `scripts/`, `expo-env.d.ts`. Cleaned up Expo scripts from package.json. App is now purely a Vite + React web application. Only workflow needed is `Start Backend` which serves both the API and frontend via Vite dev middleware.
- **2026-02-18**: Added Document Vault with RAG — per-project file storage with automatic text extraction, chunking, and embedding generation. Upload documents (PDF, TXT, MD, DOC, DOCX, CSV, JSON, etc.) via the Vault tab on project detail page. Files are processed in background: text extraction → chunking (800 tokens, 100 overlap) → OpenAI embeddings (with keyword fallback). RAG context automatically injected into all 7 workflow agent prompts via `appendVaultContext` helper. Tables: `vault_files`, `vault_chunks`. Backend: `server/vault-rag.ts`. API: `/api/projects/:id/vault/*` (upload, list, download, delete, query). Frontend: Vault tab in `ProjectDetail.tsx` with upload, search, status badges, download, delete.
- **2026-02-18**: Added Executive Review agent for word processor — flags document sections that dive into technical details too early without strategic framing or "so what" factor. Reviews against 5 criteria: Missing "So What", Technical Too Early, Buried Insight, No Action Orientation, Audience Mismatch. Purple-styled comments in sidebar distinct from general AI review (amber) and user comments (blue). Endpoint: `POST /api/documents/:id/executive-review`.
- **2026-02-17**: Added "Preview" button on deliverable chat messages. Clicking opens a full-screen dialog with rich formatted previews per agent type: Project Definition shows structured cards with icons, Issues Tree shows interactive network graph (@xyflow/react), Hypothesis shows card grid with metrics, Execution shows scenario metric cards, Summary shows document view, Presentation shows slide carousel with navigation. Component: `DeliverablePreview.tsx`.
- **2026-02-17**: Added unapprove functionality — approved steps can be reverted to "completed" status, unlocking deliverables for further refinement. Prevents unapproval if later steps have been started. UI shows Unapprove button in header for approved steps.
- **2026-02-17**: Added chat-style interface to WorkflowStepWorkspace with SSE streaming for real-time agent progress. Agent execution now streams progress messages (starting, LLM calls, completion) via Server-Sent Events. Chat messages are persisted in `step_chat_messages` table. Users can send follow-up questions after agent completion. Added `onProgress` callback to all agent functions.
- **2026-02-17**: Added Project Definition agent as mandatory first step in every workflow. This agent translates vague client briefs into structured, decision-based problem definitions with governing questions, success metrics, constraints, assumptions, and initial hypotheses. Workflow pipeline is now 7 agents (Project Definition → Issues Tree → MECE Critic → Hypothesis → Execution → Summary → Presentation). Stage flow updated with definition_draft/definition_approved stages.
- **2026-02-17**: Major four-layer architecture refactor — Projects instantiate workflow templates into frozen workflow instances with step-level execution and versioned deliverables. Added sidebar navigation (Projects, Workflows, Agents, Data & Models), Cmd+K command palette, and shadcn/ui components throughout.
- **2026-02-16**: Converted frontend from Expo/React Native to pure React web app (Vite + React Router + standard HTML/CSS). Server uses Vite dev middleware in development.

## System Architecture

### Frontend (Vite + React + TypeScript + shadcn/ui)

- **Framework**: Vite with React 19 and TypeScript
- **UI Library**: shadcn/ui components (Button, Card, Input, Textarea, Badge, Label, Dialog, ScrollArea, Separator, Tooltip, Sheet)
- **Styling**: Tailwind CSS with CSS custom properties (dark theme)
- **Routing**: React Router DOM v7 with BrowserRouter
- **State Management**: TanStack React Query for server state
- **Icons**: Lucide React
- **Layout**: `App.tsx` defines a Layout with dark sidebar (four sections: Projects, Workflows, Agents, Data & Models) + main content area. Routes: `/projects`, `/project/:id`, `/project/:id/workflow/:stepId`, `/workflows`, `/agents`, `/agent/:key`, `/data`

**Pages**:
- `Projects.tsx` — Project list with creation dialog
- `ProjectDetail.tsx` — Project detail with 4 tabs: Overview, Workflow (step cards with run/approve), Deliverables, Activity (run logs)
- `WorkflowStepWorkspace.tsx` — Individual step execution workspace with chat-style agent output, deliverables panel, approve/redo controls
- `Workflows.tsx` — Workflow template list
- `Agents.tsx` — Agent registry list with role badges
- `AgentDetail.tsx` — Agent configuration (model, max tokens, system prompt)
- `DataModels.tsx` — Datasets and models registry

**Components**:
- `CommandPalette.tsx` — Cmd+K search across projects, workflows, agents
- `IssuesGraph.tsx` — Interactive tree visualization for issues
- `client/src/components/ui/` — shadcn/ui primitives

### Backend (Express.js)

- **Server**: Express 5 on port 5000, defined in `server/index.ts`
- **Vite Integration**: Dev mode uses Vite middleware for HMR; production serves static files from `dist/public`
- **Routes** (`server/routes.ts`):
  - `GET/POST /api/projects` — Project CRUD
  - `GET /api/projects/:id` — Single project with workflow instance data
  - `POST /api/projects/:id/workflow/steps/:stepId/run` — Execute a specific workflow step's agent
  - `POST /api/projects/:id/workflow/steps/:stepId/approve` — Approve step deliverables
  - `POST /api/projects/:id/workflow/steps/:stepId/redo` — Redo step
  - `POST /api/projects/:id/run-next` — Run next pending step
  - `GET /api/projects/:id/deliverables` — All deliverables for project
  - `GET /api/projects/:id/run-logs` — Run logs for project
  - `GET /api/workflows` — Workflow templates with steps
  - `GET /api/agents` — Agent registry
  - `GET /api/agents/detail/:key` — Single agent config
  - `PUT /api/agent-configs/:key` — Update agent configuration
  - `GET /api/data/datasets` / `GET /api/data/models` — Data layer
  - Legacy endpoints maintained for backward compatibility

### Workflow Engine

Projects instantiate a workflow template into a frozen `workflow_instance` with `workflow_instance_steps`. Each step:
1. Has a status: `pending` → `running` → `completed` → `approved` (or `failed`)
2. Executes the associated agent via `/run`
3. Produces versioned deliverables
4. Requires human approval before the next step can run
5. Can be redone (resets to pending, increments deliverable version)

Default 7-step consulting pipeline is seeded on server start.

### AI Agents (`server/agents/`)

- **Architecture**: Seven sequential agents — Project Definition (framing gate), Issues Tree, MECE Critic (quality gate), Hypothesis, Execution, Summary, Presentation
- **LLM Integration**: OpenAI SDK via Replit AI Integrations. Model: `gpt-5-nano`
- **Mock Mode**: Deterministic stub outputs when no API key is configured
- **Tool Calling**: Execution agent uses scenario calculator tool (`server/agents/scenario-tool.ts`)
- **JSON Extraction**: Regex-based parsing of JSON from LLM markdown output

### Database (PostgreSQL + Drizzle ORM)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` (shared types between frontend and backend)
- **Connection**: `server/db.ts` — pg Pool from `DATABASE_URL`
- **Schema Push**: `npm run db:push`

**Core Tables:**
- `projects` — id, name, objective, constraints, stage, timestamps
- `workflow_templates` — id, name, description, version, timestamps
- `workflow_template_steps` — id, templateId, stepOrder, agentKey, label, description
- `agents` — id, key, name, description, role, roleColor, promptTemplate, systemPrompt, model, maxTokens, toolRefs, datasetRefs, modelRefs
- `datasets` — id, key, name, description, sourceType, connectionString, schemaInfo
- `models` — id, key, name, description, framework, version, endpoint
- `workflow_instances` — id, projectId, templateId, frozenConfig, status, timestamps
- `workflow_instance_steps` — id, instanceId, stepOrder, agentKey, label, description, status, startedAt, completedAt
- `deliverables` — id, projectId, stepId, agentKey, contentType, content, version, locked
- `issue_nodes` — tree structure for issues analysis
- `hypotheses` — hypothesis statements with metrics
- `analysis_plan` — analysis methods and parameters
- `model_runs` — audit log of agent executions
- `narratives` — executive summaries
- `slides` — presentation slides with version tracking
- `run_logs` — detailed agent run logging

### Storage Layer

- `server/storage.ts` — Full CRUD for all tables plus workflow instance management, deliverable versioning/locking, and stage transitions

### Build System

- **Development**: `npm run server:dev` — Express + Vite dev middleware (tsx for server, Vite HMR for frontend)
- **Production Build**: `vite build` → `dist/public`, `server:build` bundles server
- **Production Run**: `server:prod` serves built app

## External Dependencies

### Required Services
- **PostgreSQL**: Via Replit, connection in `DATABASE_URL`
- **Replit AI Integrations**: OpenAI-compatible LLM. Optional (mock mode works without)

### Key NPM Dependencies
- **vite**: Build tool and dev server
- **react** + **react-dom**: UI framework
- **react-router-dom**: Client-side routing
- **lucide-react**: Icon library
- **tailwindcss** + **@tailwindcss/vite**: Styling
- **shadcn/ui components**: UI primitives (button, card, input, badge, dialog, etc.)
- **express**: Backend HTTP server
- **drizzle-orm** + **drizzle-kit**: Database ORM
- **openai**: LLM API client
- **@tanstack/react-query**: Server state management
- **pg**: PostgreSQL client
- **zod** + **drizzle-zod**: Schema validation

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key via Replit integrations (optional) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL via Replit integrations (optional) |
| `REPLIT_DEV_DOMAIN` | Replit development domain (auto) |
| `REPLIT_DOMAINS` | Replit deployment domains for CORS (auto) |
