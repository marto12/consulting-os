# Consulting OS MVP

## Overview
Consulting OS is a cloud-hosted MVP demonstrating sequenced AI agents operating on shared, persistent project state with human approval gates. It's built as a React web application with an Express.js backend and PostgreSQL database. The application's core purpose is to streamline consulting workflows, allowing users to create projects, define objectives, and run AI agents through a structured workflow pipeline: Project Definition → Issues Tree → MECE Critic → Hypothesis → Execution → Summary → Presentation. Each step generates versioned deliverables requiring human approval before progression, ensuring quality and human oversight. The project aims to enhance efficiency in consulting engagements by automating repetitive tasks and providing AI-powered insights, offering a significant competitive advantage in the professional services market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture
The system follows a four-layer architecture: Projects → Workflows → Agents → Data/Models.
- **Projects**: Users create projects with objectives and constraints.
- **Workflows**: Structured pipelines of AI agents.
- **Agents**: AI models that perform specific tasks.
- **Data/Models**: Manages data and AI models.

### Frontend (Vite + React + TypeScript + shadcn/ui)
- **Framework**: Vite with React 19 and TypeScript.
- **UI/UX**: Utilizes shadcn/ui components, Tailwind CSS for styling, and a dark sidebar navigation (ChatGPT/Harvey AI-style). Features a Cmd+K command palette.
- **Routing**: React Router DOM v7.
- **State Management**: TanStack React Query for server state.
- **Key Features**:
    - Project management: List, creation, detail views with tabs for Overview, Workflow, Deliverables, and Activity logs.
    - Workflow management: Workflow template list, editor using React Flow for visual graph interface, and step-level execution workspace with chat-style agent output.
    - AI Agent registry and configuration.
    - Data and Models registry, including dataset management with CSV upload and API linking.
    - Charting: AI-generated data visualizations linked to datasets, supporting various chart types (bar, line, pie, area, scatter) with dynamic data rendering and configuration.
    - Document Vault: Per-project file storage with RAG capabilities (text extraction, chunking, embedding generation).
    - Deliverable previews: Full-screen formatted previews for various agent outputs.

### Backend (Express.js)
- **Server**: Express 5 on port 5000.
- **API Endpoints**: Provides CRUD operations for projects, workflows, agents, datasets, and models. Handles workflow execution, step approval, and data management.
- **Vite Integration**: Uses Vite middleware for HMR in development; serves static files in production.
- **SSE Pattern**: For POST endpoints returning Server-Sent Events, use `res.on("close")` (not `req.on("close")`) to detect client disconnection. Using `req.on("close")` fires prematurely after POST body is consumed, causing events after async operations to be silently dropped.
- **Editor Chat**: `/api/editor-chat` endpoint supports three modes: general (context-aware Q&A), single agent (specific agent + editor content), and workflow (sequential multi-agent pipeline). Uses OpenAI streaming via `openai` package imported at top level.

### Workflow Engine
- Projects instantiate workflow templates into frozen `workflow_instance` with `workflow_instance_steps`.
- Each step has a lifecycle: `pending` → `running` → `completed` → `approved` (or `failed`).
- Executes associated agents, produces versioned deliverables, and requires human approval.
- Default 7-step consulting pipeline: Project Definition → Issues Tree → MECE Critic → Hypothesis → Execution → Summary → Presentation.

### AI Agents (`server/agents/`)
- **Architecture**: Sequential agents designed for specific consulting tasks.
- **LLM Integration**: Uses OpenAI SDK via Replit AI Integrations (e.g., `gpt-5-nano`).
- **Functionality**:
    - **Project Definition Agent**: Translates briefs into structured problem definitions.
    - **Issues Tree Agent**: Generates hierarchical issue structures.
    - **MECE Critic Agent**: Ensures outputs are Mutually Exclusive, Collectively Exhaustive.
    - **Hypothesis Agent**: Formulates testable hypotheses.
    - **Execution Agent**: Uses tool calling (e.g., scenario calculator) to execute analysis.
    - **Summary Agent**: Generates concise summaries.
    - **Presentation Agent**: Prepares presentation materials.
    - **Key Narrative Agent**: Extracts executive-level key points from technical prose and suggests rewrites.
    - **Executive Review Agent**: Flags document sections lacking strategic framing or "so what" factor.
    - **Desktop Executive Summary (DES) Agents** (5 agents, `des_*` keys):
        - **Topic Clarifier** (`des_topic_clarifier`): Probes for scope, stakeholders, and opposing sides.
        - **Key Issues Reviewer** (`des_key_issues`): Identifies 5-8 key issues with categorisation and ranking.
        - **Strongman Pro** (`des_strongman_pro`): Builds strongest case FOR the position.
        - **Strongman Con** (`des_strongman_con`): Builds strongest case AGAINST the position.
        - **Centrist Summariser** (`des_centrist_summary`): Synthesises both sides into balanced executive summary using editable template.
- **Mock Mode**: Supports deterministic stub outputs for development without API keys.

### Desktop Executive Summary Workflow
- **Template**: "Desktop Executive Summary" workflow with 5 sequential steps.
- **Execution Flow**: Topic Clarification → Key Issues Review → Strongman Pro → Strongman Con → Centrist Executive Summary.
- **Document Output**: Each DES step saves its output as a reviewable document in the project's documents list.
- **Context Chaining**: Later agents receive outputs from earlier steps as context (e.g., Centrist Summariser reads all 3 prior documents).
- **Editable Template**: The final summary follows an editable HTML template stored in `pipeline_configs` (name: `exec_summary_template`). Editable at `/exec-summary-template`.
- **Template Format**: ~500 words, short headings (3-6 words each), two sentences per section (argument + evidence).

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Defined in `shared/schema.ts`, including tables for projects, workflow templates, agents, datasets, deliverables, issue nodes, hypotheses, and run logs.
- **Connection**: Managed via `server/db.ts` using `DATABASE_URL`.

### Storage Layer
- `server/storage.ts` provides full CRUD for all tables and manages workflow instances, deliverable versioning, and stage transitions.

## External Dependencies

### Required Services
- **PostgreSQL**: Used as the primary database, configured via `DATABASE_URL`.
- **Replit AI Integrations**: Provides OpenAI-compatible LLM access; optional, as mock mode is supported.

### Key NPM Dependencies
- **Frontend**: `vite`, `react`, `react-dom`, `react-router-dom`, `lucide-react`, `tailwindcss`, `@tailwindcss/vite`, `shadcn/ui components`, `@tanstack/react-query`.
- **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `openai`, `pg`, `zod`, `drizzle-zod`, `@xyflow/react` (for workflow template editor).

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key.
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI base URL.