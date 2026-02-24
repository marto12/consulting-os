import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import multer from "multer";
import OpenAI from "openai";
import { storage } from "./storage";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import {
  getModelUsed,
  getDefaultConfigs,
  DEFAULT_PROMPTS,
  type ProgressCallback,
} from "./agents";
import { runWorkflowStep, refineWithLangGraph, refineWithLangGraphStreaming } from "./agents/workflow-graph";
import { reviewDocument, actionComment, actionAllComments, executiveReviewDocument, spotFactCheckCandidates, runFactCheck, narrativeReviewDocument } from "./agents/document-agents";
import { processVaultFile, retrieveRelevantContext, formatRAGContext } from "./vault-rag";
import { generateChartSpec } from "./agents/chart-agent";
import { db } from "./db";
import { datasetRows } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const PROJECT_TEMPLATE_DIR = path.resolve(process.cwd(), "templates", "projects");

function formatTemplateName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeSpreadsheetColumns(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((col) => String(col || "").trim())
    .filter((col) => col.length > 0);
  return Array.from(new Set(cleaned));
}

function normalizeSpreadsheetRows(columns: string[], rows: any[]): Array<{ rowIndex: number; data: any }> {
  return rows.map((row, idx) => {
    if (Array.isArray(row)) {
      const data: Record<string, string> = {};
      columns.forEach((col, colIdx) => {
        data[col] = row[colIdx] == null ? "" : String(row[colIdx]);
      });
      return { rowIndex: idx, data };
    }
    if (row && typeof row === "object") {
      return { rowIndex: idx, data: row };
    }
    return { rowIndex: idx, data: {} };
  });
}

type CgeImpactRow = { industry: string; year: number; impact: string };

function buildCgeSpreadsheetRows(result: any) {
  const columns = ["Metric", "Industry", "Year", "Impact"];
  const rows: Array<{ rowIndex: number; data: any }> = [];
  const gdpImpacts: CgeImpactRow[] = result?.industry_impacts?.gdp ?? [];
  const employmentImpacts: CgeImpactRow[] = result?.industry_impacts?.employment ?? [];

  gdpImpacts.forEach((row, idx) => {
    rows.push({
      rowIndex: rows.length,
      data: {
        Metric: "GDP impact",
        Industry: row.industry,
        Year: row.year,
        Impact: row.impact,
      },
    });
  });

  employmentImpacts.forEach((row) => {
    rows.push({
      rowIndex: rows.length,
      data: {
        Metric: "Employment impact",
        Industry: row.industry,
        Year: row.year,
        Impact: row.impact,
      },
    });
  });

  return { columns, rows };
}

type PythonModelConfig = {
  runtime?: string;
  entrypoint?: string;
  args?: string[];
};

async function runPythonModel(config: PythonModelConfig, payload: any): Promise<string> {
  if (!config?.entrypoint) throw new Error("Model entrypoint is missing");
  const scriptPath = path.resolve(process.cwd(), config.entrypoint);
  const args = Array.isArray(config.args) ? config.args : [];

  return new Promise((resolve, reject) => {
    const python = spawn(config.runtime || "python3", [scriptPath, ...args]);
    let stdout = "";
    let stderr = "";

    python.stdout.setEncoding("utf-8");
    python.stderr.setEncoding("utf-8");

    python.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    python.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    python.on("error", (err) => {
      reject(new Error(err.message || "Failed to run model"));
    });

    python.on("close", (code) => {
      if (code && code !== 0) {
        reject(new Error(stderr.trim() || `Model exited with code ${code}`));
        return;
      }
      if (stderr.trim().length > 0) {
        reject(new Error(stderr.trim()));
        return;
      }
      resolve(stdout.trim());
    });

    const input = payload == null ? "" : JSON.stringify(payload);
    if (input.length > 0) python.stdin.write(input);
    python.stdin.end();
  });
}

async function loadProjectTemplates() {
  try {
    const entries = await readdir(PROJECT_TEMPLATE_DIR, { withFileTypes: true });
    const templates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map(async (entry) => {
          const slug = entry.name.replace(/\.md$/i, "");
          const content = await readFile(path.join(PROJECT_TEMPLATE_DIR, entry.name), "utf8");
          return {
            slug,
            name: formatTemplateName(slug),
            content,
          };
        })
    );
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

type ProjectTemplatePhase = {
  title: string;
  tasks: Array<{ title: string; owner: string }>;
};

function parseProjectTemplate(content: string): ProjectTemplatePhase[] {
  const phases: ProjectTemplatePhase[] = [];
  const lines = content.split(/\r?\n/);
  let current: ProjectTemplatePhase | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^###\s+Phase\s+\d+\s+[–-]\s+(.+)$/);
    if (headingMatch) {
      if (current) phases.push(current);
      current = { title: headingMatch[1].trim(), tasks: [] };
      continue;
    }

    if (!current) continue;
    if (!line.startsWith("|")) continue;

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 3) continue;
    if (cells[0] === "-" || cells[1].toLowerCase() === "task") continue;

    const title = cells[1];
    const owner = cells[2];
    if (!title || !owner) continue;
    current.tasks.push({ title, owner });
  }

  if (current) phases.push(current);
  return phases.filter((phase) => phase.title.length > 0);
}

