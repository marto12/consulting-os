var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  agentConfigs: () => agentConfigs,
  agents: () => agents,
  analysisPlan: () => analysisPlan,
  conversations: () => conversations,
  datasets: () => datasets,
  deliverables: () => deliverables,
  hypotheses: () => hypotheses,
  insertProjectSchema: () => insertProjectSchema,
  issueNodes: () => issueNodes,
  messages: () => messages,
  modelRuns: () => modelRuns,
  models: () => models,
  narratives: () => narratives,
  pipelineConfigs: () => pipelineConfigs,
  projects: () => projects,
  runLogs: () => runLogs,
  slides: () => slides,
  workflowInstanceSteps: () => workflowInstanceSteps,
  workflowInstances: () => workflowInstances,
  workflowTemplateSteps: () => workflowTemplateSteps,
  workflowTemplates: () => workflowTemplates
});
import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var workflowTemplates = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var workflowTemplateSteps = pgTable("workflow_template_steps", {
  id: serial("id").primaryKey(),
  workflowTemplateId: integer("workflow_template_id").notNull().references(() => workflowTemplates.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  name: text("name").notNull(),
  agentKey: text("agent_key").notNull(),
  description: text("description").notNull().default(""),
  configJson: jsonb("config_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  role: text("role").notNull().default(""),
  roleColor: text("role_color").notNull().default("#3B82F6"),
  promptTemplate: text("prompt_template").notNull().default(""),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  toolRefs: jsonb("tool_refs").default(sql`'[]'::jsonb`),
  datasetRefs: jsonb("dataset_refs").default(sql`'[]'::jsonb`),
  modelRefs: jsonb("model_refs").default(sql`'[]'::jsonb`),
  model: text("model").notNull().default("gpt-5-nano"),
  maxTokens: integer("max_tokens").notNull().default(8192),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  owner: text("owner").notNull().default("system"),
  accessLevel: text("access_level").notNull().default("private"),
  schemaJson: jsonb("schema_json"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var models = pgTable("models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  apiConfig: jsonb("api_config"),
  linkedWorkflowIds: jsonb("linked_workflow_ids").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  constraints: text("constraints").notNull(),
  stage: text("stage").notNull().default("created"),
  workflowTemplateId: integer("workflow_template_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var workflowInstances = pgTable("workflow_instances", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workflowTemplateId: integer("workflow_template_id").notNull(),
  currentStepOrder: integer("current_step_order").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var workflowInstanceSteps = pgTable("workflow_instance_steps", {
  id: serial("id").primaryKey(),
  workflowInstanceId: integer("workflow_instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  name: text("name").notNull(),
  agentKey: text("agent_key").notNull(),
  status: text("status").notNull().default("not_started"),
  configJson: jsonb("config_json"),
  outputSummary: jsonb("output_summary"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stepId: integer("step_id").notNull().references(() => workflowInstanceSteps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  contentJson: jsonb("content_json").notNull(),
  version: integer("version").notNull().default(1),
  locked: boolean("locked").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var issueNodes = pgTable("issue_nodes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  text: text("text").notNull(),
  priority: text("priority").notNull().default("medium"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var hypotheses = pgTable("hypotheses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  issueNodeId: integer("issue_node_id"),
  statement: text("statement").notNull(),
  metric: text("metric").notNull(),
  dataSource: text("data_source").notNull(),
  method: text("method").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var analysisPlan = pgTable("analysis_plan", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  hypothesisId: integer("hypothesis_id"),
  method: text("method").notNull(),
  parametersJson: jsonb("parameters_json").notNull(),
  requiredDataset: text("required_dataset").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var modelRuns = pgTable("model_runs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  inputsJson: jsonb("inputs_json").notNull(),
  outputsJson: jsonb("outputs_json").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var narratives = pgTable("narratives", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  summaryText: text("summary_text").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var runLogs = pgTable("run_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json"),
  modelUsed: text("model_used").notNull(),
  status: text("status").notNull().default("pending"),
  errorText: text("error_text"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var slides = pgTable("slides", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  slideIndex: integer("slide_index").notNull(),
  layout: text("layout").notNull().default("title_body"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  bodyJson: jsonb("body_json").notNull(),
  notesText: text("notes_text"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var agentConfigs = pgTable("agent_configs", {
  id: serial("id").primaryKey(),
  agentType: text("agent_type").notNull().unique(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-5-nano"),
  maxTokens: integer("max_tokens").notNull().default(8192),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  projectId: integer("project_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var pipelineConfigs = pgTable("pipeline_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentsJson: jsonb("agents_json").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  stage: true,
  createdAt: true,
  updatedAt: true
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, desc, asc } from "drizzle-orm";
var storage = {
  async createProject(data) {
    const [project] = await db.insert(projects).values({ ...data, stage: "created" }).returning();
    return project;
  },
  async listProjects() {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  },
  async getProject(id) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  },
  async updateProjectStage(id, stage) {
    const [project] = await db.update(projects).set({ stage, updatedAt: /* @__PURE__ */ new Date() }).where(eq(projects.id, id)).returning();
    return project;
  },
  async createWorkflowTemplate(data) {
    const [template] = await db.insert(workflowTemplates).values({ name: data.name, description: data.description || "" }).returning();
    return template;
  },
  async listWorkflowTemplates() {
    return db.select().from(workflowTemplates).orderBy(desc(workflowTemplates.updatedAt));
  },
  async getWorkflowTemplate(id) {
    const [template] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id));
    return template;
  },
  async updateWorkflowTemplate(id, data) {
    const [template] = await db.update(workflowTemplates).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workflowTemplates.id, id)).returning();
    return template;
  },
  async getWorkflowTemplateSteps(templateId) {
    return db.select().from(workflowTemplateSteps).where(eq(workflowTemplateSteps.workflowTemplateId, templateId)).orderBy(asc(workflowTemplateSteps.stepOrder));
  },
  async addWorkflowTemplateStep(data) {
    const [step] = await db.insert(workflowTemplateSteps).values({
      workflowTemplateId: data.workflowTemplateId,
      stepOrder: data.stepOrder,
      name: data.name,
      agentKey: data.agentKey,
      description: data.description || "",
      configJson: data.configJson || null
    }).returning();
    return step;
  },
  async deleteWorkflowTemplateStep(id) {
    await db.delete(workflowTemplateSteps).where(eq(workflowTemplateSteps.id, id));
  },
  async listAgents() {
    return db.select().from(agents).orderBy(asc(agents.key));
  },
  async getAgent(id) {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  },
  async getAgentByKey(key) {
    const [agent] = await db.select().from(agents).where(eq(agents.key, key));
    return agent;
  },
  async upsertAgent(data) {
    const existing = await this.getAgentByKey(data.key);
    if (existing) {
      const [updated] = await db.update(agents).set({
        name: data.name,
        description: data.description ?? existing.description,
        role: data.role ?? existing.role,
        roleColor: data.roleColor ?? existing.roleColor,
        promptTemplate: data.promptTemplate ?? existing.promptTemplate,
        model: data.model ?? existing.model,
        maxTokens: data.maxTokens ?? existing.maxTokens,
        inputSchema: data.inputSchema ?? existing.inputSchema,
        outputSchema: data.outputSchema ?? existing.outputSchema,
        toolRefs: data.toolRefs ?? existing.toolRefs,
        datasetRefs: data.datasetRefs ?? existing.datasetRefs,
        modelRefs: data.modelRefs ?? existing.modelRefs,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(agents.key, data.key)).returning();
      return updated;
    }
    const [created] = await db.insert(agents).values({
      key: data.key,
      name: data.name,
      description: data.description || "",
      role: data.role || "",
      roleColor: data.roleColor || "#3B82F6",
      promptTemplate: data.promptTemplate || "",
      model: data.model || "gpt-5-nano",
      maxTokens: data.maxTokens || 8192,
      inputSchema: data.inputSchema || null,
      outputSchema: data.outputSchema || null,
      toolRefs: data.toolRefs || [],
      datasetRefs: data.datasetRefs || [],
      modelRefs: data.modelRefs || []
    }).returning();
    return created;
  },
  async listDatasets() {
    return db.select().from(datasets).orderBy(desc(datasets.createdAt));
  },
  async getDataset(id) {
    const [d] = await db.select().from(datasets).where(eq(datasets.id, id));
    return d;
  },
  async createDataset(data) {
    const [d] = await db.insert(datasets).values({
      name: data.name,
      description: data.description || "",
      owner: data.owner || "system",
      accessLevel: data.accessLevel || "private",
      schemaJson: data.schemaJson || null,
      metadata: data.metadata || null
    }).returning();
    return d;
  },
  async listModels() {
    return db.select().from(models).orderBy(desc(models.createdAt));
  },
  async getModel(id) {
    const [m] = await db.select().from(models).where(eq(models.id, id));
    return m;
  },
  async createModel(data) {
    const [m] = await db.insert(models).values({
      name: data.name,
      description: data.description || "",
      inputSchema: data.inputSchema || null,
      outputSchema: data.outputSchema || null,
      apiConfig: data.apiConfig || null
    }).returning();
    return m;
  },
  async createWorkflowInstance(data) {
    const [instance] = await db.insert(workflowInstances).values({
      projectId: data.projectId,
      workflowTemplateId: data.workflowTemplateId,
      currentStepOrder: 0,
      status: "active"
    }).returning();
    if (data.steps.length > 0) {
      await db.insert(workflowInstanceSteps).values(
        data.steps.map((s) => ({
          workflowInstanceId: instance.id,
          stepOrder: s.stepOrder,
          name: s.name,
          agentKey: s.agentKey,
          status: "not_started",
          configJson: s.configJson || null
        }))
      );
    }
    return instance;
  },
  async getWorkflowInstance(projectId) {
    const [instance] = await db.select().from(workflowInstances).where(eq(workflowInstances.projectId, projectId)).orderBy(desc(workflowInstances.createdAt));
    return instance;
  },
  async getWorkflowInstanceSteps(instanceId) {
    return db.select().from(workflowInstanceSteps).where(eq(workflowInstanceSteps.workflowInstanceId, instanceId)).orderBy(asc(workflowInstanceSteps.stepOrder));
  },
  async getWorkflowInstanceStep(stepId) {
    const [step] = await db.select().from(workflowInstanceSteps).where(eq(workflowInstanceSteps.id, stepId));
    return step;
  },
  async updateWorkflowInstanceStep(stepId, data) {
    const [step] = await db.update(workflowInstanceSteps).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workflowInstanceSteps.id, stepId)).returning();
    return step;
  },
  async updateWorkflowInstanceCurrentStep(instanceId, stepOrder) {
    const [instance] = await db.update(workflowInstances).set({ currentStepOrder: stepOrder, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workflowInstances.id, instanceId)).returning();
    return instance;
  },
  async createDeliverable(data) {
    const [d] = await db.insert(deliverables).values({
      projectId: data.projectId,
      stepId: data.stepId,
      title: data.title,
      contentJson: data.contentJson,
      version: data.version || 1,
      locked: false
    }).returning();
    return d;
  },
  async getDeliverables(projectId) {
    return db.select().from(deliverables).where(eq(deliverables.projectId, projectId)).orderBy(desc(deliverables.createdAt));
  },
  async getStepDeliverables(stepId) {
    return db.select().from(deliverables).where(eq(deliverables.stepId, stepId)).orderBy(desc(deliverables.version));
  },
  async lockDeliverables(stepId) {
    await db.update(deliverables).set({ locked: true }).where(eq(deliverables.stepId, stepId));
  },
  async getLatestIssueVersion(projectId) {
    const nodes = await db.select().from(issueNodes).where(eq(issueNodes.projectId, projectId)).orderBy(desc(issueNodes.version));
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
    return db.select().from(issueNodes).where(eq(issueNodes.projectId, projectId)).orderBy(desc(issueNodes.version), issueNodes.id);
  },
  async getLatestHypothesisVersion(projectId) {
    const hyps = await db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).orderBy(desc(hypotheses.version));
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
    return db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).orderBy(desc(hypotheses.version), hypotheses.id);
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
    return db.select().from(analysisPlan).where(eq(analysisPlan.projectId, projectId)).orderBy(analysisPlan.id);
  },
  async insertModelRun(projectId, toolName, inputsJson, outputsJson) {
    const [run] = await db.insert(modelRuns).values({ projectId, toolName, inputsJson, outputsJson }).returning();
    return run;
  },
  async getModelRuns(projectId) {
    return db.select().from(modelRuns).where(eq(modelRuns.projectId, projectId)).orderBy(modelRuns.id);
  },
  async getLatestNarrativeVersion(projectId) {
    const narrs = await db.select().from(narratives).where(eq(narratives.projectId, projectId)).orderBy(desc(narratives.version));
    return narrs[0]?.version || 0;
  },
  async insertNarrative(projectId, version, summaryText) {
    const [narr] = await db.insert(narratives).values({ projectId, summaryText, version }).returning();
    return narr;
  },
  async getNarratives(projectId) {
    return db.select().from(narratives).where(eq(narratives.projectId, projectId)).orderBy(desc(narratives.version));
  },
  async insertRunLog(projectId, stage, inputJson, modelUsed, status = "pending") {
    const [log2] = await db.insert(runLogs).values({ projectId, stage, inputJson, modelUsed, status }).returning();
    return log2;
  },
  async updateRunLog(id, outputJson, status, errorText) {
    const [log2] = await db.update(runLogs).set({ outputJson, status, errorText }).where(eq(runLogs.id, id)).returning();
    return log2;
  },
  async getRunLogs(projectId) {
    return db.select().from(runLogs).where(eq(runLogs.projectId, projectId)).orderBy(desc(runLogs.createdAt));
  },
  async getLatestSlideVersion(projectId) {
    const s = await db.select().from(slides).where(eq(slides.projectId, projectId)).orderBy(desc(slides.version));
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
    return db.select().from(slides).where(eq(slides.projectId, projectId)).orderBy(desc(slides.version), slides.slideIndex);
  },
  async getAllAgentConfigs() {
    return db.select().from(agentConfigs);
  },
  async getAgentConfig(agentType) {
    const [config] = await db.select().from(agentConfigs).where(eq(agentConfigs.agentType, agentType));
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
      }).where(eq(agentConfigs.agentType, data.agentType)).returning();
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
    return db.select().from(pipelineConfigs).orderBy(desc(pipelineConfigs.updatedAt));
  },
  async getPipeline(id) {
    const [pipeline] = await db.select().from(pipelineConfigs).where(eq(pipelineConfigs.id, id));
    return pipeline;
  },
  async updatePipeline(id, data) {
    const [pipeline] = await db.update(pipelineConfigs).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(pipelineConfigs.id, id)).returning();
    return pipeline;
  },
  async deletePipeline(id) {
    await db.delete(pipelineConfigs).where(eq(pipelineConfigs.id, id));
  }
};

// server/replit_integrations/chat/routes.ts
import OpenAI from "openai";

// server/replit_integrations/chat/storage.ts
import { eq as eq2, desc as desc2 } from "drizzle-orm";
var chatStorage = {
  async getConversation(id) {
    const [conversation] = await db.select().from(conversations).where(eq2(conversations.id, id));
    return conversation;
  },
  async getAllConversations() {
    return db.select().from(conversations).orderBy(desc2(conversations.createdAt));
  },
  async createConversation(title) {
    const [conversation] = await db.insert(conversations).values({ title }).returning();
    return conversation;
  },
  async deleteConversation(id) {
    await db.delete(messages).where(eq2(messages.conversationId, id));
    await db.delete(conversations).where(eq2(conversations.id, id));
  },
  async getMessagesByConversation(conversationId) {
    return db.select().from(messages).where(eq2(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },
  async createMessage(conversationId, role, content) {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  }
};

// server/replit_integrations/chat/routes.ts
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
function registerChatRoutes(app2) {
  app2.get("/api/conversations", async (req, res) => {
    try {
      const conversations3 = await chatStorage.getAllConversations();
      res.json(conversations3);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  app2.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages3 = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages: messages3 });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  app2.post("/api/conversations", async (req, res) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  app2.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });
  app2.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;
      await chatStorage.createMessage(conversationId, "user", content);
      const messages3 = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages3.map((m) => ({
        role: m.role,
        content: m.content
      }));
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192
      });
      let fullResponse = "";
      for await (const chunk of stream) {
        const content2 = chunk.choices[0]?.delta?.content || "";
        if (content2) {
          fullResponse += content2;
          res.write(`data: ${JSON.stringify({ content: content2 })}

`);
        }
      }
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);
      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}

`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

// server/agents/index.ts
import OpenAI2 from "openai";

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
var openai2 = null;
if (hasApiKey) {
  openai2 = new OpenAI2({
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
  if (!openai2) {
    return "";
  }
  const resolvedModel = model || DEFAULT_MODEL;
  const resolvedTokens = maxTokens || 8192;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const messages3 = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: attempt > 0 ? `${userPrompt}

IMPORTANT: Your previous response was truncated. Please produce a SHORTER, more concise response that fits within the token limit. Use fewer nodes, shorter descriptions, and minimal whitespace in JSON output.` : userPrompt
      }
    ];
    const response = await openai2.chat.completions.create({
      model: resolvedModel,
      messages: messages3,
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
  if (!openai2) {
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
  if (!openai2) {
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
  if (!openai2) {
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
  if (!openai2) {
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
var DEFAULT_AGENTS = [
  { key: "issues_tree", name: "Issues Tree", role: "Generator", roleColor: "#3B82F6", description: "Builds MECE issues tree from project objective" },
  { key: "mece_critic", name: "MECE Critic", role: "Quality Gate", roleColor: "#8B5CF6", description: "Validates MECE structure and compliance" },
  { key: "hypothesis", name: "Hypothesis", role: "Analyst", roleColor: "#0891B2", description: "Generates testable hypotheses and analysis plans" },
  { key: "execution", name: "Execution", role: "Tool Caller", roleColor: "#059669", description: "Runs scenario analysis with calculator tool" },
  { key: "summary", name: "Summary", role: "Synthesizer", roleColor: "#D97706", description: "Synthesizes findings into executive summary" },
  { key: "presentation", name: "Presentation", role: "Designer", roleColor: "#E11D48", description: "Creates professional slide deck" }
];
var DEFAULT_WORKFLOW_STEPS = [
  { stepOrder: 1, name: "Issues Tree", agentKey: "issues_tree" },
  { stepOrder: 2, name: "Hypotheses & Analysis Plan", agentKey: "hypothesis" },
  { stepOrder: 3, name: "Execution", agentKey: "execution" },
  { stepOrder: 4, name: "Executive Summary", agentKey: "summary" },
  { stepOrder: 5, name: "Presentation", agentKey: "presentation" }
];
async function ensureDefaults() {
  for (const a of DEFAULT_AGENTS) {
    await storage.upsertAgent(a);
  }
  const templates = await storage.listWorkflowTemplates();
  if (templates.length === 0) {
    const template = await storage.createWorkflowTemplate({
      name: "Consulting Analysis",
      description: "Standard consulting workflow: Issues Tree -> Hypotheses -> Execution -> Summary -> Presentation"
    });
    for (const step of DEFAULT_WORKFLOW_STEPS) {
      await storage.addWorkflowTemplateStep({
        workflowTemplateId: template.id,
        ...step
      });
    }
  }
}
async function registerRoutes(app2) {
  await ensureDefaults();
  app2.post("/api/projects", async (req, res) => {
    try {
      const { name, objective, constraints, workflowTemplateId } = req.body;
      if (!name || !objective || !constraints) {
        return res.status(400).json({ error: "name, objective, and constraints are required" });
      }
      const templates = await storage.listWorkflowTemplates();
      const templateId = workflowTemplateId || templates[0]?.id;
      const project = await storage.createProject({
        name,
        objective,
        constraints,
        workflowTemplateId: templateId || null
      });
      if (templateId) {
        const templateSteps = await storage.getWorkflowTemplateSteps(templateId);
        await storage.createWorkflowInstance({
          projectId: project.id,
          workflowTemplateId: templateId,
          steps: templateSteps.map((s) => ({
            stepOrder: s.stepOrder,
            name: s.name,
            agentKey: s.agentKey,
            configJson: s.configJson
          }))
        });
      }
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
  app2.get("/api/projects/:id/workflow", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const instance = await storage.getWorkflowInstance(projectId);
      if (!instance) return res.json({ instance: null, steps: [] });
      const steps = await storage.getWorkflowInstanceSteps(instance.id);
      res.json({ instance, steps });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id/deliverables", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const dels = await storage.getDeliverables(projectId);
      res.json(dels);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id/run-logs", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const logs = await storage.getRunLogs(projectId);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id/workflow/steps/:stepId", async (req, res) => {
    try {
      const stepId = Number(req.params.stepId);
      const step = await storage.getWorkflowInstanceStep(stepId);
      if (!step) return res.status(404).json({ error: "Step not found" });
      const stepDeliverables = await storage.getStepDeliverables(stepId);
      res.json({ step, deliverables: stepDeliverables });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/projects/:id/workflow/steps/:stepId/run", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const stepId = Number(req.params.stepId);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const step = await storage.getWorkflowInstanceStep(stepId);
      if (!step) return res.status(404).json({ error: "Step not found" });
      await storage.updateWorkflowInstanceStep(stepId, { status: "running" });
      const modelUsed = getModelUsed();
      const runLog = await storage.insertRunLog(
        projectId,
        step.agentKey,
        { stepId, agentKey: step.agentKey },
        modelUsed
      );
      try {
        let deliverableContent = null;
        let deliverableTitle = step.name;
        if (step.agentKey === "issues_tree") {
          const result = await issuesTreeAgent(project.objective, project.constraints);
          const version = await storage.getLatestIssueVersion(projectId) + 1;
          const idMap = /* @__PURE__ */ new Map();
          let remaining = [...result.issues];
          let pass = 0;
          while (remaining.length > 0 && pass < 10) {
            pass++;
            const canInsert = remaining.filter((n) => !n.parentId || idMap.has(n.parentId));
            const cannotInsert = remaining.filter((n) => n.parentId && !idMap.has(n.parentId));
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
          deliverableContent = result;
          deliverableTitle = "Issues Tree";
          await storage.updateProjectStage(projectId, "issues_draft");
        } else if (step.agentKey === "hypothesis") {
          const issueNodesData = await storage.getIssueNodes(projectId);
          const latestVersion = issueNodesData[0]?.version || 1;
          const latestIssues = issueNodesData.filter((n) => n.version === latestVersion);
          const result = await hypothesisAgent(latestIssues.map((n) => ({ id: n.id, text: n.text, priority: n.priority })));
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
          deliverableContent = result;
          deliverableTitle = "Hypotheses & Analysis Plan";
          await storage.updateProjectStage(projectId, "hypotheses_draft");
        } else if (step.agentKey === "execution") {
          const plans = await storage.getAnalysisPlan(projectId);
          const results = await executionAgent(
            plans.map((p) => ({ method: p.method, parameters: p.parametersJson, requiredDataset: p.requiredDataset }))
          );
          for (const r of results) {
            await storage.insertModelRun(projectId, r.toolName, r.inputs, r.outputs);
          }
          deliverableContent = results;
          deliverableTitle = "Scenario Analysis Results";
          await storage.updateProjectStage(projectId, "execution_done");
        } else if (step.agentKey === "summary") {
          const hyps = await storage.getHypotheses(projectId);
          const runs = await storage.getModelRuns(projectId);
          const latestVersion = hyps[0]?.version || 1;
          const latestHyps = hyps.filter((h) => h.version === latestVersion);
          const result = await summaryAgent(
            project.objective,
            project.constraints,
            latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
            runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson }))
          );
          const version = await storage.getLatestNarrativeVersion(projectId) + 1;
          await storage.insertNarrative(projectId, version, result.summaryText);
          deliverableContent = result;
          deliverableTitle = "Executive Summary";
          await storage.updateProjectStage(projectId, "summary_draft");
        } else if (step.agentKey === "presentation") {
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
            latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
            runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson }))
          );
          const slideVersion = await storage.getLatestSlideVersion(projectId) + 1;
          await storage.insertSlides(
            projectId,
            slideVersion,
            result.slides.map((s) => ({
              slideIndex: s.slideIndex,
              layout: s.layout,
              title: s.title,
              subtitle: s.subtitle || void 0,
              bodyJson: s.bodyJson,
              notesText: s.notesText || void 0
            }))
          );
          deliverableContent = result;
          deliverableTitle = "Presentation Deck";
          await storage.updateProjectStage(projectId, "presentation_draft");
        }
        if (deliverableContent) {
          await storage.createDeliverable({
            projectId,
            stepId,
            title: deliverableTitle,
            contentJson: deliverableContent
          });
        }
        await storage.updateWorkflowInstanceStep(stepId, {
          status: "completed",
          outputSummary: { title: deliverableTitle }
        });
        await storage.updateRunLog(runLog.id, deliverableContent, "success");
        const updatedProject = await storage.getProject(projectId);
        const instance = await storage.getWorkflowInstance(projectId);
        if (instance) {
          await storage.updateWorkflowInstanceCurrentStep(instance.id, step.stepOrder);
        }
        res.json({ project: updatedProject, step: await storage.getWorkflowInstanceStep(stepId) });
      } catch (agentErr) {
        await storage.updateWorkflowInstanceStep(stepId, { status: "failed" });
        await storage.updateRunLog(runLog.id, null, "failed", agentErr.message);
        res.status(500).json({ error: `Agent failed: ${agentErr.message}` });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/projects/:id/workflow/steps/:stepId/approve", async (req, res) => {
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
        return res.status(400).json({ error: `Cannot run next stage from "${project.stage}".` });
      }
      const instance = await storage.getWorkflowInstance(projectId);
      if (instance) {
        const steps = await storage.getWorkflowInstanceSteps(instance.id);
        const agentKeyMap = {
          issues_draft: "issues_tree",
          hypotheses_draft: "hypothesis",
          execution_done: "execution",
          summary_draft: "summary",
          presentation_draft: "presentation"
        };
        const targetAgent = agentKeyMap[nextStage];
        const targetStep = steps.find((s) => s.agentKey === targetAgent);
        if (targetStep) {
          const stepRunRes = await fetch(`http://localhost:5000/api/projects/${projectId}/workflow/steps/${targetStep.id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          const result = await stepRunRes.json();
          if (!stepRunRes.ok) {
            return res.status(stepRunRes.status).json(result);
          }
          return res.json(result.project || await storage.getProject(projectId));
        }
      }
      const modelUsed = getModelUsed();
      const runLog = await storage.insertRunLog(projectId, nextStage, { currentStage: project.stage }, modelUsed);
      try {
        if (nextStage === "issues_draft") {
          const result = await issuesTreeAgent(project.objective, project.constraints);
          const version = await storage.getLatestIssueVersion(projectId) + 1;
          const idMap = /* @__PURE__ */ new Map();
          let remaining = [...result.issues];
          let pass = 0;
          while (remaining.length > 0 && pass < 10) {
            pass++;
            const canInsert = remaining.filter((n) => !n.parentId || idMap.has(n.parentId));
            const cannotInsert = remaining.filter((n) => n.parentId && !idMap.has(n.parentId));
            if (canInsert.length === 0) break;
            const insertedNodes = await storage.insertIssueNodes(
              projectId,
              version,
              canInsert.map((n) => ({ parentId: n.parentId ? idMap.get(n.parentId) || null : null, text: n.text, priority: n.priority }))
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
          const latestIssues = issueNodesData.filter((n) => n.version === latestVersion);
          const result = await hypothesisAgent(latestIssues.map((n) => ({ id: n.id, text: n.text, priority: n.priority })));
          const version = await storage.getLatestHypothesisVersion(projectId) + 1;
          const insertedHyps = await storage.insertHypotheses(
            projectId,
            version,
            result.hypotheses.map((h) => ({ issueNodeId: null, statement: h.statement, metric: h.metric, dataSource: h.dataSource, method: h.method }))
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
          const results = await executionAgent(plans.map((p) => ({ method: p.method, parameters: p.parametersJson, requiredDataset: p.requiredDataset })));
          for (const r of results) {
            await storage.insertModelRun(projectId, r.toolName, r.inputs, r.outputs);
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
            latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
            runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson }))
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
            latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
            runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson }))
          );
          const slideVersion = await storage.getLatestSlideVersion(projectId) + 1;
          await storage.insertSlides(
            projectId,
            slideVersion,
            result.slides.map((s) => ({ slideIndex: s.slideIndex, layout: s.layout, title: s.title, subtitle: s.subtitle || void 0, bodyJson: s.bodyJson, notesText: s.notesText || void 0 }))
          );
          await storage.updateRunLog(runLog.id, result, "success");
        }
        const updated = await storage.updateProjectStage(projectId, nextStage);
        res.json(updated);
      } catch (agentErr) {
        await storage.updateRunLog(runLog.id, null, "failed", agentErr.message);
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
        return res.status(400).json({ error: `Cannot approve stage "${project.stage}".` });
      }
      const updated = await storage.updateProjectStage(projectId, nextStage);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
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
      if (!targetStage) return res.status(400).json({ error: `Invalid step "${step}"` });
      const currentIdx = STAGE_ORDER.indexOf(project.stage);
      const stepDraftStages = {
        issues: "issues_draft",
        hypotheses: "hypotheses_draft",
        execution: "execution_done",
        summary: "summary_draft",
        presentation: "presentation_draft"
      };
      const draftIdx = STAGE_ORDER.indexOf(stepDraftStages[step]);
      if (currentIdx < draftIdx) return res.status(400).json({ error: `Cannot redo "${step}" \u2014 hasn't been run yet.` });
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
      res.json({ issueNodes: issues, hypotheses: hyps, analysisPlan: plans, modelRuns: runs, narratives: narrs, slides: slds });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id/logs", async (req, res) => {
    try {
      const logs = await storage.getRunLogs(Number(req.params.id));
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/workflows", async (_req, res) => {
    try {
      const templates = await storage.listWorkflowTemplates();
      const result = [];
      for (const t of templates) {
        const steps = await storage.getWorkflowTemplateSteps(t.id);
        result.push({ ...t, steps });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/workflows/:id", async (req, res) => {
    try {
      const template = await storage.getWorkflowTemplate(Number(req.params.id));
      if (!template) return res.status(404).json({ error: "Not found" });
      const steps = await storage.getWorkflowTemplateSteps(template.id);
      res.json({ ...template, steps });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/workflows", async (req, res) => {
    try {
      const { name, description, steps } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const template = await storage.createWorkflowTemplate({ name, description });
      if (steps && Array.isArray(steps)) {
        for (const s of steps) {
          await storage.addWorkflowTemplateStep({
            workflowTemplateId: template.id,
            stepOrder: s.stepOrder,
            name: s.name,
            agentKey: s.agentKey,
            description: s.description
          });
        }
      }
      const allSteps = await storage.getWorkflowTemplateSteps(template.id);
      res.status(201).json({ ...template, steps: allSteps });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.put("/api/workflows/:id", async (req, res) => {
    try {
      const { name, description } = req.body;
      const template = await storage.updateWorkflowTemplate(Number(req.params.id), { name, description });
      const steps = await storage.getWorkflowTemplateSteps(template.id);
      res.json({ ...template, steps });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/agents", async (_req, res) => {
    try {
      const agentList = await storage.listAgents();
      res.json(agentList);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/agents/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        const agent2 = await storage.getAgentByKey(req.params.id);
        if (!agent2) return res.status(404).json({ error: "Not found" });
        return res.json(agent2);
      }
      const agent = await storage.getAgent(id);
      if (!agent) return res.status(404).json({ error: "Not found" });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.put("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.upsertAgent({ key: req.params.id, ...req.body });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/data/datasets", async (_req, res) => {
    try {
      const ds = await storage.listDatasets();
      res.json(ds);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/data/datasets", async (req, res) => {
    try {
      const { name, description, owner, accessLevel, schemaJson, metadata } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const ds = await storage.createDataset({ name, description, owner, accessLevel, schemaJson, metadata });
      res.status(201).json(ds);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/data/datasets/:id", async (req, res) => {
    try {
      const ds = await storage.getDataset(Number(req.params.id));
      if (!ds) return res.status(404).json({ error: "Not found" });
      res.json(ds);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/data/models", async (_req, res) => {
    try {
      const ms = await storage.listModels();
      res.json(ms);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/data/models", async (req, res) => {
    try {
      const { name, description, inputSchema, outputSchema, apiConfig } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const m = await storage.createModel({ name, description, inputSchema, outputSchema, apiConfig });
      res.status(201).json(m);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/data/models/:id", async (req, res) => {
    try {
      const m = await storage.getModel(Number(req.params.id));
      if (!m) return res.status(404).json({ error: "Not found" });
      res.json(m);
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
      const { systemPrompt, model, maxTokens } = req.body;
      if (!systemPrompt) return res.status(400).json({ error: "systemPrompt is required" });
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
  app2.get("/api/agents/detail/:key", async (req, res) => {
    try {
      const agent = await storage.getAgentByKey(req.params.key);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const saved = await storage.getAgentConfig(req.params.key);
      res.json({
        ...agent,
        systemPrompt: saved?.systemPrompt || agent.promptTemplate || DEFAULT_PROMPTS[req.params.key] || "",
        configModel: saved?.model || agent.model,
        configMaxTokens: saved?.maxTokens || agent.maxTokens
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/pipelines", async (_req, res) => {
    try {
      res.json(await storage.listPipelines());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/pipelines", async (req, res) => {
    try {
      const { name, agentsJson } = req.body;
      if (!name || !agentsJson) return res.status(400).json({ error: "name and agentsJson are required" });
      res.status(201).json(await storage.createPipeline({ name, agentsJson }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/pipelines/:id", async (req, res) => {
    try {
      const p = await storage.getPipeline(Number(req.params.id));
      if (!p) return res.status(404).json({ error: "Not found" });
      res.json(p);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.put("/api/pipelines/:id", async (req, res) => {
    try {
      res.json(await storage.updatePipeline(Number(req.params.id), req.body));
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
  registerChatRoutes(app2);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
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
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
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
    app2.use(express.static(distPath));
    app2.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      if (req.method !== "GET") return next();
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
  if (isDev) {
    const http = await import("http");
    const proxyPort = 8081;
    const proxy = http.createServer(app);
    proxy.listen(proxyPort, "0.0.0.0", () => {
      log(`preview proxy also listening on port ${proxyPort}`);
    });
  }
})();
