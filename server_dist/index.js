"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_express = __toESM(require("express"));

// server/routes.ts
var import_node_http = require("node:http");

// server/db.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = __toESM(require("pg"));

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  agentConfigs: () => agentConfigs,
  analysisPlan: () => analysisPlan,
  conversations: () => conversations,
  hypotheses: () => hypotheses,
  insertProjectSchema: () => insertProjectSchema,
  issueNodes: () => issueNodes,
  messages: () => messages,
  modelRuns: () => modelRuns,
  narratives: () => narratives,
  pipelineConfigs: () => pipelineConfigs,
  projects: () => projects,
  runLogs: () => runLogs,
  slides: () => slides
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_zod = require("drizzle-zod");
var projects = (0, import_pg_core.pgTable)("projects", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  objective: (0, import_pg_core.text)("objective").notNull(),
  constraints: (0, import_pg_core.text)("constraints").notNull(),
  stage: (0, import_pg_core.text)("stage").notNull().default("created"),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var issueNodes = (0, import_pg_core.pgTable)("issue_nodes", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  projectId: (0, import_pg_core.integer)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: (0, import_pg_core.integer)("parent_id"),
  text: (0, import_pg_core.text)("text").notNull(),
  priority: (0, import_pg_core.text)("priority").notNull().default("medium"),
  version: (0, import_pg_core.integer)("version").notNull().default(1),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var hypotheses = (0, import_pg_core.pgTable)("hypotheses", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  projectId: (0, import_pg_core.integer)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  issueNodeId: (0, import_pg_core.integer)("issue_node_id"),
  statement: (0, import_pg_core.text)("statement").notNull(),
  metric: (0, import_pg_core.text)("metric").notNull(),
  dataSource: (0, import_pg_core.text)("data_source").notNull(),
  method: (0, import_pg_core.text)("method").notNull(),
  version: (0, import_pg_core.integer)("version").notNull().default(1),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var analysisPlan = (0, import_pg_core.pgTable)("analysis_plan", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  projectId: (0, import_pg_core.integer)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  hypothesisId: (0, import_pg_core.integer)("hypothesis_id"),
  method: (0, import_pg_core.text)("method").notNull(),
  parametersJson: (0, import_pg_core.jsonb)("parameters_json").notNull(),
  requiredDataset: (0, import_pg_core.text)("required_dataset").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var modelRuns = (0, import_pg_core.pgTable)("model_runs", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  projectId: (0, import_pg_core.integer)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  toolName: (0, import_pg_core.text)("tool_name").notNull(),
  inputsJson: (0, import_pg_core.jsonb)("inputs_json").notNull(),
  outputsJson: (0, import_pg_core.jsonb)("outputs_json").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var narratives = (0, import_pg_core.pgTable)("narratives", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  projectId: (0, import_pg_core.integer)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  summaryText: (0, import_pg_core.text)("summary_text").notNull(),
  version: (0, import_pg_core.integer)("version").notNull().default(1),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var runLogs = (0, import_pg_core.pgTable)("run_logs", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  projectId: (0, import_pg_core.integer)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stage: (0, import_pg_core.text)("stage").notNull(),
  inputJson: (0, import_pg_core.jsonb)("input_json").notNull(),
  outputJson: (0, import_pg_core.jsonb)("output_json"),
  modelUsed: (0, import_pg_core.text)("model_used").notNull(),
  status: (0, import_pg_core.text)("status").notNull().default("pending"),
  errorText: (0, import_pg_core.text)("error_text"),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var slides = (0, import_pg_core.pgTable)("slides", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  projectId: (0, import_pg_core.integer)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  slideIndex: (0, import_pg_core.integer)("slide_index").notNull(),
  layout: (0, import_pg_core.text)("layout").notNull().default("title_body"),
  title: (0, import_pg_core.text)("title").notNull(),
  subtitle: (0, import_pg_core.text)("subtitle"),
  bodyJson: (0, import_pg_core.jsonb)("body_json").notNull(),
  notesText: (0, import_pg_core.text)("notes_text"),
  version: (0, import_pg_core.integer)("version").notNull().default(1),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var agentConfigs = (0, import_pg_core.pgTable)("agent_configs", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  agentType: (0, import_pg_core.text)("agent_type").notNull().unique(),
  systemPrompt: (0, import_pg_core.text)("system_prompt").notNull(),
  model: (0, import_pg_core.text)("model").notNull().default("gpt-5-nano"),
  maxTokens: (0, import_pg_core.integer)("max_tokens").notNull().default(8192),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var conversations = (0, import_pg_core.pgTable)("conversations", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  title: (0, import_pg_core.text)("title").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var messages = (0, import_pg_core.pgTable)("messages", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  conversationId: (0, import_pg_core.integer)("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: (0, import_pg_core.text)("role").notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var pipelineConfigs = (0, import_pg_core.pgTable)("pipeline_configs", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  agentsJson: (0, import_pg_core.jsonb)("agents_json").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`).notNull()
});
var insertProjectSchema = (0, import_drizzle_zod.createInsertSchema)(projects).omit({
  id: true,
  stage: true,
  createdAt: true,
  updatedAt: true
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
var pool = new import_pg.default.Pool({
  connectionString: process.env.DATABASE_URL
});
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// server/storage.ts
var import_drizzle_orm2 = require("drizzle-orm");
var storage = {
  async createProject(data) {
    const [project] = await db.insert(projects).values({ ...data, stage: "created" }).returning();
    return project;
  },
  async listProjects() {
    return db.select().from(projects).orderBy((0, import_drizzle_orm2.desc)(projects.createdAt));
  },
  async getProject(id) {
    const [project] = await db.select().from(projects).where((0, import_drizzle_orm2.eq)(projects.id, id));
    return project;
  },
  async updateProjectStage(id, stage) {
    const [project] = await db.update(projects).set({ stage, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(projects.id, id)).returning();
    return project;
  },
  async getLatestIssueVersion(projectId) {
    const nodes = await db.select().from(issueNodes).where((0, import_drizzle_orm2.eq)(issueNodes.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(issueNodes.version));
    return nodes[0]?.version || 0;
  },
  async insertIssueNodes(projectId, version, nodes) {
    if (nodes.length === 0) return [];
    const values = nodes.map((n) => ({
      projectId,
      parentId: n.parentId,
      text: n.text,
      priority: n.priority,
      version
    }));
    return db.insert(issueNodes).values(values).returning();
  },
  async getIssueNodes(projectId) {
    return db.select().from(issueNodes).where((0, import_drizzle_orm2.eq)(issueNodes.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(issueNodes.version), issueNodes.id);
  },
  async getLatestHypothesisVersion(projectId) {
    const hyps = await db.select().from(hypotheses).where((0, import_drizzle_orm2.eq)(hypotheses.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(hypotheses.version));
    return hyps[0]?.version || 0;
  },
  async insertHypotheses(projectId, version, hyps) {
    if (hyps.length === 0) return [];
    const values = hyps.map((h) => ({
      projectId,
      issueNodeId: h.issueNodeId,
      statement: h.statement,
      metric: h.metric,
      dataSource: h.dataSource,
      method: h.method,
      version
    }));
    return db.insert(hypotheses).values(values).returning();
  },
  async getHypotheses(projectId) {
    return db.select().from(hypotheses).where((0, import_drizzle_orm2.eq)(hypotheses.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(hypotheses.version), hypotheses.id);
  },
  async insertAnalysisPlan(projectId, plans) {
    if (plans.length === 0) return [];
    const values = plans.map((p) => ({
      projectId,
      hypothesisId: p.hypothesisId,
      method: p.method,
      parametersJson: p.parametersJson,
      requiredDataset: p.requiredDataset
    }));
    return db.insert(analysisPlan).values(values).returning();
  },
  async getAnalysisPlan(projectId) {
    return db.select().from(analysisPlan).where((0, import_drizzle_orm2.eq)(analysisPlan.projectId, projectId)).orderBy(analysisPlan.id);
  },
  async insertModelRun(projectId, toolName, inputsJson, outputsJson) {
    const [run] = await db.insert(modelRuns).values({ projectId, toolName, inputsJson, outputsJson }).returning();
    return run;
  },
  async getModelRuns(projectId) {
    return db.select().from(modelRuns).where((0, import_drizzle_orm2.eq)(modelRuns.projectId, projectId)).orderBy(modelRuns.id);
  },
  async getLatestNarrativeVersion(projectId) {
    const narrs = await db.select().from(narratives).where((0, import_drizzle_orm2.eq)(narratives.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(narratives.version));
    return narrs[0]?.version || 0;
  },
  async insertNarrative(projectId, version, summaryText) {
    const [narr] = await db.insert(narratives).values({ projectId, summaryText, version }).returning();
    return narr;
  },
  async getNarratives(projectId) {
    return db.select().from(narratives).where((0, import_drizzle_orm2.eq)(narratives.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(narratives.version));
  },
  async insertRunLog(projectId, stage, inputJson, modelUsed, status = "pending") {
    const [log2] = await db.insert(runLogs).values({ projectId, stage, inputJson, modelUsed, status }).returning();
    return log2;
  },
  async updateRunLog(id, outputJson, status, errorText) {
    const [log2] = await db.update(runLogs).set({ outputJson, status, errorText }).where((0, import_drizzle_orm2.eq)(runLogs.id, id)).returning();
    return log2;
  },
  async getRunLogs(projectId) {
    return db.select().from(runLogs).where((0, import_drizzle_orm2.eq)(runLogs.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(runLogs.createdAt));
  },
  async getLatestSlideVersion(projectId) {
    const s = await db.select().from(slides).where((0, import_drizzle_orm2.eq)(slides.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(slides.version));
    return s[0]?.version || 0;
  },
  async insertSlides(projectId, version, slideData) {
    if (slideData.length === 0) return [];
    const values = slideData.map((s) => ({
      projectId,
      slideIndex: s.slideIndex,
      layout: s.layout,
      title: s.title,
      subtitle: s.subtitle || null,
      bodyJson: s.bodyJson,
      notesText: s.notesText || null,
      version
    }));
    return db.insert(slides).values(values).returning();
  },
  async getSlides(projectId) {
    return db.select().from(slides).where((0, import_drizzle_orm2.eq)(slides.projectId, projectId)).orderBy((0, import_drizzle_orm2.desc)(slides.version), slides.slideIndex);
  },
  async getAllAgentConfigs() {
    return db.select().from(agentConfigs);
  },
  async getAgentConfig(agentType) {
    const [config] = await db.select().from(agentConfigs).where((0, import_drizzle_orm2.eq)(agentConfigs.agentType, agentType));
    return config;
  },
  async upsertAgentConfig(data) {
    const existing = await this.getAgentConfig(data.agentType);
    if (existing) {
      const [updated] = await db.update(agentConfigs).set({
        systemPrompt: data.systemPrompt,
        model: data.model,
        maxTokens: data.maxTokens,
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm2.eq)(agentConfigs.agentType, data.agentType)).returning();
      return updated;
    }
    const [created] = await db.insert(agentConfigs).values(data).returning();
    return created;
  },
  async createPipeline(data) {
    const [pipeline] = await db.insert(pipelineConfigs).values(data).returning();
    return pipeline;
  },
  async listPipelines() {
    return db.select().from(pipelineConfigs).orderBy((0, import_drizzle_orm2.desc)(pipelineConfigs.updatedAt));
  },
  async getPipeline(id) {
    const [pipeline] = await db.select().from(pipelineConfigs).where((0, import_drizzle_orm2.eq)(pipelineConfigs.id, id));
    return pipeline;
  },
  async updatePipeline(id, data) {
    const [pipeline] = await db.update(pipelineConfigs).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(pipelineConfigs.id, id)).returning();
    return pipeline;
  },
  async deletePipeline(id) {
    await db.delete(pipelineConfigs).where((0, import_drizzle_orm2.eq)(pipelineConfigs.id, id));
  }
};

// server/agents/index.ts
var import_openai = __toESM(require("openai"));

// server/agents/scenario-tool.ts
function runScenarioTool(params) {
  const {
    baselineRevenue,
    growthRate,
    costReduction,
    timeHorizonYears,
    volatility = 0.15
  } = params;
  const discountRate = 0.1;
  const baseCostRatio = 0.7;
  function buildScenario(revenueMultiplier, costMultiplier) {
    const years = [];
    let currentRevenue = baselineRevenue;
    for (let y = 1; y <= timeHorizonYears; y++) {
      const adjustedGrowth = growthRate * revenueMultiplier;
      currentRevenue = currentRevenue * (1 + adjustedGrowth);
      const costs = currentRevenue * baseCostRatio * costMultiplier * (1 - costReduction);
      years.push({
        year: y,
        revenue: Math.round(currentRevenue * 100) / 100,
        costs: Math.round(costs * 100) / 100,
        profit: Math.round((currentRevenue - costs) * 100) / 100
      });
    }
    return years;
  }
  const baseline = buildScenario(1, 1);
  const optimistic = buildScenario(1 + volatility, 1 - volatility * 0.5);
  const pessimistic = buildScenario(1 - volatility, 1 + volatility * 0.5);
  function npv(scenario) {
    return scenario.reduce((sum, s, i) => {
      return sum + s.profit / Math.pow(1 + discountRate, i + 1);
    }, 0);
  }
  const baselineNPV = Math.round(npv(baseline) * 100) / 100;
  const optimisticNPV = Math.round(npv(optimistic) * 100) / 100;
  const pessimisticNPV = Math.round(npv(pessimistic) * 100) / 100;
  const expectedValue = Math.round(
    (optimisticNPV * 0.25 + baselineNPV * 0.5 + pessimisticNPV * 0.25) * 100
  ) / 100;
  const riskAdjustedReturn = Math.round(
    (expectedValue / baselineRevenue - 1) * 100 * 100 / 100
  ) / 100;
  return {
    baseline,
    optimistic,
    pessimistic,
    summary: {
      baselineNPV,
      optimisticNPV,
      pessimisticNPV,
      expectedValue,
      riskAdjustedReturn
    }
  };
}

// server/agents/index.ts
var hasApiKey = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
var openai = null;
if (hasApiKey) {
  openai = new import_openai.default({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  });
}
var DEFAULT_MODEL = "gpt-5-nano";
function getModelUsed() {
  return hasApiKey ? DEFAULT_MODEL : "mock";
}
var DEFAULT_PROMPTS = {
  issues_tree: `You are a McKinsey-style consulting analyst. Given a project objective and constraints, produce a MECE issues tree with AT LEAST 3 levels of depth. Return ONLY valid JSON matching this schema:
{
  "issues": [
    { "id": "1", "parentId": null, "text": "Root issue", "priority": "high" },
    { "id": "2", "parentId": "1", "text": "Level 2 sub-issue", "priority": "medium" },
    { "id": "3", "parentId": "2", "text": "Level 3 detail", "priority": "low" }
  ]
}
Priority must be "high", "medium", or "low". Use string IDs. parentId is null for root nodes. Include 15-25 nodes across 3+ levels of depth. Each root issue should have 2-3 children, and at least some children should have their own children (grandchildren of root).`,
  hypothesis: `You are a consulting analyst. Given an issues tree, generate hypotheses and an analysis plan. Return ONLY valid JSON matching this schema:
{
  "hypotheses": [
    {
      "issueNodeId": "1",
      "statement": "Hypothesis text",
      "metric": "Revenue growth %",
      "dataSource": "Industry benchmarks",
      "method": "scenario_analysis"
    }
  ],
  "analysisPlan": [
    {
      "hypothesisIndex": 0,
      "method": "run_scenario_tool",
      "parameters": {
        "baselineRevenue": 1000000,
        "growthRate": 0.1,
        "costReduction": 0.05,
        "timeHorizonYears": 5,
        "volatility": 0.15
      },
      "requiredDataset": "Financial projections"
    }
  ]
}
Generate 2-4 hypotheses linked to the most important issues. Each hypothesis must have a corresponding analysis plan entry. The parameters must have all fields: baselineRevenue (number), growthRate (0-1), costReduction (0-1), timeHorizonYears (integer), volatility (0-1). Use realistic business numbers.`,
  mece_critic: `You are a rigorous MECE quality auditor for consulting issues trees. Your job is to evaluate an issues tree and either approve it or return specific revision instructions.

Evaluate the tree against these 5 criteria:

1. OVERLAP: Check for semantic overlap between sibling branches at each level. Siblings must be mutually exclusive \u2014 no branch should partially restate or subsume another.

2. COVERAGE: Check for material gaps. Are there important dimensions of the governing question that are completely missing? Would a senior partner say "you forgot about X"?

3. MIXED LOGICS: Check whether branches at the same level mix different types of decomposition \u2014 e.g., mixing drivers with symptoms, or actions with conditions. Each level should use one consistent logic.

4. BRANCH BALANCE: Check whether any single branch has significantly more children than its siblings (more than 2x). An unbalanced tree suggests the decomposition logic is wrong.

5. LABEL QUALITY: Check for vague or generic labels like "Other factors", "Miscellaneous", "General considerations". Every branch must be specific and descriptive.

Return ONLY valid JSON matching this schema:
{
  "verdict": "approved" | "revise",
  "scores": {
    "overlap": { "score": 1-5, "details": "explanation" },
    "coverage": { "score": 1-5, "details": "explanation" },
    "mixedLogics": { "score": 1-5, "details": "explanation" },
    "branchBalance": { "score": 1-5, "details": "explanation" },
    "labelQuality": { "score": 1-5, "details": "explanation" }
  },
  "overallScore": 1-5,
  "revisionInstructions": "Specific instructions for what to fix. Empty string if approved."
}

Score guide: 1=critical failure, 2=major issues, 3=acceptable, 4=good, 5=excellent.
Set verdict to "approved" if overallScore >= 4. Set to "revise" if overallScore < 4.
Be strict but fair. Provide actionable, specific revision instructions when verdict is "revise".`,
  execution: `Execute the analysis plan using the scenario calculator tool.`,
  summary: `You are a senior consulting partner writing an executive summary. Produce a clear, structured summary with: Key Findings (bullet points), Recommendation (2-3 sentences), and Next Steps (numbered list). Use markdown formatting. Be concise and actionable. Return ONLY the summary text, not JSON.`,
  presentation: `You are a consulting presentation designer. Given an executive summary, hypotheses, and scenario analysis results, produce a structured slide deck for a 16:9 presentation. Generate 6-10 slides.

Return ONLY valid JSON matching this schema:
{
  "slides": [
    {
      "slideIndex": 0,
      "layout": "title_slide",
      "title": "Presentation Title",
      "subtitle": "Subtitle or date",
      "bodyJson": {},
      "notesText": "Speaker notes for this slide"
    },
    {
      "slideIndex": 1,
      "layout": "section_header",
      "title": "Section Title",
      "subtitle": "Brief description",
      "bodyJson": {},
      "notesText": "Speaker notes"
    },
    {
      "slideIndex": 2,
      "layout": "title_body",
      "title": "Slide Title",
      "subtitle": null,
      "bodyJson": {
        "bullets": ["Key point 1", "Key point 2", "Key point 3"]
      },
      "notesText": "Speaker notes"
    },
    {
      "slideIndex": 3,
      "layout": "two_column",
      "title": "Comparison Slide",
      "subtitle": null,
      "bodyJson": {
        "leftTitle": "Current State",
        "leftBullets": ["Point A", "Point B"],
        "rightTitle": "Future State",
        "rightBullets": ["Point X", "Point Y"]
      },
      "notesText": "Speaker notes"
    },
    {
      "slideIndex": 4,
      "layout": "metrics",
      "title": "Key Metrics",
      "subtitle": null,
      "bodyJson": {
        "metrics": [
          { "label": "Revenue", "value": "$1.2M", "change": "+15%" },
          { "label": "NPV", "value": "$850K", "change": "+22%" },
          { "label": "ROI", "value": "18%", "change": "+5pp" }
        ]
      },
      "notesText": "Speaker notes"
    }
  ]
}

Available layouts: "title_slide", "section_header", "title_body", "two_column", "metrics".
Structure the deck as: Title Slide \u2192 Executive Summary \u2192 Key Findings (1-2 slides) \u2192 Analysis Results with Metrics \u2192 Recommendations \u2192 Next Steps.
Use real numbers from the analysis results. Keep bullet points concise (max 8 words each). Generate compelling, professional slide content.`
};
function getDefaultConfigs() {
  return Object.entries(DEFAULT_PROMPTS).map(([agentType, systemPrompt]) => ({
    agentType,
    systemPrompt,
    model: DEFAULT_MODEL,
    maxTokens: 8192
  }));
}
async function getAgentPrompt(agentType) {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config.systemPrompt;
  } catch {
  }
  return DEFAULT_PROMPTS[agentType] || "";
}
async function getAgentModel(agentType) {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config.model;
  } catch {
  }
  return DEFAULT_MODEL;
}
async function getAgentMaxTokens(agentType) {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config.maxTokens;
  } catch {
  }
  return 8192;
}
async function callLLM(systemPrompt, userPrompt, model, maxTokens, retries = 1) {
  if (!openai) {
    return "";
  }
  const resolvedModel = model || DEFAULT_MODEL;
  const resolvedTokens = maxTokens || 8192;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const messages2 = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: attempt > 0 ? `${userPrompt}

IMPORTANT: Your previous response was truncated. Please produce a SHORTER, more concise response that fits within the token limit. Use fewer nodes, shorter descriptions, and minimal whitespace in JSON output.` : userPrompt
      }
    ];
    const response = await openai.chat.completions.create({
      model: resolvedModel,
      messages: messages2,
      max_completion_tokens: resolvedTokens
    });
    const content = response.choices[0]?.message?.content || "";
    const finishReason = response.choices[0]?.finish_reason;
    if (finishReason === "length" && attempt < retries) {
      console.log(`LLM response truncated (finish_reason=length), retrying with conciseness hint (attempt ${attempt + 1}/${retries + 1})`);
      continue;
    }
    return content;
  }
  return "";
}
function repairJson(text2) {
  let s = text2.trim();
  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;
  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/\]/g) || []).length;
  s = s.replace(/,\s*([}\]])/g, "$1");
  if (s.endsWith(",")) {
    s = s.slice(0, -1);
  }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    s += "]";
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    s += "}";
  }
  return s;
}
function extractJson(text2) {
  const match = text2.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      try {
        return JSON.parse(repairJson(match[1].trim()));
      } catch {
      }
    }
  }
  const jsonMatch = text2.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      try {
        return JSON.parse(repairJson(jsonMatch[0]));
      } catch {
      }
    }
  }
  const partialJson = text2.match(/\{[\s\S]*/);
  if (partialJson) {
    try {
      return JSON.parse(repairJson(partialJson[0]));
    } catch {
    }
  }
  return JSON.parse(text2);
}
function formatTreeForCritic(issues, objective) {
  const roots = issues.filter((n) => !n.parentId);
  function renderBranch(parentId, indent) {
    const children = issues.filter((n) => n.parentId === parentId);
    return children.map((c) => {
      const prefix = "  ".repeat(indent) + "- ";
      const line = `${prefix}[${c.priority.toUpperCase()}] ${c.text}`;
      const sub = renderBranch(c.id, indent + 1);
      return sub ? `${line}
${sub}` : line;
    }).join("\n");
  }
  const treeText = renderBranch(null, 0);
  return `Governing Question / Objective: ${objective}

Issues Tree (${issues.length} nodes):
${treeText}`;
}
var MAX_REVISIONS = 2;
async function issuesTreeAgent(objective, constraints) {
  if (!openai) {
    return {
      issues: [
        { id: "1", parentId: null, text: "Market Entry Strategy", priority: "high" },
        { id: "2", parentId: "1", text: "Target Market Sizing", priority: "high" },
        { id: "3", parentId: "2", text: "Addressable Market Segments", priority: "high" },
        { id: "4", parentId: "2", text: "Growth Rate Projections", priority: "medium" },
        { id: "5", parentId: "1", text: "Competitive Landscape", priority: "medium" },
        { id: "6", parentId: "5", text: "Key Competitor Positioning", priority: "medium" },
        { id: "7", parentId: "5", text: "Barrier to Entry Analysis", priority: "high" },
        { id: "8", parentId: null, text: "Revenue Model Design", priority: "high" },
        { id: "9", parentId: "8", text: "Pricing Strategy", priority: "high" },
        { id: "10", parentId: "9", text: "Price Elasticity Testing", priority: "medium" },
        { id: "11", parentId: "9", text: "Tiered Pricing Structure", priority: "high" },
        { id: "12", parentId: "8", text: "Channel Mix Selection", priority: "medium" },
        { id: "13", parentId: "12", text: "Direct Sales Capacity", priority: "medium" },
        { id: "14", parentId: "12", text: "Partner Distribution", priority: "low" },
        { id: "15", parentId: null, text: "Operational Readiness", priority: "medium" },
        { id: "16", parentId: "15", text: "Team Scaling Plan", priority: "medium" },
        { id: "17", parentId: "16", text: "Hiring Pipeline", priority: "medium" },
        { id: "18", parentId: "16", text: "Training Programs", priority: "low" },
        { id: "19", parentId: "15", text: "Technology Infrastructure", priority: "low" },
        { id: "20", parentId: "19", text: "Platform Architecture", priority: "low" },
        { id: "21", parentId: "19", text: "Data Pipeline Setup", priority: "medium" }
      ],
      criticLog: [{
        iteration: 0,
        critic: {
          verdict: "approved",
          scores: {
            overlap: { score: 5, details: "No overlap between sibling branches" },
            coverage: { score: 4, details: "Key dimensions covered: market, revenue, operations" },
            mixedLogics: { score: 4, details: "Consistent strategic decomposition at each level" },
            branchBalance: { score: 4, details: "Balanced across 3 root branches (7/7/7 nodes)" },
            labelQuality: { score: 5, details: "All labels are specific and descriptive" }
          },
          overallScore: 4,
          revisionInstructions: ""
        }
      }]
    };
  }
  const generatorPrompt = await getAgentPrompt("issues_tree");
  const generatorModel = await getAgentModel("issues_tree");
  const generatorMaxTokens = await getAgentMaxTokens("issues_tree");
  const criticPrompt = await getAgentPrompt("mece_critic");
  const criticModel = await getAgentModel("mece_critic");
  const criticMaxTokens = await getAgentMaxTokens("mece_critic");
  const baseUserPrompt = `Objective: ${objective}
Constraints: ${constraints}`;
  const criticLog = [];
  let currentTree;
  let raw = await callLLM(generatorPrompt, baseUserPrompt, generatorModel, generatorMaxTokens);
  currentTree = extractJson(raw);
  for (let iteration = 0; iteration <= MAX_REVISIONS; iteration++) {
    const treeDescription = formatTreeForCritic(currentTree.issues, objective);
    const criticRaw = await callLLM(criticPrompt, treeDescription, criticModel, criticMaxTokens);
    let criticResult;
    try {
      criticResult = extractJson(criticRaw);
    } catch {
      criticResult = {
        verdict: "approved",
        scores: {
          overlap: { score: 3, details: "Could not parse critic response" },
          coverage: { score: 3, details: "Could not parse critic response" },
          mixedLogics: { score: 3, details: "Could not parse critic response" },
          branchBalance: { score: 3, details: "Could not parse critic response" },
          labelQuality: { score: 3, details: "Could not parse critic response" }
        },
        overallScore: 3,
        revisionInstructions: ""
      };
    }
    criticLog.push({ iteration, critic: criticResult });
    if (criticResult.verdict === "approved" || iteration === MAX_REVISIONS) {
      break;
    }
    const revisionPrompt = `${baseUserPrompt}

---
PREVIOUS TREE (needs revision):
${formatTreeForCritic(currentTree.issues, objective)}

---
MECE CRITIC FEEDBACK (iteration ${iteration + 1}):
Overall Score: ${criticResult.overallScore}/5
Overlap: ${criticResult.scores.overlap.score}/5 \u2014 ${criticResult.scores.overlap.details}
Coverage: ${criticResult.scores.coverage.score}/5 \u2014 ${criticResult.scores.coverage.details}
Mixed Logics: ${criticResult.scores.mixedLogics.score}/5 \u2014 ${criticResult.scores.mixedLogics.details}
Branch Balance: ${criticResult.scores.branchBalance.score}/5 \u2014 ${criticResult.scores.branchBalance.details}
Label Quality: ${criticResult.scores.labelQuality.score}/5 \u2014 ${criticResult.scores.labelQuality.details}

REVISION INSTRUCTIONS:
${criticResult.revisionInstructions}

Please produce a REVISED issues tree that addresses ALL the critic's feedback. Return the full tree in the same JSON format.`;
    raw = await callLLM(generatorPrompt, revisionPrompt, generatorModel, generatorMaxTokens);
    currentTree = extractJson(raw);
  }
  return { ...currentTree, criticLog };
}
async function hypothesisAgent(issues) {
  if (!openai) {
    const topIssues = issues.slice(0, 3);
    const hyps = topIssues.map((issue, i) => ({
      issueNodeId: String(issue.id),
      statement: `If we address "${issue.text}", we can achieve 15-25% improvement in the target metric`,
      metric: ["Revenue growth %", "Cost reduction %", "Market share %"][i] || "ROI %",
      dataSource: ["Industry benchmarks", "Internal financials", "Market research"][i] || "Survey data",
      method: "scenario_analysis"
    }));
    const plans = hyps.map((_, i) => ({
      hypothesisIndex: i,
      method: "run_scenario_tool",
      parameters: {
        baselineRevenue: 1e6 + i * 5e5,
        growthRate: 0.08 + i * 0.02,
        costReduction: 0.05 + i * 0.03,
        timeHorizonYears: 5,
        volatility: 0.15
      },
      requiredDataset: "Financial projections + market data"
    }));
    return { hypotheses: hyps, analysisPlan: plans };
  }
  const issuesList = issues.map((i) => `- [ID:${i.id}] ${i.text} (${i.priority})`).join("\n");
  const systemPrompt = await getAgentPrompt("hypothesis");
  const model = await getAgentModel("hypothesis");
  const maxTokens = await getAgentMaxTokens("hypothesis");
  const raw = await callLLM(systemPrompt, `Issues:
${issuesList}`, model, maxTokens);
  return extractJson(raw);
}
async function executionAgent(plans) {
  const results = [];
  for (const plan of plans) {
    const params = {
      baselineRevenue: plan.parameters.baselineRevenue || 1e6,
      growthRate: plan.parameters.growthRate || 0.1,
      costReduction: plan.parameters.costReduction || 0.05,
      timeHorizonYears: plan.parameters.timeHorizonYears || 5,
      volatility: plan.parameters.volatility || 0.15
    };
    const outputs = runScenarioTool(params);
    results.push({
      toolName: "run_scenario_tool",
      inputs: params,
      outputs
    });
  }
  return results;
}
async function summaryAgent(objective, constraints, hypotheses2, modelRuns2) {
  if (!openai) {
    const bullets = hypotheses2.map((h, i) => {
      const run = modelRuns2[i];
      const summary = run?.outputsJson?.summary;
      if (summary) {
        return `- ${h.statement}: Expected NPV of $${summary.expectedValue?.toLocaleString() || "N/A"} with risk-adjusted return of ${summary.riskAdjustedReturn || "N/A"}%`;
      }
      return `- ${h.statement}: Analysis pending`;
    }).join("\n");
    return {
      summaryText: `# Executive Summary

## Objective
${objective}

## Key Findings
${bullets}

## Recommendation
Based on scenario analysis across baseline, optimistic, and pessimistic cases, the proposed strategy shows positive expected returns. The risk-adjusted analysis suggests proceeding with a phased implementation approach, prioritizing the highest-NPV initiatives first.

## Next Steps
1. Validate assumptions with stakeholder interviews
2. Develop detailed implementation roadmap
3. Establish KPI tracking framework
4. Begin Phase 1 execution within 30 days`
    };
  }
  const hypList = hypotheses2.map((h, i) => {
    const run = modelRuns2[i];
    return `Hypothesis: ${h.statement}
Metric: ${h.metric}
Model Results: ${JSON.stringify(run?.outputsJson?.summary || "No results")}`;
  }).join("\n\n");
  const systemPrompt = await getAgentPrompt("summary");
  const model = await getAgentModel("summary");
  const maxTokens = await getAgentMaxTokens("summary");
  const userPrompt = `Objective: ${objective}
Constraints: ${constraints}

Hypotheses & Results:
${hypList}`;
  const summaryText = await callLLM(systemPrompt, userPrompt, model, maxTokens);
  return { summaryText: summaryText || "Summary generation failed." };
}
async function presentationAgent(projectName, objective, summaryText, hypotheses2, modelRuns2) {
  if (!openai) {
    const mockSlides = [
      {
        slideIndex: 0,
        layout: "title_slide",
        title: projectName,
        subtitle: "Strategic Analysis & Recommendations",
        bodyJson: {},
        notesText: "Welcome and introductions"
      },
      {
        slideIndex: 1,
        layout: "section_header",
        title: "Executive Summary",
        subtitle: "Key findings from our analysis",
        bodyJson: {},
        notesText: "Transition to executive overview"
      },
      {
        slideIndex: 2,
        layout: "title_body",
        title: "Objective & Scope",
        subtitle: null,
        bodyJson: {
          bullets: [
            objective,
            "Multi-scenario financial modeling",
            "Risk-adjusted return analysis",
            "Data-driven recommendations"
          ]
        },
        notesText: "Review the project scope and analytical approach"
      },
      {
        slideIndex: 3,
        layout: "metrics",
        title: "Key Financial Metrics",
        subtitle: null,
        bodyJson: {
          metrics: (() => {
            const run = modelRuns2[0]?.outputsJson?.summary;
            return [
              { label: "Expected NPV", value: run ? `$${(run.expectedValue / 1e3).toFixed(0)}K` : "$850K", change: "+22%" },
              { label: "Best Case", value: run ? `$${(run.optimisticNpv / 1e3).toFixed(0)}K` : "$1.2M", change: "Upside" },
              { label: "Risk-Adj Return", value: run ? `${run.riskAdjustedReturn}%` : "18%", change: "+5pp" }
            ];
          })()
        },
        notesText: "Walk through each metric and its implications"
      },
      {
        slideIndex: 4,
        layout: "two_column",
        title: "Scenario Comparison",
        subtitle: null,
        bodyJson: {
          leftTitle: "Baseline Scenario",
          leftBullets: [
            "Conservative growth assumptions",
            "Moderate cost efficiencies",
            "Stable market conditions"
          ],
          rightTitle: "Optimistic Scenario",
          rightBullets: [
            "Accelerated market capture",
            "Full cost reduction realized",
            "Favorable competitive dynamics"
          ]
        },
        notesText: "Compare the two primary scenarios"
      },
      {
        slideIndex: 5,
        layout: "title_body",
        title: "Key Findings",
        subtitle: null,
        bodyJson: {
          bullets: hypotheses2.slice(0, 4).map(
            (h) => h.statement.length > 60 ? h.statement.slice(0, 57) + "..." : h.statement
          )
        },
        notesText: "Detail each hypothesis and supporting evidence"
      },
      {
        slideIndex: 6,
        layout: "title_body",
        title: "Recommendations",
        subtitle: null,
        bodyJson: {
          bullets: [
            "Proceed with phased implementation",
            "Prioritize highest-NPV initiatives",
            "Establish KPI tracking framework",
            "Conduct monthly progress reviews"
          ]
        },
        notesText: "Present the recommended course of action"
      },
      {
        slideIndex: 7,
        layout: "title_body",
        title: "Next Steps",
        subtitle: "30-60-90 Day Plan",
        bodyJson: {
          bullets: [
            "Days 1-30: Stakeholder alignment",
            "Days 31-60: Pilot program launch",
            "Days 61-90: Scale & optimize",
            "Ongoing: Monthly KPI review"
          ]
        },
        notesText: "Outline the implementation timeline"
      },
      {
        slideIndex: 8,
        layout: "section_header",
        title: "Thank You",
        subtitle: "Questions & Discussion",
        bodyJson: {},
        notesText: "Open floor for Q&A"
      }
    ];
    return { slides: mockSlides };
  }
  const hypSummary = hypotheses2.map((h, i) => {
    const run = modelRuns2[i];
    const results = run?.outputsJson?.summary ? `NPV: $${run.outputsJson.summary.expectedValue?.toLocaleString()}, Risk-Adj Return: ${run.outputsJson.summary.riskAdjustedReturn}%` : "No results";
    return `- ${h.statement} (${h.metric}): ${results}`;
  }).join("\n");
  const systemPrompt = await getAgentPrompt("presentation");
  const model = await getAgentModel("presentation");
  const maxTokens = await getAgentMaxTokens("presentation");
  const userPrompt = `Project: ${projectName}
Objective: ${objective}

Executive Summary:
${summaryText}

Hypotheses & Results:
${hypSummary}`;
  const raw = await callLLM(systemPrompt, userPrompt, model, maxTokens);
  return extractJson(raw);
}

// server/routes.ts
var STAGE_ORDER = [
  "created",
  "issues_draft",
  "issues_approved",
  "hypotheses_draft",
  "hypotheses_approved",
  "execution_done",
  "execution_approved",
  "summary_draft",
  "summary_approved",
  "presentation_draft",
  "complete"
];
var APPROVE_MAP = {
  issues_draft: "issues_approved",
  hypotheses_draft: "hypotheses_approved",
  execution_done: "execution_approved",
  summary_draft: "summary_approved",
  presentation_draft: "complete"
};
var RUN_NEXT_MAP = {
  created: "issues_draft",
  issues_approved: "hypotheses_draft",
  hypotheses_approved: "execution_done",
  execution_approved: "summary_draft",
  summary_approved: "presentation_draft"
};
async function registerRoutes(app2) {
  app2.post("/api/projects", async (req, res) => {
    try {
      const { name, objective, constraints } = req.body;
      if (!name || !objective || !constraints) {
        return res.status(400).json({ error: "name, objective, and constraints are required" });
      }
      const project = await storage.createProject({ name, objective, constraints });
      res.status(201).json(project);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects", async (_req, res) => {
    try {
      const list = await storage.listProjects();
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) return res.status(404).json({ error: "Not found" });
      res.json(project);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/projects/:id/run-next", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const nextStage = RUN_NEXT_MAP[project.stage];
      if (!nextStage) {
        return res.status(400).json({
          error: `Cannot run next stage from "${project.stage}". Current stage must be approved first or workflow is complete.`
        });
      }
      const modelUsed = getModelUsed();
      const runLog = await storage.insertRunLog(
        projectId,
        nextStage,
        { currentStage: project.stage },
        modelUsed
      );
      try {
        if (nextStage === "issues_draft") {
          const result = await issuesTreeAgent(project.objective, project.constraints);
          const version = await storage.getLatestIssueVersion(projectId) + 1;
          const idMap = /* @__PURE__ */ new Map();
          let remaining = [...result.issues];
          let inserted = 0;
          const maxPasses = 10;
          let pass = 0;
          while (remaining.length > 0 && pass < maxPasses) {
            pass++;
            const canInsert = remaining.filter(
              (n) => !n.parentId || idMap.has(n.parentId)
            );
            const cannotInsert = remaining.filter(
              (n) => n.parentId && !idMap.has(n.parentId)
            );
            if (canInsert.length === 0) break;
            const insertedNodes = await storage.insertIssueNodes(
              projectId,
              version,
              canInsert.map((n) => ({
                parentId: n.parentId ? idMap.get(n.parentId) || null : null,
                text: n.text,
                priority: n.priority
              }))
            );
            canInsert.forEach((n, i) => {
              idMap.set(n.id, insertedNodes[i].id);
            });
            remaining = cannotInsert;
          }
          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "hypotheses_draft") {
          const issueNodesData = await storage.getIssueNodes(projectId);
          const latestVersion = issueNodesData[0]?.version || 1;
          const latestIssues = issueNodesData.filter(
            (n) => n.version === latestVersion
          );
          const result = await hypothesisAgent(
            latestIssues.map((n) => ({
              id: n.id,
              text: n.text,
              priority: n.priority
            }))
          );
          const version = await storage.getLatestHypothesisVersion(projectId) + 1;
          const insertedHyps = await storage.insertHypotheses(
            projectId,
            version,
            result.hypotheses.map((h) => ({
              issueNodeId: null,
              statement: h.statement,
              metric: h.metric,
              dataSource: h.dataSource,
              method: h.method
            }))
          );
          await storage.insertAnalysisPlan(
            projectId,
            result.analysisPlan.map((p, i) => ({
              hypothesisId: insertedHyps[p.hypothesisIndex]?.id || insertedHyps[0]?.id || null,
              method: p.method,
              parametersJson: p.parameters,
              requiredDataset: p.requiredDataset
            }))
          );
          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "execution_done") {
          const plans = await storage.getAnalysisPlan(projectId);
          const results = await executionAgent(
            plans.map((p) => ({
              method: p.method,
              parameters: p.parametersJson,
              requiredDataset: p.requiredDataset
            }))
          );
          for (const r of results) {
            await storage.insertModelRun(
              projectId,
              r.toolName,
              r.inputs,
              r.outputs
            );
          }
          await storage.updateRunLog(runLog.id, results, "success");
        } else if (nextStage === "summary_draft") {
          const hyps = await storage.getHypotheses(projectId);
          const runs = await storage.getModelRuns(projectId);
          const latestVersion = hyps[0]?.version || 1;
          const latestHyps = hyps.filter((h) => h.version === latestVersion);
          const result = await summaryAgent(
            project.objective,
            project.constraints,
            latestHyps.map((h) => ({
              statement: h.statement,
              metric: h.metric
            })),
            runs.map((r) => ({
              inputsJson: r.inputsJson,
              outputsJson: r.outputsJson
            }))
          );
          const version = await storage.getLatestNarrativeVersion(projectId) + 1;
          await storage.insertNarrative(projectId, version, result.summaryText);
          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "presentation_draft") {
          const narrs = await storage.getNarratives(projectId);
          const hyps = await storage.getHypotheses(projectId);
          const runs = await storage.getModelRuns(projectId);
          const latestVersion = hyps[0]?.version || 1;
          const latestHyps = hyps.filter((h) => h.version === latestVersion);
          const latestNarr = narrs[0];
          const result = await presentationAgent(
            project.name,
            project.objective,
            latestNarr?.summaryText || "No summary available",
            latestHyps.map((h) => ({
              statement: h.statement,
              metric: h.metric
            })),
            runs.map((r) => ({
              inputsJson: r.inputsJson,
              outputsJson: r.outputsJson
            }))
          );
          const version = await storage.getLatestSlideVersion(projectId) + 1;
          await storage.insertSlides(
            projectId,
            version,
            result.slides.map((s) => ({
              slideIndex: s.slideIndex,
              layout: s.layout,
              title: s.title,
              subtitle: s.subtitle || void 0,
              bodyJson: s.bodyJson,
              notesText: s.notesText || void 0
            }))
          );
          await storage.updateRunLog(runLog.id, result, "success");
        }
        const updated = await storage.updateProjectStage(projectId, nextStage);
        res.json(updated);
      } catch (agentErr) {
        await storage.updateRunLog(
          runLog.id,
          null,
          "failed",
          agentErr.message
        );
        await storage.updateProjectStage(projectId, project.stage);
        res.status(500).json({ error: `Agent failed: ${agentErr.message}` });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/projects/:id/approve", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const nextStage = APPROVE_MAP[project.stage];
      if (!nextStage) {
        return res.status(400).json({
          error: `Cannot approve stage "${project.stage}". No pending approval.`
        });
      }
      const updated = await storage.updateProjectStage(projectId, nextStage);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  const REDO_MAP = {
    issues_draft: "created",
    issues_approved: "created",
    hypotheses_draft: "issues_approved",
    hypotheses_approved: "issues_approved",
    execution_done: "hypotheses_approved",
    execution_approved: "hypotheses_approved",
    summary_draft: "execution_approved",
    summary_approved: "execution_approved",
    presentation_draft: "summary_approved",
    complete: "summary_approved"
  };
  app2.post("/api/projects/:id/redo", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const { step } = req.body;
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const stageMap = {
        issues: "created",
        hypotheses: "issues_approved",
        execution: "hypotheses_approved",
        summary: "execution_approved",
        presentation: "summary_approved"
      };
      const targetStage = stageMap[step];
      if (!targetStage) {
        return res.status(400).json({ error: `Invalid step "${step}"` });
      }
      const currentIdx = STAGE_ORDER.indexOf(project.stage);
      const stepDraftStages = {
        issues: "issues_draft",
        hypotheses: "hypotheses_draft",
        execution: "execution_done",
        summary: "summary_draft",
        presentation: "presentation_draft"
      };
      const draftIdx = STAGE_ORDER.indexOf(stepDraftStages[step]);
      if (currentIdx < draftIdx) {
        return res.status(400).json({
          error: `Cannot redo "${step}" \u2014 that step hasn't been run yet.`
        });
      }
      const updated = await storage.updateProjectStage(projectId, targetStage);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id/artifacts", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const [issues, hyps, plans, runs, narrs, slds] = await Promise.all([
        storage.getIssueNodes(projectId),
        storage.getHypotheses(projectId),
        storage.getAnalysisPlan(projectId),
        storage.getModelRuns(projectId),
        storage.getNarratives(projectId),
        storage.getSlides(projectId)
      ]);
      res.json({
        issueNodes: issues,
        hypotheses: hyps,
        analysisPlan: plans,
        modelRuns: runs,
        narratives: narrs,
        slides: slds
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id/logs", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const logs = await storage.getRunLogs(projectId);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/agent-configs", async (_req, res) => {
    try {
      const configs = await storage.getAllAgentConfigs();
      const defaults = getDefaultConfigs();
      const merged = defaults.map((d) => {
        const saved = configs.find((c) => c.agentType === d.agentType);
        return saved || { ...d, id: 0, updatedAt: /* @__PURE__ */ new Date() };
      });
      res.json(merged);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.put("/api/agent-configs/:agentType", async (req, res) => {
    try {
      const agentType = req.params.agentType;
      const validTypes = ["issues_tree", "hypothesis", "execution", "summary", "mece_critic", "presentation"];
      if (!validTypes.includes(agentType)) {
        return res.status(400).json({ error: "Invalid agent type" });
      }
      const { systemPrompt, model, maxTokens } = req.body;
      if (!systemPrompt) {
        return res.status(400).json({ error: "systemPrompt is required" });
      }
      const config = await storage.upsertAgentConfig({
        agentType,
        systemPrompt,
        model: model || "gpt-5-nano",
        maxTokens: maxTokens || 8192
      });
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  const AGENT_METADATA = {
    issues_tree: {
      key: "issues_tree",
      label: "Issues Tree",
      role: "Generator",
      roleColor: "#3B82F6",
      roleBg: "#EFF6FF",
      stage: "issues_draft",
      description: "Breaks down the project objective into a MECE (Mutually Exclusive, Collectively Exhaustive) issues tree with 3+ levels of depth. This is the foundational decomposition step of the consulting workflow.",
      inputs: [
        { name: "objective", type: "string", description: "The project's stated objective or governing question" },
        { name: "constraints", type: "string", description: "Known constraints, boundaries, or limitations for the analysis" }
      ],
      outputs: [
        { name: "issues", type: "IssueNode[]", description: "Array of 15-25 issue nodes forming a hierarchical tree with id, parentId, text, and priority (high/medium/low)" },
        { name: "criticLog", type: "CriticResult[]", description: "Log of MECE Critic review iterations, including scores and revision instructions" }
      ],
      outputSchema: '{\n  "issues": [\n    { "id": "1", "parentId": null, "text": "Root issue", "priority": "high" },\n    { "id": "2", "parentId": "1", "text": "Sub-issue", "priority": "medium" }\n  ]\n}',
      tools: [],
      triggerStage: "created",
      producesStage: "issues_draft"
    },
    mece_critic: {
      key: "mece_critic",
      label: "MECE Critic",
      role: "Quality Gate",
      roleColor: "#8B5CF6",
      roleBg: "#F5F3FF",
      stage: "issues_draft",
      description: "Quality gate that audits the issues tree for MECE compliance. Scores across 5 criteria (overlap, coverage, mixed logics, branch balance, label quality) on a 1-5 scale. If score < 4, sends revision instructions back to the Issues Tree agent. Runs up to 2 revision loops.",
      inputs: [
        { name: "issues", type: "IssueNode[]", description: "The generated issues tree to evaluate" },
        { name: "objective", type: "string", description: "The original project objective for context" }
      ],
      outputs: [
        { name: "verdict", type: "'approved' | 'revise'", description: "Whether the tree passes quality review or needs revision" },
        { name: "scores", type: "CriticScores", description: "Detailed scores (1-5) for overlap, coverage, mixed logics, branch balance, and label quality" },
        { name: "overallScore", type: "number", description: "Aggregate score from 1-5. Tree is approved if >= 4" },
        { name: "revisionInstructions", type: "string", description: "Specific instructions for what the Issues Tree agent should fix" }
      ],
      outputSchema: '{\n  "verdict": "approved" | "revise",\n  "scores": {\n    "overlap": { "score": 4, "details": "..." },\n    "coverage": { "score": 5, "details": "..." },\n    "mixedLogics": { "score": 4, "details": "..." },\n    "branchBalance": { "score": 3, "details": "..." },\n    "labelQuality": { "score": 5, "details": "..." }\n  },\n  "overallScore": 4,\n  "revisionInstructions": ""\n}',
      tools: [],
      triggerStage: "issues_draft",
      producesStage: "issues_approved"
    },
    hypothesis: {
      key: "hypothesis",
      label: "Hypothesis",
      role: "Analyst",
      roleColor: "#0891B2",
      roleBg: "#ECFEFF",
      stage: "hypotheses_draft",
      description: "Generates testable hypotheses linked to the top issues from the tree, and creates a structured analysis plan. Each hypothesis includes a statement, metric, data source, and method. The analysis plan defines parameters for the scenario calculator tool.",
      inputs: [
        { name: "issues", type: "IssueNode[]", description: "The approved issues tree nodes, with id, text, and priority" }
      ],
      outputs: [
        { name: "hypotheses", type: "HypothesisOutput[]", description: "2-4 testable hypotheses, each linked to an issue node with statement, metric, data source, and method" },
        { name: "analysisPlan", type: "AnalysisPlanOutput[]", description: "Corresponding execution plans with method, financial parameters, and required dataset" }
      ],
      outputSchema: '{\n  "hypotheses": [\n    {\n      "issueNodeId": "1",\n      "statement": "If we address X, we achieve Y",\n      "metric": "Revenue growth %",\n      "dataSource": "Industry benchmarks",\n      "method": "scenario_analysis"\n    }\n  ],\n  "analysisPlan": [\n    {\n      "hypothesisIndex": 0,\n      "method": "run_scenario_tool",\n      "parameters": {\n        "baselineRevenue": 1000000,\n        "growthRate": 0.1,\n        "costReduction": 0.05,\n        "timeHorizonYears": 5,\n        "volatility": 0.15\n      },\n      "requiredDataset": "Financial projections"\n    }\n  ]\n}',
      tools: [],
      triggerStage: "issues_approved",
      producesStage: "hypotheses_draft"
    },
    execution: {
      key: "execution",
      label: "Execution",
      role: "Tool Caller",
      roleColor: "#059669",
      roleBg: "#ECFDF5",
      stage: "execution_done",
      description: "Executes the analysis plan by calling the Scenario Calculator tool for each hypothesis. Performs financial scenario analysis with baseline, optimistic, and pessimistic projections, calculates NPV, expected value, and risk-adjusted returns. This is the only agent that uses real tool calling.",
      inputs: [
        { name: "analysisPlan", type: "AnalysisPlanOutput[]", description: "Array of analysis plans from the Hypothesis agent, each specifying method and financial parameters" }
      ],
      outputs: [
        { name: "results", type: "ToolCallResult[]", description: "Array of tool call results with tool name, input parameters, and full scenario output including baseline/optimistic/pessimistic projections and NPV summary" }
      ],
      outputSchema: '[\n  {\n    "toolName": "run_scenario_tool",\n    "inputs": {\n      "baselineRevenue": 1000000,\n      "growthRate": 0.1,\n      "costReduction": 0.05,\n      "timeHorizonYears": 5,\n      "volatility": 0.15\n    },\n    "outputs": {\n      "baseline": [{ "year": 1, "revenue": ..., "costs": ..., "profit": ... }],\n      "optimistic": [...],\n      "pessimistic": [...],\n      "summary": {\n        "baselineNPV": ...,\n        "optimisticNPV": ...,\n        "pessimisticNPV": ...,\n        "expectedValue": ...,\n        "riskAdjustedReturn": ...\n      }\n    }\n  }\n]',
      tools: [
        {
          name: "run_scenario_tool",
          description: "Financial scenario calculator that projects revenue, costs, and profit across baseline, optimistic, and pessimistic scenarios over a configurable time horizon",
          parameters: {
            baselineRevenue: "number \u2014 Starting annual revenue",
            growthRate: "number (0-1) \u2014 Annual growth rate",
            costReduction: "number (0-1) \u2014 Expected cost reduction factor",
            timeHorizonYears: "integer \u2014 Projection period in years",
            volatility: "number (0-1) \u2014 Market volatility factor for scenario spread"
          }
        }
      ],
      triggerStage: "hypotheses_approved",
      producesStage: "execution_done"
    },
    summary: {
      key: "summary",
      label: "Summary",
      role: "Synthesizer",
      roleColor: "#D97706",
      roleBg: "#FFFBEB",
      stage: "summary_draft",
      description: "Synthesizes all analysis results into a structured executive summary with Key Findings, Recommendations, and Next Steps. Uses markdown formatting for rich text rendering. The output reads like a senior partner's memo to a client.",
      inputs: [
        { name: "objective", type: "string", description: "The original project objective" },
        { name: "constraints", type: "string", description: "Project constraints" },
        { name: "hypotheses", type: "Hypothesis[]", description: "The tested hypotheses with statement and metric" },
        { name: "modelRuns", type: "ModelRun[]", description: "Execution results with input/output JSON from scenario analysis" }
      ],
      outputs: [
        { name: "summaryText", type: "string (markdown)", description: "Full executive summary in markdown format with headings, bullet points, and numbered lists" }
      ],
      outputSchema: '"# Executive Summary\\n\\n## Key Findings\\n- Finding 1: ...\\n- Finding 2: ...\\n\\n## Recommendation\\nBased on...\\n\\n## Next Steps\\n1. Step one\\n2. Step two"',
      tools: [],
      triggerStage: "execution_approved",
      producesStage: "summary_draft"
    },
    presentation: {
      key: "presentation",
      label: "Presentation",
      role: "Designer",
      roleColor: "#E11D48",
      roleBg: "#FFF1F2",
      stage: "presentation_draft",
      description: "Generates a professional 16:9 slide deck from the analysis results. Produces 6-10 slides using 5 layout types: title_slide, section_header, title_body, two_column, and metrics. Each slide includes speaker notes. The deck follows a standard consulting structure: Title, Executive Summary, Key Findings, Analysis Results, Recommendations, Next Steps.",
      inputs: [
        { name: "projectName", type: "string", description: "Project name for the title slide" },
        { name: "objective", type: "string", description: "Project objective" },
        { name: "summaryText", type: "string", description: "The executive summary text" },
        { name: "hypotheses", type: "Hypothesis[]", description: "Tested hypotheses" },
        { name: "modelRuns", type: "ModelRun[]", description: "Scenario analysis results" }
      ],
      outputs: [
        { name: "slides", type: "SlideOutput[]", description: "Array of 6-10 slide objects, each with slideIndex, layout, title, subtitle, bodyJson, and notesText" }
      ],
      outputSchema: '{\n  "slides": [\n    {\n      "slideIndex": 0,\n      "layout": "title_slide",\n      "title": "Project Name",\n      "subtitle": "Strategic Analysis",\n      "bodyJson": {},\n      "notesText": "Speaker notes"\n    }\n  ]\n}',
      tools: [],
      triggerStage: "summary_approved",
      producesStage: "presentation_draft"
    }
  };
  app2.get("/api/agents", async (_req, res) => {
    try {
      const configs = await storage.getAllAgentConfigs();
      const agents = Object.values(AGENT_METADATA).map((meta) => {
        const saved = configs.find((c) => c.agentType === meta.key);
        return {
          ...meta,
          systemPrompt: saved?.systemPrompt || DEFAULT_PROMPTS[meta.key] || "",
          model: saved?.model || "gpt-5-nano",
          maxTokens: saved?.maxTokens || 8192
        };
      });
      res.json(agents);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/agents/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const meta = AGENT_METADATA[key];
      if (!meta) return res.status(404).json({ error: "Agent not found" });
      const saved = await storage.getAgentConfig(key);
      res.json({
        ...meta,
        systemPrompt: saved?.systemPrompt || DEFAULT_PROMPTS[key] || "",
        model: saved?.model || "gpt-5-nano",
        maxTokens: saved?.maxTokens || 8192
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/pipelines", async (_req, res) => {
    try {
      const pipelines = await storage.listPipelines();
      res.json(pipelines);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/pipelines", async (req, res) => {
    try {
      const { name, agentsJson } = req.body;
      if (!name || !agentsJson) {
        return res.status(400).json({ error: "name and agentsJson are required" });
      }
      const pipeline = await storage.createPipeline({ name, agentsJson });
      res.status(201).json(pipeline);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/pipelines/:id", async (req, res) => {
    try {
      const pipeline = await storage.getPipeline(Number(req.params.id));
      if (!pipeline) return res.status(404).json({ error: "Not found" });
      res.json(pipeline);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.put("/api/pipelines/:id", async (req, res) => {
    try {
      const { name, agentsJson } = req.body;
      const pipeline = await storage.updatePipeline(Number(req.params.id), {
        name,
        agentsJson
      });
      res.json(pipeline);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/pipelines/:id", async (req, res) => {
    try {
      await storage.deletePipeline(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  const httpServer = (0, import_node_http.createServer)(app2);
  return httpServer;
}

// server/index.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var app = (0, import_express.default)();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    import_express.default.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(import_express.default.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!reqPath.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
async function setupViteDevMiddleware(app2) {
  const { createServer: createServer2 } = await import("vite");
  const vite = await createServer2({
    root: path.resolve(process.cwd(), "client"),
    server: { middlewareMode: true, hmr: true },
    appType: "spa"
  });
  app2.use(vite.middlewares);
  log("Vite dev server middleware attached");
}
function serveProductionFrontend(app2) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (fs.existsSync(distPath)) {
    app2.use(import_express.default.static(distPath));
    app2.get("/*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
    log("Serving production build from dist/public");
  } else {
    log("Warning: No production build found at dist/public");
  }
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  const server = await registerRoutes(app);
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    await setupViteDevMiddleware(app);
  } else {
    serveProductionFrontend(app);
  }
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