async function seedProjectManagementFromTemplate(
  projectId: number,
  workflowSteps: Array<{ id: number; name: string; agentKey: string; stepOrder: number }>,
  templateContent: string
) {
  const existingPhases = await storage.listProjectPhases(projectId);
  if (existingPhases.length > 0) return;

  const templatePhases = parseProjectTemplate(templateContent);
  const phaseIds: number[] = [];
  let phaseOrder = 0;
  for (const phase of templatePhases) {
    const created = await storage.createProjectPhase({
      projectId,
      title: phase.title,
      description: "",
      status: phaseOrder === 0 ? "in_progress" : "not_started",
      sortOrder: phaseOrder,
    });
    phaseIds.push(created.id);
    phaseOrder += 1;
  }

  let taskOrder = 0;
  for (const step of workflowSteps) {
    await storage.createProjectTask({
      projectId,
      phaseId: null,
      title: step.name,
      description: `Agent workflow step: ${step.agentKey}`,
      ownerType: "agent",
      workflowStepId: step.id,
      status: "not_started",
      sortOrder: taskOrder,
    });
    taskOrder += 1;
  }

  for (let phaseIndex = 0; phaseIndex < templatePhases.length; phaseIndex += 1) {
    const phase = templatePhases[phaseIndex];
    for (let taskIndex = 0; taskIndex < phase.tasks.length; taskIndex += 1) {
      const task = phase.tasks[taskIndex];
      await storage.createProjectTask({
        projectId,
        phaseId: phaseIds[phaseIndex] ?? null,
        title: task.title,
        description: `Owner: ${task.owner}`,
        ownerType: "human",
        status: "not_started",
        sortOrder: taskIndex,
      });
    }
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

const STAGE_ORDER = [
  "created",
  "definition_draft",
  "definition_approved",
  "issues_draft",
  "issues_approved",
  "hypotheses_draft",
  "hypotheses_approved",
  "execution_done",
  "execution_approved",
  "summary_draft",
  "summary_approved",
  "presentation_draft",
  "complete",
];

const APPROVE_MAP: Record<string, string> = {
  definition_draft: "definition_approved",
  issues_draft: "issues_approved",
  hypotheses_draft: "hypotheses_approved",
  execution_done: "execution_approved",
  summary_draft: "summary_approved",
  presentation_draft: "complete",
};

const UNAPPROVE_MAP: Record<string, string> = {
  definition_approved: "definition_draft",
  issues_approved: "issues_draft",
  hypotheses_approved: "hypotheses_draft",
  execution_approved: "execution_done",
  summary_approved: "summary_draft",
  complete: "presentation_draft",
};

const RUN_NEXT_MAP: Record<string, string> = {
  created: "definition_draft",
  definition_approved: "issues_draft",
  issues_approved: "hypotheses_draft",
  hypotheses_approved: "execution_done",
  execution_approved: "summary_draft",
  summary_approved: "presentation_draft",
};

const DEFAULT_AGENTS = [
  { key: "project_definition", name: "Project Definition", role: "Framing", roleColor: "#F59E0B", description: "Translates vague briefs into structured, decision-based problem definitions with governing questions, success metrics, and initial hypotheses" },
  { key: "issues_tree", name: "Issues Tree", role: "Generator", roleColor: "#3B82F6", description: "Builds MECE issues tree from project objective" },
  { key: "mece_critic", name: "MECE Critic", role: "Quality Gate", roleColor: "#8B5CF6", description: "Validates MECE structure and compliance" },
  { key: "hypothesis", name: "Hypothesis", role: "Analyst", roleColor: "#0891B2", description: "Generates testable hypotheses and analysis plans" },
  { key: "execution", name: "Execution", role: "Tool Caller", roleColor: "#059669", description: "Runs scenario analysis with calculator tool" },
  { key: "summary", name: "Summary", role: "Synthesizer", roleColor: "#D97706", description: "Synthesizes findings into executive summary" },
  { key: "presentation", name: "Presentation", role: "Designer", roleColor: "#E11D48", description: "Creates professional slide deck" },
  { key: "doc_ai_review", name: "AI Review", role: "Document Reviewer", roleColor: "#F59E0B", description: "Reviews document prose for clarity, conciseness, and impact. Highlights weak sections and proposes improved rewrites." },
  { key: "doc_executive_review", name: "Executive Review", role: "Document Reviewer", roleColor: "#A855F7", description: "Flags sections that dive into technical details too early without strategic framing. Checks for Missing 'So What', Technical Too Early, Buried Insight, No Action Orientation, and Audience Mismatch." },
  { key: "doc_key_narrative", name: "Key Narrative", role: "Document Reviewer", roleColor: "#14B8A6", description: "Extracts executive-level key points from technical prose. Labels each with a narrative role: Core thesis, Supporting evidence, Risk/caveat, Action driver, or Context setter. Proposes crisp executive-ready rewrites." },
  { key: "doc_fact_check", name: "Fact Check", role: "Document Reviewer", roleColor: "#F97316", description: "Two-phase fact-checking: first spots claims that need verification (statistics, dates, named entities), then runs detailed checks on accepted candidates with confidence ratings and source suggestions." },
  { key: "des_topic_clarifier", name: "Topic Clarifier", role: "Facilitator", roleColor: "#6366F1", description: "Asks probing questions to understand the issue, scope, stakeholders, and context before analysis begins." },
  { key: "des_key_issues", name: "Key Issues Reviewer", role: "Analyst", roleColor: "#0EA5E9", description: "Identifies and structures the core issues and tensions around a topic, producing a comprehensive issues review document." },
  { key: "des_strongman_pro", name: "Strongman Pro", role: "Advocate", roleColor: "#22C55E", description: "Builds the strongest possible case FOR a position, marshalling the best arguments, evidence, and logic." },
  { key: "des_strongman_con", name: "Strongman Con", role: "Challenger", roleColor: "#EF4444", description: "Builds the strongest possible case AGAINST a position, marshalling the best counter-arguments, evidence, and risks." },
  { key: "des_centrist_summary", name: "Centrist Summariser", role: "Synthesizer", roleColor: "#A855F7", description: "Synthesizes opposing arguments into a balanced, centrist executive summary following a structured template format." },
];

const DEFAULT_WORKFLOW_STEPS = [
  { stepOrder: 1, name: "Project Definition", agentKey: "project_definition" },
  { stepOrder: 2, name: "Issues Tree", agentKey: "issues_tree" },
  { stepOrder: 3, name: "Hypotheses & Analysis Plan", agentKey: "hypothesis" },
  { stepOrder: 4, name: "Execution", agentKey: "execution" },
  { stepOrder: 5, name: "Executive Summary", agentKey: "summary" },
  { stepOrder: 6, name: "Presentation", agentKey: "presentation" },
];

const DES_WORKFLOW_STEPS = [
  { stepOrder: 1, name: "Clarify Topic", agentKey: "des_topic_clarifier" },
  { stepOrder: 2, name: "Key Issues Review", agentKey: "des_key_issues" },
  { stepOrder: 3, name: "Strongman Pro", agentKey: "des_strongman_pro" },
  { stepOrder: 4, name: "Strongman Con", agentKey: "des_strongman_con" },
  { stepOrder: 5, name: "Centrist Executive Summary", agentKey: "des_centrist_summary" },
];

const COMING_SOON_WORKFLOWS = [
  {
    name: "Deal value creation model",
    practiceCoverage: ["Deals", "Private Equity", "Strategy"],
  },
  {
    name: "Commercial due diligence accelerator",
    practiceCoverage: ["Deals", "Strategy"],
  },
  {
    name: "Risk and control narrative generator",
    practiceCoverage: ["Risk Advisory", "Audit"],
  },
  {
    name: "Board paper generator",
    practiceCoverage: ["All practices"],
  },
  {
    name: "Financial model documentation workflow",
    practiceCoverage: ["Tax", "Deals", "Infrastructure"],
  },
  {
    name: "Proposal and bid accelerator",
    practiceCoverage: ["All practices"],
  },
  {
    name: "Regulatory submission pack generator",
    practiceCoverage: ["Public sector", "Infrastructure", "Energy"],
  },
  {
    name: "Internal performance dashboard workflow",
    practiceCoverage: ["Internal operations"],
  },
  {
    name: "ESG and sustainability reporting accelerator",
    practiceCoverage: ["Risk", "Strategy", "Climate"],
  },
  {
    name: "Litigation / expert report generator",
    practiceCoverage: ["Forensics", "Disputes"],
  },
];

const DEFAULT_EXEC_SUMMARY_TEMPLATE = `<h2>Executive Summary: [Topic]</h2>

<h3>The Core Question</h3>
<p>[State the central question or decision point in one sentence.] [Provide the key context or data that frames why this matters now.]</p>

<h3>The Economic Case</h3>
<p>[State the primary economic argument, drawing from both pro and con perspectives.] [Cite the most relevant economic evidence or data point.]</p>

<h3>The Strategic Trade-off</h3>
<p>[State the main strategic tension that decision-makers must weigh.] [Reference specific evidence from the analysis that illustrates this trade-off.]</p>

<h3>Risk and Downside</h3>
<p>[State the most significant risk or downside identified.] [Provide evidence or a precedent that demonstrates this risk is material.]</p>

<h3>The Stakeholder Dimension</h3>
<p>[State how different stakeholder groups are affected differently.] [Reference specific impacts or data that highlight the distributional effects.]</p>

<h3>Pragmatic Path Forward</h3>
<p>[State the recommended centrist/balanced position in one clear sentence.] [Explain the key conditions or safeguards that make this position defensible.]</p>

<h3>Implementation Priorities</h3>
<p>[State the 2-3 immediate actions or decisions required.] [Reference the timeline or sequencing that makes these achievable.]</p>`;

type DefaultModelSeed = {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  apiConfig: any;
};

type DefaultDatasetSeed = {
  name: string;
  description: string;
  projectId: number | null;
  owner?: string;
  accessLevel?: string;
  sourceType?: string;
  sourceUrl?: string | null;
  schemaJson: Array<{ name: string; type: string }>;
  metadata: any;
  rows: Array<Record<string, string>>;
};

const DEFAULT_MODELS: DefaultModelSeed[] = [
  {
    name: "CGE Economic Model",
    description: "Run computable general equilibrium simulations and export results to charts.",
    inputSchema: {
      fields: [
        { name: "region", type: "string" },
        { name: "sector", type: "string" },
        { name: "shock_pct", type: "number" },
        { name: "horizon_years", type: "number" },
      ],
    },
    outputSchema: {
      fields: [
        { name: "gdp_series", type: "array" },
        { name: "employment_series", type: "array" },
        { name: "price_index", type: "number" },
      ],
    },
    apiConfig: {
      runtime: "python3",
      entrypoint: "server/scripts/cge_model.py",
      args: [],
      sampleInput: { region: "US", sector: "Manufacturing", shock_pct: 0.02, horizon_years: 5 },
    },
  },
  {
    name: "Input-Output Economic Model",
    description: "Estimates sector multipliers and GDP impact from demand shocks.",
    inputSchema: {
      fields: [
        { name: "industry", type: "string" },
        { name: "shock_value", type: "number" },
        { name: "region", type: "string" },
        { name: "year", type: "number" },
      ],
    },
    outputSchema: {
      fields: [
        { name: "gdp_impact", type: "number" },
        { name: "employment_impact", type: "number" },
        { name: "sector_impacts", type: "array" },
      ],
    },
    apiConfig: {
      runtime: "python3",
      entrypoint: "server/scripts/input_output_model.py",
      args: [],
      sampleInput: { industry: "Manufacturing", shock_value: 100, region: "US", year: 2026 },
    },
  },
  {
    name: "Freight Demand Forecasting Model",
    description: "Forecasts lane-level volumes and capacity risk for freight networks.",
    inputSchema: {
      fields: [
        { name: "origin", type: "string" },
        { name: "destination", type: "string" },
        { name: "mode", type: "string" },
        { name: "horizon_months", type: "number" },
        { name: "fuel_price_index", type: "number" },
      ],
    },
    outputSchema: {
      fields: [
        { name: "forecast_series", type: "array" },
        { name: "risk_band", type: "string" },
      ],
    },
    apiConfig: {
      runtime: "python3",
      entrypoint: "server/scripts/freight_forecasting_model.py",
      args: [],
      sampleInput: { origin: "Chicago", destination: "Dallas", mode: "truck", horizon_months: 6, fuel_price_index: 108 },
    },
  },
  {
    name: "Macroeconomic Forecasting Model",
    description: "Generates quarterly GDP, inflation, and unemployment scenarios.",
    inputSchema: {
      fields: [
        { name: "baseline_gdp", type: "number" },
        { name: "baseline_inflation", type: "number" },
        { name: "policy_rate", type: "number" },
        { name: "shock", type: "string" },
      ],
    },
    outputSchema: {
      fields: [
        { name: "scenario", type: "array" },
        { name: "headline", type: "string" },
      ],
    },
    apiConfig: {
      runtime: "python3",
      entrypoint: "server/scripts/macroeconomic_forecasting_model.py",
      args: [],
      sampleInput: { baseline_gdp: 2.1, baseline_inflation: 3.2, policy_rate: 4.75, shock: "energy_spike" },
    },
  },
  {
    name: "Pricing Elasticity Simulator",
    description: "Estimates volume and revenue impact of price changes.",
    inputSchema: {
      fields: [
        { name: "current_price", type: "number" },
        { name: "proposed_price", type: "number" },
        { name: "baseline_volume", type: "number" },
        { name: "elasticity", type: "number" },
      ],
    },
    outputSchema: {
      fields: [
        { name: "projected_volume", type: "number" },
        { name: "revenue_change_pct", type: "number" },
        { name: "margin_change_pct", type: "number" },
      ],
    },
    apiConfig: {
      runtime: "python3",
      entrypoint: "server/scripts/pricing_elasticity_model.py",
      args: [],
      sampleInput: { current_price: 120, proposed_price: 132, baseline_volume: 50000, elasticity: -1.2 },
    },
  },
  {
    name: "Customer Churn Risk Model",
    description: "Scores accounts for churn risk using usage and sentiment signals.",
    inputSchema: {
      fields: [
        { name: "account_tenure_months", type: "number" },
        { name: "nps", type: "number" },
        { name: "support_tickets", type: "number" },
        { name: "usage_change_pct", type: "number" },
      ],
    },
    outputSchema: {
      fields: [
        { name: "churn_probability", type: "number" },
        { name: "risk_bucket", type: "string" },
      ],
    },
    apiConfig: {
      runtime: "python3",
      entrypoint: "server/scripts/churn_risk_model.py",
      args: [],
      sampleInput: { account_tenure_months: 18, nps: 12, support_tickets: 5, usage_change_pct: -18 },
    },
  },
  {
    name: "Supply Chain Risk Stress Test",
    description: "Quantifies disruption exposure across suppliers and lead times.",
    inputSchema: {
      fields: [
        { name: "supplier_count", type: "number" },
        { name: "single_source_pct", type: "number" },
        { name: "lead_time_days", type: "number" },
        { name: "disruption_probability", type: "number" },
      ],
    },
    outputSchema: {
      fields: [
        { name: "expected_delay_days", type: "number" },
        { name: "risk_score", type: "number" },
      ],
    },
    apiConfig: {
      runtime: "python3",
      entrypoint: "server/scripts/supply_chain_risk_model.py",
      args: [],
      sampleInput: { supplier_count: 12, single_source_pct: 0.35, lead_time_days: 48, disruption_probability: 0.18 },
    },
  },
];

const DEFAULT_DATASETS: DefaultDatasetSeed[] = [
  {
    name: "Global Energy Prices Q1 2026",
    description: "Weekly energy price benchmarks across major regions.",
    projectId: null,
    owner: "Strategy Ops",
    accessLevel: "shared",
    sourceType: "api",
    sourceUrl: "https://api.example.com/energy/prices",
    schemaJson: [
      { name: "region", type: "string" },
      { name: "week", type: "string" },
      { name: "price_usd_mmbtu", type: "number" },
    ],
    metadata: { refreshCadence: "weekly", unit: "USD/MMBtu" },
    rows: [
      { region: "North America", week: "2026-W01", price_usd_mmbtu: "2.93" },
      { region: "Europe", week: "2026-W01", price_usd_mmbtu: "9.87" },
      { region: "Asia", week: "2026-W01", price_usd_mmbtu: "12.14" },
      { region: "North America", week: "2026-W02", price_usd_mmbtu: "3.05" },
    ],
  },
  {
    name: "Consumer Sentiment Pulse",
    description: "Rolling sentiment index by geography and channel.",
    projectId: null,
    owner: "Insights Lab",
    accessLevel: "shared",
    sourceType: "manual",
    sourceUrl: null,
    schemaJson: [
      { name: "week", type: "string" },
      { name: "geography", type: "string" },
      { name: "index", type: "number" },
      { name: "channel", type: "string" },
    ],
    metadata: { refreshCadence: "weekly", base: "2024=100" },
    rows: [
      { week: "2026-W01", geography: "US", index: "104.2", channel: "online" },
      { week: "2026-W01", geography: "UK", index: "98.7", channel: "retail" },
      { week: "2026-W01", geography: "DE", index: "101.3", channel: "online" },
      { week: "2026-W02", geography: "US", index: "103.5", channel: "retail" },
    ],
  },
  {
    name: "Project 5 - Retention Cohorts",
    description: "Monthly retention by acquisition cohort for Project 5.",
    projectId: 5,
    owner: "Project Team",
    accessLevel: "private",
    sourceType: "manual",
    sourceUrl: null,
    schemaJson: [
      { name: "cohort", type: "string" },
      { name: "month_0", type: "number" },
      { name: "month_1", type: "number" },
      { name: "month_2", type: "number" },
      { name: "month_3", type: "number" },
    ],
    metadata: { unit: "percent", note: "Sample cohort retention" },
    rows: [
      { cohort: "2025-10", month_0: "100", month_1: "78", month_2: "62", month_3: "55" },
      { cohort: "2025-11", month_0: "100", month_1: "81", month_2: "65", month_3: "58" },
      { cohort: "2025-12", month_0: "100", month_1: "84", month_2: "69", month_3: "60" },
    ],
  },
  {
    name: "Project 5 - Pipeline Snapshot",
    description: "Sales pipeline summary for Project 5 workstream.",
    projectId: 5,
    owner: "Project Team",
    accessLevel: "private",
    sourceType: "manual",
    sourceUrl: null,
    schemaJson: [
      { name: "account", type: "string" },
      { name: "stage", type: "string" },
      { name: "amount_usd", type: "number" },
      { name: "close_quarter", type: "string" },
      { name: "owner", type: "string" },
    ],
    metadata: { currency: "USD", snapshot: "2026-02-01" },
    rows: [
      { account: "Delta Health", stage: "Qualified", amount_usd: "120000", close_quarter: "2026-Q2", owner: "A. Chen" },
      { account: "Mosaic Retail", stage: "Proposal", amount_usd: "240000", close_quarter: "2026-Q2", owner: "J. Patel" },
      { account: "Northwind Logistics", stage: "Negotiation", amount_usd: "315000", close_quarter: "2026-Q3", owner: "S. Kim" },
      { account: "Evergreen Foods", stage: "Discovery", amount_usd: "90000", close_quarter: "2026-Q2", owner: "R. Diaz" },
    ],
  },
];

async function seedDefaultModels() {
  const existing = await storage.listModels();
  const existingByName = new Set(existing.map((m) => m.name.toLowerCase()));

  for (const model of DEFAULT_MODELS) {
    if (!existingByName.has(model.name.toLowerCase())) {
      await storage.createModel({
        projectId: null,
        name: model.name,
        description: model.description,
        inputSchema: model.inputSchema,
        outputSchema: model.outputSchema,
        apiConfig: model.apiConfig,
      });
    }
  }

  const project = await storage.getProject(5);
  if (!project) return;

  const updatedModels = await storage.listModels();
  const defaultNames = new Set(DEFAULT_MODELS.map((m) => m.name.toLowerCase()));
  for (const model of updatedModels) {
    if (defaultNames.has(model.name.toLowerCase())) {
      await storage.linkProjectModel(project.id, model.id);
    }
  }
}

async function seedDefaultDatasets() {
  const existing = await storage.listDatasets();
  const existingByName = new Set(existing.map((d) => d.name.toLowerCase()));
  const users = await storage.listUsers();
  const defaultUserId = users[0]?.id ?? null;
  const project = await storage.getProject(5);

  for (const dataset of DEFAULT_DATASETS) {
    if (dataset.projectId === 5 && !project) continue;
    if (existingByName.has(dataset.name.toLowerCase())) continue;

    const created = await storage.createDataset({
      projectId: dataset.projectId,
      lastEditedByUserId: defaultUserId,
      name: dataset.name,
      description: dataset.description,
      owner: dataset.owner,
      accessLevel: dataset.accessLevel,
      sourceType: dataset.sourceType,
      sourceUrl: dataset.sourceUrl ?? undefined,
      schemaJson: dataset.schemaJson,
      metadata: dataset.metadata,
      rowCount: dataset.rows.length,
    });

    await storage.insertDatasetRows(
      created.id,
      dataset.rows.map((row, rowIndex) => ({ rowIndex, data: row }))
    );
  }
}

async function ensureDefaults() {
  for (const a of DEFAULT_AGENTS) {
    await storage.upsertAgent(a);
  }

  const templates = await storage.listWorkflowTemplates();
  const existingTemplateNames = new Set(templates.map((t) => t.name.toLowerCase()));
  if (templates.length === 0) {
    const template = await storage.createWorkflowTemplate({
      name: "Consulting Analysis",
      description: "Standard consulting workflow: Project Definition -> Issues Tree -> Hypotheses -> Execution -> Summary -> Presentation",
    });
    existingTemplateNames.add(template.name.toLowerCase());
    for (const step of DEFAULT_WORKFLOW_STEPS) {
      await storage.addWorkflowTemplateStep({
        workflowTemplateId: template.id,
        ...step,
      });
    }
  } else {
    for (const template of templates) {
      const steps = await storage.getWorkflowTemplateSteps(template.id);
      const hasDefinition = steps.some((s) => s.agentKey === "project_definition");
      if (!hasDefinition) {
        for (const s of steps) {
          await storage.updateWorkflowTemplateStep(s.id, { stepOrder: s.stepOrder + 1 });
        }
        await storage.addWorkflowTemplateStep({
          workflowTemplateId: template.id,
          stepOrder: 1,
          name: "Project Definition",
          agentKey: "project_definition",
        });
      }
    }
  }

  const hasDES = templates.some((t) => t.name === "Desktop Executive Summary");
  if (!hasDES) {
    const desTemplate = await storage.createWorkflowTemplate({
      name: "Desktop Executive Summary",
      description: "Adversarial analysis workflow: Clarify Topic -> Key Issues -> Strongman Pro & Con -> Balanced Centrist Executive Summary",
    });
    existingTemplateNames.add(desTemplate.name.toLowerCase());
    for (const step of DES_WORKFLOW_STEPS) {
      await storage.addWorkflowTemplateStep({
        workflowTemplateId: desTemplate.id,
        ...step,
      });
    }
  }

  for (const template of COMING_SOON_WORKFLOWS) {
    if (existingTemplateNames.has(template.name.toLowerCase())) continue;
    const created = await storage.createWorkflowTemplate({
      name: template.name,
      description: "",
      practiceCoverage: template.practiceCoverage,
      timesUsed: 0,
      deploymentStatus: "planned",
      governanceMaturity: 1,
      lifecycleStatus: "coming_soon",
    });
    existingTemplateNames.add(created.name.toLowerCase());
  }

  const pipelines = await storage.listPipelines();
  const existingPipeline = pipelines.find((p) => p.name === "exec_summary_template");
  if (!existingPipeline) {
    await storage.createPipeline({
      name: "exec_summary_template",
      agentsJson: { template: DEFAULT_EXEC_SUMMARY_TEMPLATE },
    });
  }

  await storage.ensureDefaultUsers();
  await seedDefaultModels();
  await seedDefaultDatasets();
}

const MANAGEMENT_PHASE_BLUEPRINT = [
  {
    key: "discovery",
    title: "Discovery & Alignment",
    description: "Kickoff, scope alignment, and success metrics.",
  },
  {
    key: "structuring",
    title: "Problem Structuring",
    description: "Issues tree, framing, and early hypotheses.",
  },
  {
    key: "hypotheses",
    title: "Hypotheses & Analysis Plan",
    description: "Refine hypotheses and confirm analysis plan.",
  },
  {
    key: "execution",
    title: "Execution & Modeling",
    description: "Run analyses, scenarios, and modeling work.",
  },
  {
    key: "synthesis",
    title: "Synthesis & Narrative",
    description: "Translate insights into a clear story.",
  },
  {
    key: "delivery",
    title: "Client Review & Delivery",
    description: "Review, finalize, and present outcomes.",
  },
];

const MANAGEMENT_TASK_BLUEPRINT = [
  {
    phaseKey: "discovery",
    title: "Kickoff and stakeholder map",
    description: "Align on decision owners and project context.",
  },
  {
    phaseKey: "discovery",
    title: "Confirm scope, constraints, and success metrics",
    description: "Document constraints and measurable outcomes.",
  },
  {
    phaseKey: "structuring",
    title: "Review and refine issues tree",
    description: "Ensure MECE coverage and priority focus.",
  },
  {
    phaseKey: "structuring",
    title: "Align on key uncertainties",
    description: "Lock the questions that guide analysis.",
  },
  {
    phaseKey: "hypotheses",
    title: "Prioritize hypotheses for testing",
    description: "Select the highest-impact hypotheses.",
  },
  {
    phaseKey: "hypotheses",
    title: "Confirm data sources and owners",
    description: "Identify data availability and approvals.",
  },
  {
    phaseKey: "execution",
    title: "Review analysis outputs for accuracy",
    description: "QA outputs before synthesis.",
  },
  {
    phaseKey: "execution",
    title: "Resolve data gaps or assumptions",
    description: "Escalate and close missing inputs.",
  },
  {
    phaseKey: "synthesis",
    title: "Draft executive narrative",
    description: "Summarize core insights and implications.",
  },
  {
    phaseKey: "synthesis",
    title: "Validate insights with stakeholders",
    description: "Sanity check with internal sponsors.",
  },
  {
    phaseKey: "delivery",
    title: "Internal review of deck",
    description: "Finalize slides and talking points.",
  },
  {
    phaseKey: "delivery",
    title: "Capture client feedback and revisions",
    description: "Incorporate final edits from review.",
  },
];

const MANAGEMENT_CHECKPOINT_BLUEPRINT = [
  { phaseKey: "discovery", title: "Client kickoff alignment", description: "Confirm goals and success metrics." },
  { phaseKey: "structuring", title: "Issues tree review", description: "Client confirms problem structure." },
  { phaseKey: "hypotheses", title: "Hypotheses review", description: "Align on testable hypotheses." },
  { phaseKey: "execution", title: "Analysis readout", description: "Review findings and sensitivities." },
  { phaseKey: "synthesis", title: "Executive summary review", description: "Validate narrative and insights." },
  { phaseKey: "delivery", title: "Final presentation sign-off", description: "Client approves final deck." },
];

function resolvePhaseKeyForAgent(agentKey: string): string {
  if (agentKey === "project_definition") return "discovery";
  if (agentKey === "issues_tree" || agentKey === "mece_critic") return "structuring";
  if (agentKey === "hypothesis") return "hypotheses";
  if (agentKey === "execution") return "execution";
  if (agentKey === "summary") return "synthesis";
  if (agentKey === "presentation") return "delivery";
  return "discovery";
}

async function seedProjectManagement(projectId: number, workflowSteps: Array<{ id: number; name: string; agentKey: string; stepOrder: number }>) {
  const existingPhases = await storage.listProjectPhases(projectId);
  if (existingPhases.length > 0) return;

  const phaseIdMap = new Map<string, number>();
  let phaseOrder = 0;
  for (const phase of MANAGEMENT_PHASE_BLUEPRINT) {
    const created = await storage.createProjectPhase({
      projectId,
      title: phase.title,
      description: phase.description,
      status: phaseOrder === 0 ? "in_progress" : "not_started",
      sortOrder: phaseOrder,
    });
    phaseIdMap.set(phase.key, created.id);
    phaseOrder += 1;
  }

  let taskOrder = 0;
  for (const step of workflowSteps) {
    const phaseKey = resolvePhaseKeyForAgent(step.agentKey);
    await storage.createProjectTask({
      projectId,
      phaseId: phaseIdMap.get(phaseKey) || null,
      title: step.name,
      description: `Agent workflow step: ${step.agentKey}`,
      ownerType: "agent",
      workflowStepId: step.id,
      status: "not_started",
      sortOrder: taskOrder,
    });
    taskOrder += 1;
  }

  for (const task of MANAGEMENT_TASK_BLUEPRINT) {
    await storage.createProjectTask({
      projectId,
      phaseId: phaseIdMap.get(task.phaseKey) || null,
      title: task.title,
      description: task.description,
      ownerType: "human",
      status: "not_started",
      sortOrder: taskOrder,
    });
    taskOrder += 1;
  }

  let checkpointOrder = 0;
  for (const checkpoint of MANAGEMENT_CHECKPOINT_BLUEPRINT) {
    await storage.createProjectCheckpoint({
      projectId,
      phaseId: phaseIdMap.get(checkpoint.phaseKey) || null,
      title: checkpoint.title,
      description: checkpoint.description,
      status: "pending",
      sortOrder: checkpointOrder,
    });
    checkpointOrder += 1;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureDefaults();

  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      res.json(await storage.listUsers());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const { name, email, role } = req.body;
      if (!name || !email) return res.status(400).json({ error: "name and email are required" });
      const user = await storage.createUser({ name, email, role });
      res.status(201).json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/project-templates", async (_req: Request, res: Response) => {
    try {
      res.json(await loadProjectTemplates());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const { name, objective, constraints, workflowTemplateId, projectTemplateSlug } = req.body;
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      const templates = await storage.listWorkflowTemplates();
      const templateId = workflowTemplateId || templates[0]?.id;

      const project = await storage.createProject({
        name,
        objective: objective ?? "",
        constraints: constraints ?? "",
        workflowTemplateId: templateId || null,
      });

      let workflowStepsForSeed: Array<{ id: number; name: string; agentKey: string; stepOrder: number }> = [];

      if (templateId) {
        const templateSteps = await storage.getWorkflowTemplateSteps(templateId);
        await storage.createWorkflowInstance({
          projectId: project.id,
          workflowTemplateId: templateId,
          steps: templateSteps.map((s) => ({
            stepOrder: s.stepOrder,
            name: s.name,
            agentKey: s.agentKey,
            configJson: s.configJson,
          })),
        });

        const instance = await storage.getWorkflowInstance(project.id);
        if (instance) {
          const steps = await storage.getWorkflowInstanceSteps(instance.id);
          workflowStepsForSeed = steps.map((s) => ({
            id: s.id,
            name: s.name,
            agentKey: s.agentKey,
            stepOrder: s.stepOrder,
          }));
        }
      }

      if (projectTemplateSlug) {
        const templates = await loadProjectTemplates();
        const selectedTemplate = templates.find((t) => t.slug === projectTemplateSlug);
        if (selectedTemplate) {
          await seedProjectManagementFromTemplate(project.id, workflowStepsForSeed, selectedTemplate.content);
        } else if (templateId) {
          await seedProjectManagement(project.id, workflowStepsForSeed);
        }
      } else if (templateId) {
        await seedProjectManagement(project.id, workflowStepsForSeed);
      }

      res.status(201).json(project);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects", async (_req: Request, res: Response) => {
    try {
      const list = await storage.listProjects();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) return res.status(404).json({ error: "Not found" });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const payload = {
        governanceControls: req.body?.governanceControls ?? project.governanceControls,
        totalSavingsToDate: req.body?.totalSavingsToDate ?? null,
        costReductionRealisedPct: req.body?.costReductionRealisedPct ?? null,
        marginImpactToDate: req.body?.marginImpactToDate ?? null,
        projectedAnnualImpact: req.body?.projectedAnnualImpact ?? null,
      };

      const updated = await storage.updateProject(projectId, payload);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      await storage.deleteProject(projectId);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/workflow", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const instance = await storage.getWorkflowInstance(projectId);
      if (!instance) return res.json({ instance: null, steps: [] });
      const steps = await storage.getWorkflowInstanceSteps(instance.id);
      res.json({ instance, steps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/management", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const phases = await storage.listProjectPhases(projectId);
      const tasks = await storage.listProjectTasks(projectId);
      const taskAssignees = await storage.listProjectTaskAssignees(projectId);
      const assigneesByTask = new Map<number, number[]>();
      taskAssignees.forEach((assignee) => {
        if (!assigneesByTask.has(assignee.taskId)) assigneesByTask.set(assignee.taskId, []);
        assigneesByTask.get(assignee.taskId)?.push(assignee.userId);
      });
      const tasksWithAssignees = tasks.map((task) => ({
        ...task,
        assigneeIds: assigneesByTask.get(task.id) ?? (task.assigneeUserId ? [task.assigneeUserId] : []),
      }));
      const checkpoints = await storage.listProjectCheckpoints(projectId);
      const instance = await storage.getWorkflowInstance(projectId);
      const steps = instance ? await storage.getWorkflowInstanceSteps(instance.id) : [];
      res.json({ phases, tasks: tasksWithAssignees, checkpoints, workflowSteps: steps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/tasks/:taskId/assignees", async (req: Request, res: Response) => {
    try {
      const taskId = Number(req.params.taskId);
      const assigneeIds: number[] = Array.isArray(req.body?.assigneeIds)
        ? Array.from(new Set(req.body.assigneeIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))))
        : [];

      if (assigneeIds.length > 3) {
        return res.status(400).json({ error: "Maximum of 3 assignees allowed" });
      }

      await storage.setProjectTaskAssignees(taskId, assigneeIds);
      await storage.updateProjectTask(taskId, {
        ownerType: "human",
        assigneeUserId: assigneeIds[0] ?? null,
        workflowStepId: null,
      });

      res.json({ success: true, assigneeIds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/phases", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { title, description, status, sortOrder } = req.body;
      if (!title) return res.status(400).json({ error: "title is required" });
      const created = await storage.createProjectPhase({
        projectId,
        title,
        description,
        status,
        sortOrder,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/phases/:phaseId", async (req: Request, res: Response) => {
    try {
      const phaseId = Number(req.params.phaseId);
      const updated = await storage.updateProjectPhase(phaseId, req.body || {});
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id/phases/:phaseId", async (req: Request, res: Response) => {
    try {
      const phaseId = Number(req.params.phaseId);
      await storage.deleteProjectPhase(phaseId);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/tasks", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { title, description, phaseId, ownerType, assigneeUserId, workflowStepId, status, dueDate, sortOrder } = req.body;
      if (!title) return res.status(400).json({ error: "title is required" });
      const created = await storage.createProjectTask({
        projectId,
        title,
        description,
        phaseId,
        ownerType,
        assigneeUserId,
        workflowStepId,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/tasks/:taskId", async (req: Request, res: Response) => {
    try {
      const taskId = Number(req.params.taskId);
      const currentTasks = await storage.listProjectTasks(Number(req.params.id));
      const current = currentTasks.find((t) => t.id === taskId);
      if (!current) return res.status(404).json({ error: "Task not found" });

      const payload = { ...req.body };
      if (current.ownerType === "agent") {
        delete payload.status;
      }
      if (payload.dueDate) payload.dueDate = new Date(payload.dueDate);

      const updated = await storage.updateProjectTask(taskId, payload);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id/tasks/:taskId", async (req: Request, res: Response) => {
    try {
      const taskId = Number(req.params.taskId);
      await storage.deleteProjectTask(taskId);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/checkpoints", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { title, description, phaseId, status, linkedDeliverableId, dueDate, sortOrder } = req.body;
      if (!title) return res.status(400).json({ error: "title is required" });
      const created = await storage.createProjectCheckpoint({
        projectId,
        title,
        description,
        phaseId,
        status,
        linkedDeliverableId,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/checkpoints/:checkpointId", async (req: Request, res: Response) => {
    try {
      const checkpointId = Number(req.params.checkpointId);
      const payload = { ...req.body };
      if (payload.dueDate) payload.dueDate = new Date(payload.dueDate);
      const updated = await storage.updateProjectCheckpoint(checkpointId, payload);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id/checkpoints/:checkpointId", async (req: Request, res: Response) => {
    try {
      const checkpointId = Number(req.params.checkpointId);
      await storage.deleteProjectCheckpoint(checkpointId);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/deliverables", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const dels = await storage.getDeliverables(projectId);
      res.json(dels);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/run-logs", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const logs = await storage.getRunLogs(projectId);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/workflow/steps/:stepId", async (req: Request, res: Response) => {
    try {
      const stepId = Number(req.params.stepId);
      const step = await storage.getWorkflowInstanceStep(stepId);
      if (!step) return res.status(404).json({ error: "Step not found" });
      const stepDeliverables = await storage.getStepDeliverables(stepId);
      res.json({ step, deliverables: stepDeliverables });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const STAGE_MAP: Record<string, string> = {
    project_definition: "definition_draft",
    issues_tree: "issues_draft",
    hypothesis: "hypotheses_draft",
    execution: "execution_done",
    summary: "summary_draft",
    presentation: "presentation_draft",
  };

  async function persistAgentResults(
    projectId: number,
    agentKey: string,
    deliverableContent: any
  ) {
    if (agentKey === "issues_tree") {
      const issues = deliverableContent?.issues || deliverableContent;
      if (Array.isArray(issues)) {
        const version = (await storage.getLatestIssueVersion(projectId)) + 1;
        const idMap = new Map<string, number>();
        let remaining = [...issues];
        let pass = 0;
        while (remaining.length > 0 && pass < 10) {
          pass++;
          const canInsert = remaining.filter((n: any) => !n.parentId || idMap.has(n.parentId));
          const cannotInsert = remaining.filter((n: any) => n.parentId && !idMap.has(n.parentId));
          if (canInsert.length === 0) break;
          const insertedNodes = await storage.insertIssueNodes(
            projectId, version,
            canInsert.map((n: any) => ({
              parentId: n.parentId ? (idMap.get(n.parentId) || null) : null,
              text: n.text, priority: n.priority,
            }))
          );
          canInsert.forEach((n: any, i: number) => { idMap.set(n.id, insertedNodes[i].id); });
          remaining = cannotInsert;
        }
      }
    } else if (agentKey === "hypothesis") {
      const result = deliverableContent;
      if (result?.hypotheses) {
        const version = (await storage.getLatestHypothesisVersion(projectId)) + 1;
        const insertedHyps = await storage.insertHypotheses(
          projectId, version,
          result.hypotheses.map((h: any) => ({
            issueNodeId: null, statement: h.statement, metric: h.metric, dataSource: h.dataSource, method: h.method,
          }))
        );
        if (result.analysisPlan) {
          await storage.insertAnalysisPlan(
            projectId,
            result.analysisPlan.map((p: any) => ({
              hypothesisId: insertedHyps[p.hypothesisIndex]?.id || insertedHyps[0]?.id || null,
              method: p.method, parametersJson: p.parameters, requiredDataset: p.requiredDataset,
            }))
          );
        }
      }
    } else if (agentKey === "execution") {
      const results = Array.isArray(deliverableContent) ? deliverableContent : [];
      for (const r of results) {
        await storage.insertModelRun(projectId, r.toolName, r.inputs, r.outputs);
      }
    } else if (agentKey === "summary") {
      if (deliverableContent?.summaryText) {
        const version = (await storage.getLatestNarrativeVersion(projectId)) + 1;
        await storage.insertNarrative(projectId, version, deliverableContent.summaryText);
      }
    } else if (agentKey === "presentation") {
      if (deliverableContent?.slides) {
        const slideVersion = (await storage.getLatestSlideVersion(projectId)) + 1;
        await storage.insertSlides(
          projectId, slideVersion,
          deliverableContent.slides.map((s: any) => ({
            slideIndex: s.slideIndex, layout: s.layout, title: s.title,
            subtitle: s.subtitle || undefined, bodyJson: s.bodyJson, notesText: s.notesText || undefined,
          }))
        );
      }
    }
  }

  async function executeStepAgent(
    projectId: number,
    stepId: number,
    onProgress: ProgressCallback = () => {}
  ): Promise<{ project: any; step: any; deliverableTitle: string }> {
    const project = await storage.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const step = await storage.getWorkflowInstanceStep(stepId);
    if (!step) throw new Error("Step not found");

    await storage.updateWorkflowInstanceStep(stepId, { status: "running" });

    const modelUsed = getModelUsed();
    const runLog = await storage.insertRunLog(
      projectId,
      step.agentKey,
      { stepId, agentKey: step.agentKey },
      modelUsed
    );

    try {
      const result = await runWorkflowStep(projectId, step.agentKey, onProgress, stepId);
      const { deliverableContent, deliverableTitle, awaitingConfirmation } = result;

      await persistAgentResults(projectId, step.agentKey, deliverableContent);

      const newStage = STAGE_MAP[step.agentKey];
      if (newStage) {
        await storage.updateProjectStage(projectId, newStage);
      }

      if (deliverableContent) {
        await storage.createDeliverable({
          projectId, stepId, title: deliverableTitle, contentJson: deliverableContent,
        });
      }

      const stepStatus = awaitingConfirmation ? "awaiting_confirmation" : "completed";
      await storage.updateWorkflowInstanceStep(stepId, {
        status: stepStatus,
        outputSummary: { title: deliverableTitle },
      });
      await storage.updateRunLog(runLog.id, deliverableContent, "success");

      const updatedProject = await storage.getProject(projectId);
      const instance = await storage.getWorkflowInstance(projectId);
      if (instance) {
        await storage.updateWorkflowInstanceCurrentStep(instance.id, step.stepOrder);
      }

      return {
        project: updatedProject,
        step: await storage.getWorkflowInstanceStep(stepId),
        deliverableTitle,
      };
    } catch (agentErr: any) {
      await storage.updateWorkflowInstanceStep(stepId, { status: "failed" });
      await storage.updateRunLog(runLog.id, null, "failed", agentErr.message);
      throw new Error(`Agent failed: ${agentErr.message}`);
    }
  }

  app.post("/api/projects/:id/workflow/steps/:stepId/run", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const stepId = Number(req.params.stepId);
      const result = await executeStepAgent(projectId, stepId);
      res.json({ project: result.project, step: result.step });
    } catch (err: any) {
      const status = err.message?.startsWith("Agent failed:") ? 500 : err.message === "Project not found" || err.message === "Step not found" ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/workflow/steps/:stepId/run-stream", async (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    const stepId = Number(req.params.stepId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    req.on("close", () => { closed = true; });

    function sendSSE(type: string, content: string) {
      if (closed) return;
      const payload = JSON.stringify({ type, content, timestamp: Date.now() });
      res.write(`data: ${payload}\n\n`);
    }

    sendSSE("connected", "Stream connected");

    const onProgress: ProgressCallback = (message: string, type?: string) => {
      sendSSE(type || "progress", message);
      storage.insertStepChatMessage({
        stepId,
        role: "assistant",
        content: message,
        messageType: type || "progress",
      }).catch(() => {});
    };

    try {
      const result = await executeStepAgent(projectId, stepId, onProgress);
      
      const stepDeliverables = await storage.getStepDeliverables(stepId);
      if (stepDeliverables.length > 0) {
        const latestDel = stepDeliverables[0];
        await storage.insertStepChatMessage({
          stepId,
          role: "assistant",
          content: JSON.stringify(latestDel.contentJson),
          messageType: "deliverable",
          metadata: { deliverableId: latestDel.id, title: latestDel.title, version: latestDel.version, agentKey: result.step?.agentKey },
        });
      }
      
      sendSSE("complete", JSON.stringify({ deliverableTitle: result.deliverableTitle, project: result.project, step: result.step }));
    } catch (err: any) {
      sendSSE("error", err.message || "Unknown error");
    } finally {
      if (!closed) res.end();
    }
  });

  app.get("/api/projects/:id/workflow/steps/:stepId/chat", async (req: Request, res: Response) => {
    try {
      const stepId = Number(req.params.stepId);
      const messages = await storage.getStepChatMessages(stepId);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/workflow/steps/:stepId/chat", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const stepId = Number(req.params.stepId);
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "message is required" });

      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const step = await storage.getWorkflowInstanceStep(stepId);
      if (!step) return res.status(404).json({ error: "Step not found" });

      await storage.insertStepChatMessage({
        stepId,
        role: "user",
        content: message,
        messageType: "message",
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let closed = false;
      req.on("close", () => { closed = true; });

      function sendSSE(type: string, content: string) {
        if (closed) return;
        res.write(`data: ${JSON.stringify({ type, content, timestamp: Date.now() })}\n\n`);
      }

      sendSSE("connected", "Stream connected");

      const stepDeliverables = await storage.getStepDeliverables(stepId);
      const currentDeliverable = stepDeliverables[0];

      if (currentDeliverable) {
        const onProgress: ProgressCallback = (msg: string, type?: string) => {
          sendSSE(type || "progress", msg);
        };

        const onToken = (token: string) => {
          sendSSE("token", token);
        };

        const refined = await refineWithLangGraphStreaming(
          step.agentKey,
          currentDeliverable.contentJson,
          message,
          { objective: project.objective, constraints: project.constraints },
          onProgress,
          onToken,
        );

        await storage.updateDeliverable(currentDeliverable.id, { contentJson: refined });

        await storage.insertStepChatMessage({
          stepId,
          role: "assistant",
          content: JSON.stringify(refined),
          messageType: "deliverable",
          metadata: { deliverableId: currentDeliverable.id, title: currentDeliverable.title, version: currentDeliverable.version, agentKey: step.agentKey },
        });

        sendSSE("complete", JSON.stringify({
          deliverableContent: refined,
          deliverableId: currentDeliverable.id,
          title: currentDeliverable.title,
          version: currentDeliverable.version,
          agentKey: step.agentKey,
        }));
      } else {
        sendSSE("progress", "No deliverable found to refine. Please run the agent first.");
        sendSSE("complete", JSON.stringify({ noDeliverable: true }));

        await storage.insertStepChatMessage({
          stepId,
          role: "assistant",
          content: "No deliverable found to refine. Please run the agent first.",
          messageType: "message",
        });
      }

      if (!closed) res.end();
    } catch (err: any) {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", content: err.message || "Unknown error", timestamp: Date.now() })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/projects/:id/workflow/steps/:stepId/approve", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const stepId = Number(req.params.stepId);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      await storage.updateWorkflowInstanceStep(stepId, { status: "approved" });
      await storage.lockDeliverables(stepId);

      const nextStage = APPROVE_MAP[project.stage];
      if (nextStage) {
        await storage.updateProjectStage(projectId, nextStage);
      }

      const updatedProject = await storage.getProject(projectId);
      res.json(updatedProject);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/workflow/steps/:stepId/unapprove", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const stepId = Number(req.params.stepId);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const step = await storage.getWorkflowInstanceStep(stepId);
      if (!step) return res.status(404).json({ error: "Step not found" });
      if (step.status !== "approved") {
        return res.status(400).json({ error: "Step is not approved" });
      }

      const instance = await storage.getWorkflowInstance(projectId);
      if (instance) {
        const steps = await storage.getWorkflowInstanceSteps(instance.id);
        const laterSteps = steps.filter((s) => s.stepOrder > step.stepOrder && s.status !== "not_started");
        if (laterSteps.length > 0) {
          return res.status(400).json({ error: "Cannot unapprove: later steps have already been started. Unapprove them first." });
        }
      }

      await storage.updateWorkflowInstanceStep(stepId, { status: "completed" });
      await storage.unlockDeliverables(stepId);

      const prevStage = UNAPPROVE_MAP[project.stage];
      if (prevStage) {
        await storage.updateProjectStage(projectId, prevStage);
      }

      const updatedProject = await storage.getProject(projectId);
      res.json(updatedProject);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/workflow/steps/:stepId/confirm-positions", async (req: Request, res: Response) => {
    try {
      const stepId = Number(req.params.stepId);
      const { sideA, sideB } = req.body;

      if (!sideA || !sideB) {
        return res.status(400).json({ error: "Both sideA and sideB are required" });
      }

      const step = await storage.getWorkflowInstanceStep(stepId);
      if (!step) return res.status(404).json({ error: "Step not found" });
      if (step.agentKey !== "des_topic_clarifier") {
        return res.status(400).json({ error: "Position confirmation is only for the Topic Clarifier step" });
      }
      if (step.status !== "awaiting_confirmation") {
        return res.status(400).json({ error: "Step is not awaiting confirmation" });
      }

      const existingConfig = (step.configJson as any) || {};
      await storage.updateWorkflowInstanceStep(stepId, {
        status: "completed",
        configJson: {
          ...existingConfig,
          confirmedSideA: sideA.trim(),
          confirmedSideB: sideB.trim(),
        },
      });

      await storage.insertStepChatMessage({
        stepId,
        role: "assistant",
        content: `Positions confirmed.\n**Side A (Pro):** ${sideA.trim()}\n**Side B (Con):** ${sideB.trim()}`,
        messageType: "status",
      });

      const updatedStep = await storage.getWorkflowInstanceStep(stepId);
      res.json({ step: updatedStep });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/run-next", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const nextStage = RUN_NEXT_MAP[project.stage];
      if (!nextStage) {
        return res.status(400).json({ error: `Cannot run next stage from "${project.stage}".` });
      }

      const instance = await storage.getWorkflowInstance(projectId);
      if (instance) {
        const steps = await storage.getWorkflowInstanceSteps(instance.id);
        const agentKeyMap: Record<string, string> = {
          definition_draft: "project_definition",
          issues_draft: "issues_tree",
          hypotheses_draft: "hypothesis",
          execution_done: "execution",
          summary_draft: "summary",
          presentation_draft: "presentation",
        };
        const targetAgent = agentKeyMap[nextStage];
        const targetStep = steps.find((s) => s.agentKey === targetAgent);
        if (targetStep) {
          const stepRunRes = await fetch(`http://localhost:5000/api/projects/${projectId}/workflow/steps/${targetStep.id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const result = await stepRunRes.json();
          if (!stepRunRes.ok) {
            return res.status(stepRunRes.status).json(result);
          }
          return res.json(result.project || await storage.getProject(projectId));
        }
      }

      const agentKeyForStage: Record<string, string> = {
        definition_draft: "project_definition",
        issues_draft: "issues_tree",
        hypotheses_draft: "hypothesis",
        execution_done: "execution",
        summary_draft: "summary",
        presentation_draft: "presentation",
      };
      const agentKey = agentKeyForStage[nextStage];
      const modelUsed = getModelUsed();
      const runLog = await storage.insertRunLog(projectId, nextStage, { currentStage: project.stage }, modelUsed);

      try {
        const result = await runWorkflowStep(projectId, agentKey, () => {});
        await persistAgentResults(projectId, agentKey, result.deliverableContent);
        await storage.updateRunLog(runLog.id, result.deliverableContent, "success");
        const updated = await storage.updateProjectStage(projectId, nextStage);
        res.json(updated);
      } catch (agentErr: any) {
        await storage.updateRunLog(runLog.id, null, "failed", agentErr.message);
        await storage.updateProjectStage(projectId, project.stage);
        res.status(500).json({ error: `Agent failed: ${agentErr.message}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/approve", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const nextStage = APPROVE_MAP[project.stage];
      if (!nextStage) {
        return res.status(400).json({ error: `Cannot approve stage "${project.stage}".` });
      }
      const updated = await storage.updateProjectStage(projectId, nextStage);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/redo", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { step } = req.body;
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const stageMap: Record<string, string> = {
        definition: "created", issues: "definition_approved", hypotheses: "issues_approved", execution: "hypotheses_approved",
        summary: "execution_approved", presentation: "summary_approved",
      };
      const targetStage = stageMap[step];
      if (!targetStage) return res.status(400).json({ error: `Invalid step "${step}"` });
      const currentIdx = STAGE_ORDER.indexOf(project.stage);
      const stepDraftStages: Record<string, string> = {
        definition: "definition_draft", issues: "issues_draft", hypotheses: "hypotheses_draft", execution: "execution_done",
        summary: "summary_draft", presentation: "presentation_draft",
      };
      const draftIdx = STAGE_ORDER.indexOf(stepDraftStages[step]);
      if (currentIdx < draftIdx) return res.status(400).json({ error: `Cannot redo "${step}" — hasn't been run yet.` });
      const updated = await storage.updateProjectStage(projectId, targetStage);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/artifacts", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const [issues, hyps, plans, runs, narrs, slds] = await Promise.all([
        storage.getIssueNodes(projectId), storage.getHypotheses(projectId),
        storage.getAnalysisPlan(projectId), storage.getModelRuns(projectId),
        storage.getNarratives(projectId), storage.getSlides(projectId),
      ]);
      res.json({ issueNodes: issues, hypotheses: hyps, analysisPlan: plans, modelRuns: runs, narratives: narrs, slides: slds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/logs", async (req: Request, res: Response) => {
    try {
      const logs = await storage.getRunLogs(Number(req.params.id));
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/run-logs", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const logs = await storage.listRunLogs(limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/workflows", async (_req: Request, res: Response) => {
    try {
      const templates = await storage.listWorkflowTemplates();
      const result = [];
      for (const t of templates) {
        const steps = await storage.getWorkflowTemplateSteps(t.id);
        result.push({ ...t, steps });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      const template = await storage.getWorkflowTemplate(Number(req.params.id));
      if (!template) return res.status(404).json({ error: "Not found" });
      const steps = await storage.getWorkflowTemplateSteps(template.id);
      res.json({ ...template, steps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/workflows", async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        steps,
        practiceCoverage,
        timesUsed,
        deploymentStatus,
        governanceMaturity,
        baselineCost,
        aiCost,
        lifecycleStatus,
        comingSoonEta,
      } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const template = await storage.createWorkflowTemplate({
        name,
        description,
        practiceCoverage,
        timesUsed,
        deploymentStatus,
        governanceMaturity,
        baselineCost,
        aiCost,
        lifecycleStatus,
        comingSoonEta,
      });
      if (steps && Array.isArray(steps)) {
        for (const s of steps) {
          await storage.addWorkflowTemplateStep({
            workflowTemplateId: template.id,
            stepOrder: s.stepOrder,
            name: s.name,
            agentKey: s.agentKey,
            description: s.description,
            configJson: s.configJson,
          });
        }
      }
      const allSteps = await storage.getWorkflowTemplateSteps(template.id);
      res.status(201).json({ ...template, steps: allSteps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        steps,
        practiceCoverage,
        timesUsed,
        deploymentStatus,
        governanceMaturity,
        baselineCost,
        aiCost,
        lifecycleStatus,
        comingSoonEta,
      } = req.body;
      const template = await storage.updateWorkflowTemplate(Number(req.params.id), {
        name,
        description,
        practiceCoverage,
        timesUsed,
        deploymentStatus,
        governanceMaturity,
        baselineCost,
        aiCost,
        lifecycleStatus,
        comingSoonEta,
      });
      let allSteps;
      if (steps && Array.isArray(steps)) {
        allSteps = await storage.replaceWorkflowTemplateSteps(template.id, steps);
      } else {
        allSteps = await storage.getWorkflowTemplateSteps(template.id);
      }
      res.json({ ...template, steps: allSteps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteWorkflowTemplate(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/agents", async (_req: Request, res: Response) => {
    try {
      const agentList = await storage.listAgents();
      res.json(agentList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/agents/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        const agent = await storage.getAgentByKey(req.params.id as string);
        if (!agent) return res.status(404).json({ error: "Not found" });
        return res.json(agent);
      }
      const agent = await storage.getAgent(id);
      if (!agent) return res.status(404).json({ error: "Not found" });
      res.json(agent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/agents/:id", async (req: Request, res: Response) => {
    try {
      const agent = await storage.upsertAgent({ key: req.params.id, ...req.body });
      res.json(agent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/data/datasets", async (_req: Request, res: Response) => {
    try {
      const ds = await storage.listDatasets();
      res.json(ds);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/data/datasets", async (req: Request, res: Response) => {
    try {
      const { projectId, lastEditedByUserId, name, description, owner, accessLevel, sourceType, sourceUrl, schemaJson, metadata } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const ds = await storage.createDataset({ projectId, lastEditedByUserId, name, description, owner, accessLevel, sourceType, sourceUrl, schemaJson, metadata });
      res.status(201).json(ds);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/data/datasets/:id", async (req: Request, res: Response) => {
    try {
      const ds = await storage.getDataset(Number(req.params.id));
      if (!ds) return res.status(404).json({ error: "Not found" });
      res.json(ds);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/data/datasets/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getDataset(id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const { name, description, sourceType, sourceUrl, schemaJson, metadata, rowCount, lastEditedByUserId } = req.body;
      const ds = await storage.updateDataset(id, { name, description, sourceType, sourceUrl, schemaJson, metadata, rowCount, lastEditedByUserId });
      res.json(ds);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/data/datasets/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getDataset(id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      await storage.deleteDataset(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/data/datasets/:id/upload-csv", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getDataset(id);
      if (!existing) return res.status(404).json({ error: "Dataset not found" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const csvText = req.file.buffer.toString("utf-8");
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return res.status(400).json({ error: "CSV must have a header row and at least one data row" });

      const headers = parseCSVLine(lines[0]);
      const rows: Array<{ rowIndex: number; data: any }> = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });
        rows.push({ rowIndex: i - 1, data: row });
      }

      await storage.insertDatasetRows(id, rows);
      const schemaJson = headers.map((h) => ({ name: h, type: "string" }));
      const lastEditedByUserId = req.body?.lastEditedByUserId ? Number(req.body.lastEditedByUserId) : undefined;
      const ds = await storage.updateDataset(id, {
        sourceType: "csv",
        schemaJson,
        rowCount: rows.length,
        lastEditedByUserId,
      });
      res.json({ dataset: ds, rowCount: rows.length, columns: headers });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/data/datasets/:id/rows", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getDataset(id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const limit = Math.min(Number(req.query.limit) || 100, 1000);
      const offset = Number(req.query.offset) || 0;
      const rows = await storage.getDatasetRows(id, limit, offset);
      res.json({ rows, total: existing.rowCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/data/models", async (_req: Request, res: Response) => {
    try {
      const ms = await storage.listModels();
      res.json(ms);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/models/cge/run-stream", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let closed = false;
    const scriptPath = path.resolve(process.cwd(), "server", "scripts", "cge_model.py");
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const python = spawn("python3", [scriptPath]);

    function sendSSE(type: string, message: string) {
      if (closed) return;
      res.write(`event: ${type}\n`);
      res.write(`data: ${message}\n\n`);
    }

    sendSSE("connected", "CGE model stream connected");

    python.stdout.setEncoding("utf-8");
    let stdoutBuffer = "";

    const handleCgeLine = (line: string) => {
      const [rawType, ...rest] = line.split(":");
      const payload = rest.join(":");
      if (rawType === "RESULT") {
        (async () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(payload);
          } catch {
            parsed = { headline: "CGE run complete" };
          }

          if (projectId && Number.isFinite(projectId)) {
            const { columns, rows } = buildCgeSpreadsheetRows(parsed);
            if (rows.length > 0) {
              const name = `CGE Outputs ${new Date().toISOString().slice(0, 10)}`;
              const dataset = await storage.createDataset({
                projectId,
                name,
                sourceType: "spreadsheet",
                schemaJson: columns.map((col) => ({ name: col, type: "string" })),
                rowCount: rows.length,
              });
              await storage.insertDatasetRows(dataset.id, rows);
              parsed.spreadsheetId = dataset.id;
              parsed.spreadsheetName = dataset.name;
            }
          }

          sendSSE("complete", JSON.stringify(parsed));
          if (!closed) {
            closed = true;
            res.end();
          }
        })().catch((err) => {
          sendSSE("error", err.message || "Failed to save CGE outputs");
          if (!closed) {
            closed = true;
            res.end();
          }
        });
        return;
      }
      if (rawType === "STATUS" || rawType === "PROGRESS") {
        sendSSE("progress", payload.trim());
        return;
      }
      sendSSE("progress", line.trim());
    };

    python.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      lines.filter(Boolean).forEach(handleCgeLine);
    });

    python.stderr.setEncoding("utf-8");
    python.stderr.on("data", (chunk: string) => {
      sendSSE("progress", chunk.trim());
    });

    python.on("error", (err) => {
      sendSSE("error", err.message || "Failed to run CGE model");
      if (!closed) {
        closed = true;
        res.end();
      }
    });

    python.on("close", () => {
      if (!closed && stdoutBuffer.trim()) {
        handleCgeLine(stdoutBuffer.trim());
        stdoutBuffer = "";
      }
      if (!closed) {
        sendSSE("complete", JSON.stringify({ headline: "CGE run complete" }));
        closed = true;
        res.end();
      }
    });

    res.on("close", () => {
      closed = true;
      python.kill("SIGTERM");
    });
  });

  app.post("/api/data/models", async (req: Request, res: Response) => {
    try {
      const { projectId, lastEditedByUserId, name, description, inputSchema, outputSchema, apiConfig } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const m = await storage.createModel({ projectId, lastEditedByUserId, name, description, inputSchema, outputSchema, apiConfig });
      res.status(201).json(m);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/data/models/:id", async (req: Request, res: Response) => {
    try {
      const m = await storage.getModel(Number(req.params.id));
      if (!m) return res.status(404).json({ error: "Not found" });
      res.json(m);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/models/:id/run", async (req: Request, res: Response) => {
    try {
      const modelId = Number(req.params.id);
      const model = await storage.getModel(modelId);
      if (!model) return res.status(404).json({ error: "Model not found" });
      if (!model.apiConfig) return res.status(400).json({ error: "Model has no apiConfig" });

      const rawOutput = await runPythonModel(model.apiConfig as PythonModelConfig, req.body || {});
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawOutput);
      } catch {
        parsed = { output: rawOutput };
      }

      res.json({ modelId: model.id, name: model.name, output: parsed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/datasets", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const items = await storage.listProjectDatasets(projectId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/datasets/shared", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const items = await storage.listSharedDatasetsForProject(projectId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/datasets/link", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { datasetId } = req.body;
      if (!datasetId) return res.status(400).json({ error: "datasetId is required" });
      const ds = await storage.getDataset(Number(datasetId));
      if (!ds) return res.status(404).json({ error: "Dataset not found" });
      if (ds.projectId) return res.status(400).json({ error: "Dataset is project-owned" });
      const link = await storage.linkProjectDataset(projectId, Number(datasetId));
      res.json(link);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id/datasets/link/:datasetId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const datasetId = Number(req.params.datasetId);
      await storage.unlinkProjectDataset(projectId, datasetId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/models", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const items = await storage.listProjectModels(projectId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/models/shared", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const items = await storage.listSharedModelsForProject(projectId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/models/link", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { modelId } = req.body;
      if (!modelId) return res.status(400).json({ error: "modelId is required" });
      const m = await storage.getModel(Number(modelId));
      if (!m) return res.status(404).json({ error: "Model not found" });
      if (m.projectId) return res.status(400).json({ error: "Model is project-owned" });
      const link = await storage.linkProjectModel(projectId, Number(modelId));
      res.json(link);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id/models/link/:modelId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const modelId = Number(req.params.modelId);
      await storage.unlinkProjectModel(projectId, modelId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/agent-configs", async (_req: Request, res: Response) => {
    try {
      const configs = await storage.getAllAgentConfigs();
      const defaults = getDefaultConfigs();
      const merged = defaults.map((d) => {
        const saved = configs.find((c) => c.agentType === d.agentType);
        return saved || { ...d, id: 0, updatedAt: new Date() };
      });
      res.json(merged);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/agent-configs/:agentType", async (req: Request, res: Response) => {
    try {
      const agentType = req.params.agentType as string;
      const {
        systemPrompt,
        model,
        maxTokens,
        temperature,
        topP,
        presencePenalty,
        frequencyPenalty,
        maxIterations,
        toolWhitelist,
        toolCallBudget,
        retryCount,
        timeoutMs,
        memoryScope,
        outputSchema,
        safetyRules,
        stopSequences,
        streaming,
        parallelism,
        cacheTtlSeconds,
      } = req.body;
      if (!systemPrompt) return res.status(400).json({ error: "systemPrompt is required" });
      const config = await storage.upsertAgentConfig({
        agentType,
        systemPrompt,
        model: model || "gpt-5-nano",
        maxTokens: maxTokens || 8192,
        temperature,
        topP,
        presencePenalty,
        frequencyPenalty,
        maxIterations,
        toolWhitelist,
        toolCallBudget,
        retryCount,
        timeoutMs,
        memoryScope,
        outputSchema,
        safetyRules,
        stopSequences,
        streaming,
        parallelism,
        cacheTtlSeconds,
      });
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/agents/detail/:key", async (req: Request, res: Response) => {
    try {
      const keyParam = req.params.key as string;
      const agent = await storage.getAgentByKey(keyParam);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const saved = await storage.getAgentConfig(keyParam);
      res.json({
        ...agent,
        systemPrompt: saved?.systemPrompt || agent.promptTemplate || (DEFAULT_PROMPTS as any)[keyParam] || "",
        configModel: saved?.model || agent.model,
        configMaxTokens: saved?.maxTokens || agent.maxTokens,
        configTemperature: saved?.temperature ?? 0.2,
        configTopP: saved?.topP ?? 1,
        configPresencePenalty: saved?.presencePenalty ?? 0,
        configFrequencyPenalty: saved?.frequencyPenalty ?? 0,
        configMaxIterations: saved?.maxIterations ?? 4,
        configToolWhitelist: saved?.toolWhitelist ?? "",
        configToolCallBudget: saved?.toolCallBudget ?? 6,
        configRetryCount: saved?.retryCount ?? 1,
        configTimeoutMs: saved?.timeoutMs ?? 60000,
        configMemoryScope: saved?.memoryScope ?? "project",
        configOutputSchema: saved?.outputSchema ?? "",
        configSafetyRules: saved?.safetyRules ?? "",
        configStopSequences: saved?.stopSequences ?? "",
        configStreaming: saved?.streaming ?? false,
        configParallelism: saved?.parallelism ?? 1,
        configCacheTtlSeconds: saved?.cacheTtlSeconds ?? 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pipelines", async (_req: Request, res: Response) => {
    try { res.json(await storage.listPipelines()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/pipelines", async (req: Request, res: Response) => {
    try {
      const { name, agentsJson } = req.body;
      if (!name || !agentsJson) return res.status(400).json({ error: "name and agentsJson are required" });
      res.status(201).json(await storage.createPipeline({ name, agentsJson }));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/pipelines/:id", async (req: Request, res: Response) => {
    try {
      const p = await storage.getPipeline(Number(req.params.id));
      if (!p) return res.status(404).json({ error: "Not found" });
      res.json(p);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.put("/api/pipelines/:id", async (req: Request, res: Response) => {
    try { res.json(await storage.updatePipeline(Number(req.params.id), req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/pipelines/:id", async (req: Request, res: Response) => {
    try { await storage.deletePipeline(Number(req.params.id)); res.json({ success: true }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/exec-summary-template", async (_req: Request, res: Response) => {
    try {
      const pipelines = await storage.listPipelines();
      const templatePipeline = pipelines.find((p) => p.name === "exec_summary_template");
      if (!templatePipeline) {
        return res.json({ template: DEFAULT_EXEC_SUMMARY_TEMPLATE });
      }
      const agentsJson = templatePipeline.agentsJson as any;
      res.json({ id: templatePipeline.id, template: agentsJson.template || DEFAULT_EXEC_SUMMARY_TEMPLATE });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/exec-summary-template", async (req: Request, res: Response) => {
    try {
      const { template } = req.body;
      if (!template) return res.status(400).json({ error: "template is required" });
      const pipelines = await storage.listPipelines();
      const existing = pipelines.find((p) => p.name === "exec_summary_template");
      if (existing) {
        const updated = await storage.updatePipeline(existing.id, { agentsJson: { template } });
        res.json({ id: updated.id, template });
      } else {
        const created = await storage.createPipeline({ name: "exec_summary_template", agentsJson: { template } });
        res.json({ id: created.id, template });
      }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      res.json(await storage.listDocuments(projectId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents", async (req: Request, res: Response) => {
    try {
      const { projectId, lastEditedByUserId, title, content, contentJson } = req.body;
      res.status(201).json(await storage.createDocument({ projectId, lastEditedByUserId, title, content, contentJson }));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      res.json(doc);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      res.json(await storage.updateDocument(Number(req.params.id), req.body));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteDocument(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/documents/:id/comments", async (req: Request, res: Response) => {
    try {
      res.json(await storage.listComments(Number(req.params.id)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents/:id/comments", async (req: Request, res: Response) => {
    try {
      const { from, to, content, type, proposedText, aiReply } = req.body;
      res.status(201).json(await storage.createComment({
        documentId: Number(req.params.id),
        from, to, content,
        type, proposedText, aiReply,
      }));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/comments/:id", async (req: Request, res: Response) => {
    try {
      res.json(await storage.updateComment(Number(req.params.id), req.body));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/comments/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteComment(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents/:id/review", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const comments = await reviewDocument(doc);
      res.json(comments);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents/:id/executive-review", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const comments = await executiveReviewDocument(doc);
      res.json(comments);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents/:id/narrative-review", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const comments = await narrativeReviewDocument(doc);
      res.json(comments);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents/:id/comments/:commentId/action", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const commentId = Number(req.params.commentId);
      const comments = await storage.listComments(doc.id);
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const result = await actionComment(doc, comment);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents/:id/action-all-comments", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const allComments = await storage.listComments(doc.id);
      const pendingUserComments = allComments.filter(
        (c) => c.type === "user" && c.status === "pending" && !c.aiReply
      );

      if (pendingUserComments.length === 0) {
        return res.json({ message: "No pending user comments to action", results: [] });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let closed = false;
      res.on("close", () => { closed = true; });

      const sendEvent = (data: any) => {
        if (closed) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent({ type: "start", total: pendingUserComments.length });

      await actionAllComments(doc, pendingUserComments, (progress) => {
        sendEvent({
          type: "progress",
          commentId: progress.commentId,
          aiReply: progress.aiReply,
          proposedText: progress.proposedText,
          index: progress.index,
          total: progress.total,
        });
      });

      sendEvent({ type: "done" });
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/documents/:id/factcheck-candidates", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const comments = await spotFactCheckCandidates(doc);
      res.json(comments);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents/:id/factcheck", async (req: Request, res: Response) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const allComments = await storage.listComments(doc.id);
      const acceptedCandidates = allComments.filter(
        c => c.type === "factcheck" && c.status === "accepted"
      );

      if (acceptedCandidates.length === 0) {
        return res.status(400).json({ error: "No accepted fact-check candidates found. Accept some candidates first." });
      }

      const results = await runFactCheck(doc, acceptedCandidates);
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/spreadsheets", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : null;
      const datasets = await storage.listDatasets();
      const spreadsheets = datasets.filter((ds) => {
        if (ds.sourceType !== "spreadsheet") return false;
        if (projectId === null) return true;
        return ds.projectId === projectId;
      });
      res.json(spreadsheets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/spreadsheets", async (req: Request, res: Response) => {
    try {
      const { projectId, lastEditedByUserId, name, columns, rows } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const columnNames = normalizeSpreadsheetColumns(columns);
      const schemaJson = columnNames.length > 0
        ? columnNames.map((col) => ({ name: col, type: "string" }))
        : null;

      const ds = await storage.createDataset({
        projectId: projectId ?? null,
        lastEditedByUserId: lastEditedByUserId ?? null,
        name,
        sourceType: "spreadsheet",
        schemaJson,
        rowCount: Array.isArray(rows) ? rows.length : 0,
      });

      if (Array.isArray(rows) && rows.length > 0) {
        const rowData = normalizeSpreadsheetRows(columnNames, rows);
        await storage.insertDatasetRows(ds.id, rowData);
      }

      res.status(201).json(ds);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/spreadsheets/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const ds = await storage.getDataset(id);
      if (!ds || ds.sourceType !== "spreadsheet") return res.status(404).json({ error: "Not found" });
      res.json(ds);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/spreadsheets/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const ds = await storage.getDataset(id);
      if (!ds || ds.sourceType !== "spreadsheet") return res.status(404).json({ error: "Not found" });
      const { name, columns, rows, lastEditedByUserId } = req.body;
      const columnNames = normalizeSpreadsheetColumns(columns);
      const schemaJson = columnNames.length > 0
        ? columnNames.map((col) => ({ name: col, type: "string" }))
        : null;
      const rowData = Array.isArray(rows) ? normalizeSpreadsheetRows(columnNames, rows) : [];
      await storage.insertDatasetRows(id, rowData);
      const updated = await storage.updateDataset(id, {
        name: name ?? ds.name,
        schemaJson,
        rowCount: rowData.length,
        lastEditedByUserId: lastEditedByUserId ?? ds.lastEditedByUserId,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/spreadsheets/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const ds = await storage.getDataset(id);
      if (!ds || ds.sourceType !== "spreadsheet") return res.status(404).json({ error: "Not found" });
      await storage.deleteDataset(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/spreadsheets/:id/rows", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const ds = await storage.getDataset(id);
      if (!ds || ds.sourceType !== "spreadsheet") return res.status(404).json({ error: "Not found" });
      const rows = await storage.getDatasetRows(id, 1000, 0);
      res.json({ rows, total: ds.rowCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:projectId/vault/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const storagePath = `vault/${projectId}/${Date.now()}_${file.originalname}`;

      const vaultFile = await storage.createVaultFile({
        projectId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
      });

      processVaultFile(vaultFile.id, file.buffer).catch((err) =>
        console.error("Background processing failed:", err)
      );

      res.status(201).json(vaultFile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:projectId/vault", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const search = req.query.search as string | undefined;
      const files = await storage.listVaultFiles(projectId, search);
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:projectId/vault/:fileId", async (req: Request, res: Response) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:projectId/vault/:fileId/download", async (req: Request, res: Response) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
      res.send(file.extractedText || "File content not available for download in this mode.");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:projectId/vault/:fileId", async (req: Request, res: Response) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      await storage.deleteVaultChunksByFile(file.id);
      await storage.deleteVaultFile(file.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:projectId/vault/:fileId/chunks", async (req: Request, res: Response) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      const chunks = await storage.getVaultChunksByFile(file.id);
      res.json(chunks.map((c) => ({ id: c.id, chunkIndex: c.chunkIndex, content: c.content, tokenCount: c.tokenCount })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:projectId/vault/query", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const { query, maxChunks } = req.body;
      if (!query) return res.status(400).json({ error: "query is required" });

      const results = await retrieveRelevantContext(projectId, query, maxChunks || 10);
      res.json({ results, formattedContext: formatRAGContext(results) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Charts ──
  app.get("/api/charts", async (_req: Request, res: Response) => {
    try {
      const allCharts = await storage.listCharts();
      res.json(allCharts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/charts/:id", async (req: Request, res: Response) => {
    try {
      const chart = await storage.getChart(Number(req.params.id));
      if (!chart) return res.status(404).json({ error: "Chart not found" });
      res.json(chart);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/charts", async (req: Request, res: Response) => {
    try {
      const { projectId, datasetId, lastEditedByUserId, name, description, chartType, chartConfig } = req.body;
      if (!name || !chartType) return res.status(400).json({ error: "name and chartType are required" });
      const chart = await storage.createChart({
        projectId: projectId || undefined,
        datasetId: datasetId || undefined,
        lastEditedByUserId: lastEditedByUserId || undefined,
        name,
        description,
        chartType,
        chartConfig: chartConfig || {},
      });
      res.status(201).json(chart);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/charts/:id", async (req: Request, res: Response) => {
    try {
      const chart = await storage.getChart(Number(req.params.id));
      if (!chart) return res.status(404).json({ error: "Chart not found" });
      const updated = await storage.updateChart(chart.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/charts/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteChart(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/charts/:id/data", async (req: Request, res: Response) => {
    try {
      const chart = await storage.getChart(Number(req.params.id));
      if (!chart) return res.status(404).json({ error: "Chart not found" });
      if (!chart.datasetId) {
        const configData = (chart.chartConfig as any)?.data;
        const rows = Array.isArray(configData) ? configData : [];
        return res.json({ chart, rows });
      }

      const limit = Number(req.query.limit) || 1000;
      const rows = await db
        .select()
        .from(datasetRows)
        .where(eq(datasetRows.datasetId, chart.datasetId))
        .orderBy(asc(datasetRows.rowIndex))
        .limit(limit);
      res.json({ chart, rows: rows.map(r => r.data) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/charts/generate", async (req: Request, res: Response) => {
    try {
      const { datasetId, prompt, projectId, lastEditedByUserId } = req.body;
      if (!datasetId || !prompt) return res.status(400).json({ error: "datasetId and prompt are required" });

      const dataset = await storage.getDataset(Number(datasetId));
      if (!dataset) return res.status(404).json({ error: "Dataset not found" });

      const rows = await db
        .select()
        .from(datasetRows)
        .where(eq(datasetRows.datasetId, dataset.id))
        .orderBy(asc(datasetRows.rowIndex))
        .limit(50);

      const sampleData = rows.map(r => r.data as Record<string, any>);
      const columns = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

      const spec = await generateChartSpec(dataset.name, columns, sampleData, prompt);

      const chart = await storage.createChart({
        projectId: projectId || undefined,
        datasetId: dataset.id,
        lastEditedByUserId: lastEditedByUserId || undefined,
        name: spec.title || "Untitled Chart",
        description: spec.description || "",
        chartType: spec.chartType,
        chartConfig: spec,
      });

      res.status(201).json({ chart, spec });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/charts", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const projectCharts = await storage.listProjectCharts(projectId);
      res.json(projectCharts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/charts/shared", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const sharedCharts = await storage.listSharedChartsForProject(projectId);
      res.json(sharedCharts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/charts/link", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { chartId } = req.body;
      if (!chartId) return res.status(400).json({ error: "chartId is required" });
      const chart = await storage.getChart(Number(chartId));
      if (!chart) return res.status(404).json({ error: "Chart not found" });
      if (chart.projectId) return res.status(400).json({ error: "Chart is project-owned" });
      const link = await storage.linkProjectChart(projectId, Number(chartId));
      res.json(link);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id/charts/link/:chartId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const chartId = Number(req.params.chartId);
      await storage.unlinkProjectChart(projectId, chartId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Presentations ──
  app.get("/api/presentations", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      res.json(await storage.listPresentations(projectId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/presentations", async (req: Request, res: Response) => {
    try {
      const pres = await storage.createPresentation(req.body);
      res.status(201).json(pres);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/presentations/:id", async (req: Request, res: Response) => {
    try {
      const pres = await storage.getPresentation(Number(req.params.id));
      if (!pres) return res.status(404).json({ error: "Not found" });
      const presSlides = await storage.getPresentationSlides(pres.id);
      res.json({ ...pres, slides: presSlides });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/presentations/:id", async (req: Request, res: Response) => {
    try {
      const pres = await storage.updatePresentation(Number(req.params.id), req.body);
      res.json(pres);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/presentations/:id", async (req: Request, res: Response) => {
    try {
      await storage.deletePresentation(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Slides ──
  app.post("/api/presentations/:id/slides", async (req: Request, res: Response) => {
    try {
      const presId = Number(req.params.id);
      const pres = await storage.getPresentation(presId);
      if (!pres) return res.status(404).json({ error: "Presentation not found" });
      const existing = await storage.getPresentationSlides(presId);
      const slide = await storage.createSlide({
        presentationId: presId,
        projectId: pres.projectId || null,
        lastEditedByUserId: req.body.lastEditedByUserId || null,
        slideIndex: req.body.slideIndex ?? existing.length,
        layout: req.body.layout || "title_body",
        title: req.body.title || "New Slide",
        subtitle: req.body.subtitle,
        bodyJson: req.body.bodyJson || {},
        elements: req.body.elements || [],
        notesText: req.body.notesText,
      });
      res.status(201).json(slide);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/slides/:id", async (req: Request, res: Response) => {
    try {
      const slide = await storage.updateSlide(Number(req.params.id), req.body);
      res.json(slide);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/slides/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteSlide(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/slides/action-all-comments", async (req: Request, res: Response) => {
    try {
      const { slideContent, comments } = req.body;
      if (!comments || comments.length === 0) {
        return res.json({ message: "No comments to action", results: [] });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let closed = false;
      res.on("close", () => { closed = true; });

      const sendEvent = (data: any) => {
        if (closed) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent({ type: "start", total: comments.length });

      const hasKey = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);

      if (!hasKey) {
        for (let i = 0; i < comments.length; i++) {
          const c = comments[i];
          sendEvent({
            type: "progress",
            index: i,
            total: comments.length,
            aiReply: `Reviewed: "${c.comment}". Suggested revision applied.`,
            proposedText: c.elementContent ? `[Revised] ${c.elementContent}` : "Suggested replacement text",
          });
        }
      } else {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });

        const commentsList = comments.map((c: any, i: number) =>
          `Comment ${i}:\n  Element content: "${c.elementContent}"\n  User instruction: ${c.comment}`
        ).join("\n\n");

        const response = await openai.chat.completions.create({
          model: "gpt-5-nano",
          messages: [
            {
              role: "system",
              content: `You are a slide editing assistant. Multiple comments have been left on slide elements. For EACH comment, propose a specific text change.

Return a JSON array where each element corresponds to one comment (same order). Each must have:
- "index": the comment index (0-based)
- "aiReply": brief explanation of the change
- "proposedText": the replacement text for the element

Return ONLY valid JSON array.`,
            },
            {
              role: "user",
              content: `Slide content:\n${slideContent}\n\n--- Comments ---\n${commentsList}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content || "[]";
        let edits: any[] = [];
        try {
          const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          const toParse = fenced ? fenced[1].trim() : content;
          const objMatch = toParse.match(/[\[{][\s\S]*[\]}]/);
          edits = JSON.parse(objMatch ? objMatch[0] : toParse);
          if (!Array.isArray(edits)) edits = [];
        } catch { edits = []; }

        for (let i = 0; i < comments.length; i++) {
          const c = comments[i];
          const edit = edits.find((e: any) => e.index === i) || edits[i];
          sendEvent({
            type: "progress",
            index: i,
            total: comments.length,
            aiReply: edit?.aiReply || "Suggested revision applied.",
            proposedText: edit?.proposedText || c.elementContent || "Suggested replacement text",
          });
        }
      }

      sendEvent({ type: "done" });
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/presentations/:id/reorder", async (req: Request, res: Response) => {
    try {
      await storage.reorderSlides(Number(req.params.id), req.body.slideIds);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Generate slides from document ──
  app.post("/api/presentations/:id/generate-from-document", async (req: Request, res: Response) => {
    try {
      const presId = Number(req.params.id);
      const pres = await storage.getPresentation(presId);
      if (!pres) return res.status(404).json({ error: "Presentation not found" });

      const { documentId, documentContent, lastEditedByUserId } = req.body;
      let content = documentContent;

      if (documentId && !content) {
        const doc = await storage.getDocument(Number(documentId));
        if (!doc) return res.status(404).json({ error: "Document not found" });
        content = doc.content;
      }

      if (!content) return res.status(400).json({ error: "No content provided" });

      const plainText = content.replace(/<[^>]*>/g, "").trim();

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let closed = false;
      req.on("close", () => { closed = true; });
      function sendEvent(data: any) {
        if (closed) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      sendEvent({ status: "analyzing", message: "Analyzing document structure..." });

      const useMock = !process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      let generatedSlides: any[] = [];

      if (useMock) {
        const paragraphs = plainText.split(/\n\n+/).filter((p: string) => p.trim().length > 20);
        sendEvent({ status: "generating", message: "Generating slide outlines..." });

        generatedSlides.push({
          layout: "title_only",
          title: paragraphs[0]?.slice(0, 80) || "Presentation",
          subtitle: "Generated from document",
          bodyJson: {},
          elements: [],
        });

        const bodyParagraphs = paragraphs.slice(1);
        for (let i = 0; i < bodyParagraphs.length; i += 3) {
          const chunk = bodyParagraphs.slice(i, i + 3);
          const bullets = chunk.map((p: string) => {
            const sentences = p.split(/[.!?]+/).filter((s: string) => s.trim());
            return sentences[0]?.trim().slice(0, 120) || p.slice(0, 120);
          });
          generatedSlides.push({
            layout: "title_body",
            title: bullets[0]?.slice(0, 60) || `Section ${Math.floor(i / 3) + 1}`,
            bodyJson: { bullets },
            elements: [],
          });
          sendEvent({ status: "generating", message: `Generated slide ${generatedSlides.length}...` });
        }

        if (generatedSlides.length < 2) {
          generatedSlides.push({
            layout: "title_body",
            title: "Key Points",
            bodyJson: { bullets: ["Summary of key findings", "Recommendations", "Next steps"] },
            elements: [],
          });
        }
      } else {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI();

        sendEvent({ status: "generating", message: "AI is creating slides..." });

        const completion = await openai.chat.completions.create({
          model: "gpt-5.1-mini",
          messages: [
            {
              role: "system",
              content: `You are a presentation designer. Convert the given document into a structured slide deck.
Return a JSON array of slides. Each slide has:
- "layout": one of "title_only", "title_body", "two_column", "blank"
- "title": string (concise slide title)
- "subtitle": optional string
- "bodyJson": object with "bullets" array of strings for key points
- "elements": empty array

Guidelines:
- First slide should be a title slide (layout: "title_only")
- Each slide should have 3-5 bullet points max
- Keep titles under 60 characters
- Keep bullets concise and actionable
- Create 5-15 slides depending on content length
- End with a summary or next steps slide

Return ONLY the JSON array, no other text.`
            },
            {
              role: "user",
              content: plainText.slice(0, 12000),
            },
          ],
          max_completion_tokens: 4096,
        });

        const raw = completion.choices[0]?.message?.content || "[]";
        try {
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          generatedSlides = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
          generatedSlides = [{
            layout: "title_body",
            title: "Generated Content",
            bodyJson: { bullets: ["Failed to parse AI output — please try again."] },
            elements: [],
          }];
        }
      }

      sendEvent({ status: "saving", message: `Saving ${generatedSlides.length} slides...` });

      const created: any[] = [];
      for (let i = 0; i < generatedSlides.length; i++) {
        const s = generatedSlides[i];
        const slide = await storage.createSlide({
          presentationId: presId,
          projectId: pres.projectId || null,
          lastEditedByUserId: lastEditedByUserId || null,
          slideIndex: i,
          layout: s.layout || "title_body",
          title: s.title || `Slide ${i + 1}`,
          subtitle: s.subtitle,
          bodyJson: s.bodyJson || {},
          elements: s.elements || [],
          notesText: s.notesText,
        });
        created.push(slide);
      }

      if (lastEditedByUserId) {
        await storage.updatePresentation(presId, { lastEditedByUserId });
      }

      sendEvent({ done: true, slides: created });
      if (!closed) res.end();
    } catch (err: any) {
      console.error("Generate slides error:", err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/editor-chat", async (req: Request, res: Response) => {
    try {
      const { editorType, editorId, mode, message, editorContent, history } = req.body;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let closed = false;
      res.on("close", () => { closed = true; });

      function sendEvent(data: Record<string, any>) {
        if (closed) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      sendEvent({ status: "thinking", message: "Preparing..." });

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const contentLabel = editorType === "document" ? "Document" : "Slide Deck";
      const contentSnippet = (editorContent || "").replace(/<[^>]*>/g, "").slice(0, 12000);

      if (mode.startsWith("workflow:")) {
        const workflowId = Number(mode.split(":")[1]);
        const wfSteps = await storage.getWorkflowTemplateSteps(workflowId);

        sendEvent({ status: "starting", message: "Starting workflow..." });

        let accumulatedContext = `${contentLabel} content:\n${contentSnippet}\n\nUser request: ${message}`;

        for (let i = 0; i < wfSteps.length; i++) {
          const step = wfSteps[i];
          sendEvent({ workflowStep: `Step ${i + 1}/${wfSteps.length}: ${step.name}` });
          sendEvent({ status: "running", message: `Running ${step.name}...`, agentName: step.name });

          const agentConfig = await storage.getAgentConfig(step.agentKey);
          const sysPrompt = agentConfig?.systemPrompt || DEFAULT_PROMPTS[step.agentKey] || `You are a ${step.name} agent.`;

          try {
            const stream = await openai.chat.completions.create({
              model: agentConfig?.model || "gpt-5-nano",
              messages: [
                { role: "system", content: `${sysPrompt}\n\nYou are operating within a workflow pipeline. Analyze the input and produce output that flows to the next step. Be concise and structured.${editorType === "document" ? " IMPORTANT: Format all output as HTML (use <h1>, <h2>, <strong>, <em>, <ul>/<ol>/<li>, <p>, <hr> tags). Never use markdown syntax." : ""}` },
                { role: "user", content: accumulatedContext },
              ],
              stream: true,
              max_completion_tokens: agentConfig?.maxTokens || 4096,
            });

            let stepOutput = "";
            for await (const chunk of stream) {
              const token = chunk.choices[0]?.delta?.content || "";
              if (token) {
                stepOutput += token;
                sendEvent({ content: token });
              }
            }

            accumulatedContext = `Previous step (${step.name}) output:\n${stepOutput}\n\nOriginal ${contentLabel} content:\n${contentSnippet}\n\nOriginal user request: ${message}`;
          } catch (err: any) {
            console.error(`Workflow step ${step.name} error:`, err);
            sendEvent({ content: `\n\n[${step.name} encountered an error: ${err.message}]\n` });
          }
        }

        sendEvent({ done: true });
        if (!closed) res.end();
        return;
      }

      let systemPrompt: string;
      let agentName = "";

      const htmlFormatInstructions = editorType === "document"
        ? `\n\nIMPORTANT: Your output will be inserted directly into a rich text editor (HTML). You MUST format your response as HTML, NOT markdown. Use <h1>, <h2>, <h3> for headings, <strong> for bold, <em> for italics, <ul>/<ol> with <li> for lists, <p> for paragraphs, <hr> for dividers. Never use markdown syntax like **, ##, ---, or - for lists.`
        : "";

      if (mode === "general") {
        systemPrompt = `You are a helpful AI assistant embedded in a ${editorType === "document" ? "word processor" : "slide editor"}. You have access to the user's current ${contentLabel.toLowerCase()} content. Help them with writing, editing, analysis, brainstorming, and any other questions. Be concise and actionable.${htmlFormatInstructions}\n\n${contentLabel} content:\n${contentSnippet}`;
        agentName = "General Assistant";
      } else {
        const agentConfig = await storage.getAgentConfig(mode);
        systemPrompt = agentConfig?.systemPrompt || DEFAULT_PROMPTS[mode] || `You are a ${mode} agent. Help the user with their ${contentLabel.toLowerCase()}.`;
        systemPrompt = `${systemPrompt}\n\nYou are operating inside an editor chat. The user is asking you to apply your expertise to their current ${contentLabel.toLowerCase()}. Provide actionable feedback and suggestions.${htmlFormatInstructions}\n\n${contentLabel} content:\n${contentSnippet}`;

        const agentRecord = await storage.getAgentByKey(mode);
        agentName = agentRecord?.name || mode;
      }

      console.log("[editor-chat] Sending connecting event for:", agentName);
      sendEvent({ status: "connecting", message: `${agentName} is thinking...`, agentName });

      const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];

      if (history && Array.isArray(history)) {
        for (const h of history.slice(-10)) {
          chatMessages.push({ role: h.role as "user" | "assistant", content: h.content });
        }
      }
      chatMessages.push({ role: "user", content: message });

      sendEvent({ status: "streaming", message: "Generating response..." });

      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: chatMessages,
          stream: true,
          max_completion_tokens: 4096,
        });

        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || "";
          if (token) {
            sendEvent({ content: token });
          }
        }
      } catch (aiErr: any) {
        console.error("[editor-chat] OpenAI error:", aiErr.message);
        sendEvent({ error: `AI error: ${aiErr.message}` });
      }

      sendEvent({ done: true });
      if (!closed) res.end();
    } catch (error: any) {
      console.error("Editor chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message || "Failed to process request" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process request" });
      }
    }
  });

  registerChatRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
