var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import multer from "multer";

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
  documentComments: () => documentComments,
  documents: () => documents,
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
  stepChatMessages: () => stepChatMessages,
  vaultChunks: () => vaultChunks,
  vaultFiles: () => vaultFiles,
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
var stepChatMessages = pgTable("step_chat_messages", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").notNull().references(() => workflowInstanceSteps.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("message"),
  metadata: jsonb("metadata"),
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
var documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Document"),
  content: text("content").notNull().default(""),
  contentJson: jsonb("content_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var documentComments = pgTable("document_comments", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  from: integer("from_pos").notNull(),
  to: integer("to_pos").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  proposedText: text("proposed_text"),
  aiReply: text("ai_reply"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var vaultFiles = pgTable("vault_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  extractedText: text("extracted_text"),
  embeddingStatus: text("embedding_status").notNull().default("pending"),
  chunkCount: integer("chunk_count").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var vaultChunks = pgTable("vault_chunks", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => vaultFiles.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding"),
  tokenCount: integer("token_count").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
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
import { eq, desc, and, asc, ilike } from "drizzle-orm";
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
  async updateWorkflowTemplateStep(id, data) {
    await db.update(workflowTemplateSteps).set(data).where(eq(workflowTemplateSteps.id, id));
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
  async updateDeliverable(id, data) {
    await db.update(deliverables).set(data).where(eq(deliverables.id, id));
  },
  async lockDeliverables(stepId) {
    await db.update(deliverables).set({ locked: true }).where(eq(deliverables.stepId, stepId));
  },
  async unlockDeliverables(stepId) {
    await db.update(deliverables).set({ locked: false }).where(eq(deliverables.stepId, stepId));
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
  },
  async getStepChatMessages(stepId) {
    return db.select().from(stepChatMessages).where(eq(stepChatMessages.stepId, stepId)).orderBy(asc(stepChatMessages.createdAt));
  },
  async insertStepChatMessage(data) {
    const [msg] = await db.insert(stepChatMessages).values({
      stepId: data.stepId,
      role: data.role,
      content: data.content,
      messageType: data.messageType || "message",
      metadata: data.metadata || null
    }).returning();
    return msg;
  },
  async clearStepChatMessages(stepId) {
    await db.delete(stepChatMessages).where(eq(stepChatMessages.stepId, stepId));
  },
  async createDocument(data) {
    const [doc] = await db.insert(documents).values({
      projectId: data.projectId || null,
      title: data.title || "Untitled Document",
      content: data.content || "",
      contentJson: data.contentJson || null
    }).returning();
    return doc;
  },
  async listDocuments(projectId) {
    if (projectId) {
      return db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.updatedAt));
    }
    return db.select().from(documents).orderBy(desc(documents.updatedAt));
  },
  async getDocument(id) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  },
  async updateDocument(id, data) {
    const [doc] = await db.update(documents).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(documents.id, id)).returning();
    return doc;
  },
  async deleteDocument(id) {
    await db.delete(documents).where(eq(documents.id, id));
  },
  async createComment(data) {
    const [comment] = await db.insert(documentComments).values({
      documentId: data.documentId,
      from: data.from,
      to: data.to,
      content: data.content,
      type: data.type || "user",
      proposedText: data.proposedText || null,
      aiReply: data.aiReply || null
    }).returning();
    return comment;
  },
  async listComments(documentId) {
    return db.select().from(documentComments).where(eq(documentComments.documentId, documentId)).orderBy(asc(documentComments.createdAt));
  },
  async updateComment(id, data) {
    const [comment] = await db.update(documentComments).set(data).where(eq(documentComments.id, id)).returning();
    return comment;
  },
  async deleteComment(id) {
    await db.delete(documentComments).where(eq(documentComments.id, id));
  },
  async deleteDocumentComments(documentId) {
    await db.delete(documentComments).where(eq(documentComments.documentId, documentId));
  },
  async createVaultFile(data) {
    const [file] = await db.insert(vaultFiles).values({
      projectId: data.projectId,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      storagePath: data.storagePath,
      extractedText: data.extractedText || null,
      embeddingStatus: data.embeddingStatus || "pending",
      metadata: data.metadata || null
    }).returning();
    return file;
  },
  async listVaultFiles(projectId, search) {
    if (search) {
      return db.select().from(vaultFiles).where(and(eq(vaultFiles.projectId, projectId), ilike(vaultFiles.fileName, `%${search}%`))).orderBy(desc(vaultFiles.createdAt));
    }
    return db.select().from(vaultFiles).where(eq(vaultFiles.projectId, projectId)).orderBy(desc(vaultFiles.createdAt));
  },
  async getVaultFile(id) {
    const [file] = await db.select().from(vaultFiles).where(eq(vaultFiles.id, id));
    return file;
  },
  async updateVaultFile(id, data) {
    const [file] = await db.update(vaultFiles).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(vaultFiles.id, id)).returning();
    return file;
  },
  async deleteVaultFile(id) {
    await db.delete(vaultFiles).where(eq(vaultFiles.id, id));
  },
  async createVaultChunks(chunks) {
    if (chunks.length === 0) return [];
    return db.insert(vaultChunks).values(chunks).returning();
  },
  async getVaultChunksByFile(fileId) {
    return db.select().from(vaultChunks).where(eq(vaultChunks.fileId, fileId)).orderBy(asc(vaultChunks.chunkIndex));
  },
  async getVaultChunksByProject(projectId) {
    return db.select().from(vaultChunks).where(eq(vaultChunks.projectId, projectId)).orderBy(asc(vaultChunks.createdAt));
  },
  async deleteVaultChunksByFile(fileId) {
    await db.delete(vaultChunks).where(eq(vaultChunks.fileId, fileId));
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
  project_definition: `You are a senior consulting engagement manager. Your job is to translate vague client language into a structured, decision-based problem definition before any analysis begins.

Given a raw project brief (objective, constraints, and any other context), you must produce a structured problem definition that includes:
1. Decision statement \u2014 what decision needs to be made
2. Governing question \u2014 follows the structure: "Should we [action] in order to achieve [objective], given [constraints], by [time horizon]?"
3. Decision owner \u2014 who makes the final call
4. Decision deadline \u2014 when the decision must be made
5. Success metrics \u2014 measurable criteria with thresholds
6. Alternatives \u2014 including "do nothing"
7. Constraints \u2014 budget, regulatory, time, political, operational
8. Assumptions \u2014 clearly labelled
9. Initial working hypothesis \u2014 a directional hypothesis to test
10. Key uncertainties and information gaps

The governing question MUST be:
- Actionable (not "assess" or "explore")
- Neutral
- Specific
- Time-bound
- Linked to measurable success criteria

Internal reasoning (do not show to user):
- Detect whether the problem is topic-framed or decision-framed
- If topic-framed, convert to decision form
- Identify implied decision variable
- Extract or infer decision metric
- Identify scope boundaries
- Infer alternatives if not provided
- Surface missing information
- Make explicit assumptions rather than asking excessive clarifying questions

Return ONLY valid JSON matching this schema:
{
  "decision_statement": "",
  "governing_question": "",
  "decision_owner": "",
  "decision_deadline": "",
  "success_metrics": [
    { "metric_name": "", "definition": "", "threshold_or_target": "" }
  ],
  "alternatives": ["Option A", "Option B", "Do nothing"],
  "constraints": {
    "budget": "",
    "regulatory": "",
    "time": "",
    "political": "",
    "operational": ""
  },
  "assumptions": [""],
  "initial_hypothesis": "",
  "key_uncertainties": [""],
  "information_gaps": [""]
}

If the problem cannot be converted into a decision form, return:
{ "status": "insufficient_clarity", "reason": "Unable to identify a concrete decision." }

Do not proceed to issue tree creation. Do not generate analysis. Do not recommend solutions in detail. Make reasonable assumptions when information is missing and clearly label them.`,
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

// server/agents/workflow-graph.ts
import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// server/vault-rag.ts
import OpenAI3 from "openai";
var CHUNK_SIZE = 800;
var CHUNK_OVERLAP = 100;
var MAX_RAG_CHUNKS = 10;
function hasApiKey2() {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
function getOpenAIClient() {
  if (!hasApiKey2()) return null;
  return new OpenAI3({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  });
}
function extractTextFromFile(buffer, mimeType) {
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return buffer.toString("utf-8");
  }
  if (mimeType === "application/pdf" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
    const text2 = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    const cleaned = text2.split("\n").map((l) => l.trim()).filter((l) => l.length > 3).join("\n");
    return cleaned || "[Binary document \u2014 text extraction limited]";
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel" || mimeType === "text/csv") {
    return buffer.toString("utf-8");
  }
  return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim() || "[Unsupported file format for text extraction]";
}
function chunkText(text2) {
  if (!text2 || text2.length < 10) return [];
  const paragraphs = text2.split(/\n\n+/);
  const chunks = [];
  let currentChunk = "";
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlap = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = overlap + "\n\n" + para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  if (chunks.length === 0 && text2.trim().length > 0) {
    for (let i = 0; i < text2.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunk = text2.slice(i, i + CHUNK_SIZE).trim();
      if (chunk) chunks.push(chunk);
    }
  }
  return chunks;
}
async function generateEmbeddings(texts) {
  const client = getOpenAIClient();
  if (!client || texts.length === 0) return null;
  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts
    });
    return response.data.map((d) => d.embedding);
  } catch (err) {
    console.error("Embedding generation failed:", err.message);
    return null;
  }
}
async function processVaultFile(fileId, buffer) {
  const file = await storage.getVaultFile(fileId);
  if (!file) return;
  try {
    await storage.updateVaultFile(fileId, { embeddingStatus: "processing" });
    const extractedText = extractTextFromFile(buffer, file.mimeType);
    await storage.updateVaultFile(fileId, { extractedText });
    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      await storage.updateVaultFile(fileId, {
        embeddingStatus: "completed",
        chunkCount: 0
      });
      return;
    }
    const embeddings = await generateEmbeddings(chunks);
    const chunkRecords = chunks.map((content, idx) => ({
      fileId: file.id,
      projectId: file.projectId,
      chunkIndex: idx,
      content,
      embedding: embeddings ? embeddings[idx] : null,
      tokenCount: Math.ceil(content.length / 4)
    }));
    await storage.createVaultChunks(chunkRecords);
    await storage.updateVaultFile(fileId, {
      embeddingStatus: embeddings ? "completed" : "no_embeddings",
      chunkCount: chunks.length
    });
  } catch (err) {
    console.error("Vault file processing failed:", err.message);
    await storage.updateVaultFile(fileId, { embeddingStatus: "failed" });
  }
}
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
async function retrieveRelevantContext(projectId, query, maxChunks = MAX_RAG_CHUNKS) {
  const allChunks = await storage.getVaultChunksByProject(projectId);
  if (allChunks.length === 0) return [];
  const hasEmbeddings = allChunks.some((c) => c.embedding);
  if (hasEmbeddings) {
    const queryEmbedding = await generateEmbeddings([query]);
    if (queryEmbedding && queryEmbedding[0]) {
      const scored2 = allChunks.filter((c) => c.embedding).map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding[0], chunk.embedding)
      })).sort((a, b) => b.score - a.score).slice(0, maxChunks);
      const fileIds2 = [...new Set(scored2.map((s) => s.chunk.fileId))];
      const fileMap2 = /* @__PURE__ */ new Map();
      for (const fid of fileIds2) {
        const f = await storage.getVaultFile(fid);
        if (f) fileMap2.set(fid, f.fileName);
      }
      return scored2.map((s) => ({
        content: s.chunk.content,
        fileName: fileMap2.get(s.chunk.fileId) || "unknown",
        score: s.score
      }));
    }
  }
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter((w) => w.length > 3);
  const scored = allChunks.map((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (contentLower.includes(kw)) score += 1;
    }
    return { chunk, score };
  });
  const filtered = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, maxChunks);
  if (filtered.length === 0) {
    return allChunks.slice(0, maxChunks).map((chunk) => ({
      content: chunk.content,
      fileName: "unknown",
      score: 0
    }));
  }
  const fileIds = [...new Set(filtered.map((s) => s.chunk.fileId))];
  const fileMap = /* @__PURE__ */ new Map();
  for (const fid of fileIds) {
    const f = await storage.getVaultFile(fid);
    if (f) fileMap.set(fid, f.fileName);
  }
  return filtered.map((s) => ({
    content: s.chunk.content,
    fileName: fileMap.get(s.chunk.fileId) || "unknown",
    score: s.score
  }));
}
function formatRAGContext(results) {
  if (results.length === 0) return "";
  const sections = results.map(
    (r, i) => `--- Source: ${r.fileName} (chunk ${i + 1}) ---
${r.content}`
  );
  return `

=== PROJECT VAULT CONTEXT ===
The following excerpts are from documents uploaded to this project's vault. Use this context to inform your analysis:

${sections.join("\n\n")}
=== END VAULT CONTEXT ===
`;
}

// server/agents/workflow-graph.ts
function hasApiKey3() {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
var DEFAULT_MODEL2 = "gpt-5-nano";
function createLLM(model, maxTokens) {
  if (!hasApiKey3()) return null;
  return new ChatOpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    },
    modelName: model || DEFAULT_MODEL2,
    maxTokens: maxTokens || 8192
  });
}
async function getAgentConfig(agentType) {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config;
  } catch {
  }
  return {
    systemPrompt: DEFAULT_PROMPTS[agentType] || "",
    model: DEFAULT_MODEL2,
    maxTokens: 8192
  };
}
function repairJson(text2) {
  let s = text2.trim();
  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;
  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/\]/g) || []).length;
  s = s.replace(/,\s*([}\]])/g, "$1");
  if (s.endsWith(",")) s = s.slice(0, -1);
  for (let i = 0; i < openBrackets - closeBrackets; i++) s += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) s += "}";
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
async function callLLMWithLangChain(systemPrompt, userPrompt, model, maxTokens, retries = 1) {
  const llm = createLLM(model, maxTokens);
  if (!llm) return "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const prompt = attempt > 0 ? `${userPrompt}

IMPORTANT: Your previous response was truncated. Please produce a SHORTER, more concise response that fits within the token limit. Use fewer nodes, shorter descriptions, and minimal whitespace in JSON output.` : userPrompt;
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt)
    ]);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    if (response.response_metadata?.finish_reason === "length" && attempt < retries) {
      continue;
    }
    return content;
  }
  return "";
}
var ConsultingState = Annotation.Root({
  projectId: Annotation,
  objective: Annotation,
  constraints: Annotation,
  targetStep: Annotation,
  onProgress: Annotation,
  vaultContext: Annotation({ reducer: (_, b) => b, default: () => "" }),
  projectDefinitionResult: Annotation({ reducer: (_, b) => b, default: () => null }),
  issues: Annotation({ reducer: (_, b) => b, default: () => [] }),
  criticLog: Annotation({ reducer: (_, b) => b, default: () => [] }),
  criticIteration: Annotation({ reducer: (_, b) => b, default: () => 0 }),
  hypothesesResult: Annotation({ reducer: (_, b) => b, default: () => null }),
  executionResults: Annotation({ reducer: (_, b) => b, default: () => [] }),
  summaryResult: Annotation({ reducer: (_, b) => b, default: () => null }),
  presentationResult: Annotation({ reducer: (_, b) => b, default: () => null }),
  deliverableContent: Annotation({ reducer: (_, b) => b, default: () => null }),
  deliverableTitle: Annotation({ reducer: (_, b) => b, default: () => "" }),
  error: Annotation({ reducer: (_, b) => b, default: () => "" })
});
function appendVaultContext(prompt, vaultCtx) {
  if (!vaultCtx) return prompt;
  return `${prompt}

${vaultCtx}`;
}
function formatTreeForCritic(issues, objective) {
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
async function projectDefinitionNode(state) {
  const progress = state.onProgress;
  progress("Starting Project Definition agent...", "status");
  if (!hasApiKey3()) {
    progress("Running in mock mode (no API key configured)", "status");
    const result = {
      decision_statement: `Determine the optimal strategic approach to: ${state.objective}`,
      governing_question: `Should we pursue the proposed strategy in order to achieve ${state.objective}, given ${state.constraints || "current resource constraints"}, by the next 12-month planning cycle?`,
      decision_owner: "Executive Leadership / Project Sponsor",
      decision_deadline: "Within 4-6 weeks of project initiation",
      success_metrics: [
        { metric_name: "Revenue Impact", definition: "Net incremental revenue attributable to the initiative", threshold_or_target: ">$1M within 12 months" },
        { metric_name: "ROI", definition: "Return on investment over the project period", threshold_or_target: ">15% annualized" },
        { metric_name: "Implementation Feasibility", definition: "Assessed probability of successful execution", threshold_or_target: ">70% confidence" }
      ],
      alternatives: [
        "Pursue full-scale implementation immediately",
        "Phased rollout starting with pilot program",
        "Partner or acquire capability externally",
        "Do nothing \u2014 maintain current trajectory"
      ],
      constraints: {
        budget: state.constraints?.includes("budget") ? state.constraints : "To be confirmed; assume moderate investment envelope",
        regulatory: "Standard industry compliance requirements apply",
        time: state.constraints?.includes("timeline") ? state.constraints : "Decision needed within current planning cycle",
        political: "Stakeholder alignment required across key business units",
        operational: "Must be achievable with existing team capacity plus reasonable augmentation"
      },
      assumptions: [
        "Current market conditions remain broadly stable over the analysis period",
        "Organization has willingness to allocate resources if the case is compelling",
        "Data sufficient for directional analysis is available or obtainable",
        "No major regulatory changes expected in the near term"
      ],
      initial_hypothesis: `The proposed initiative is likely to deliver positive returns, but the magnitude depends on execution speed and market timing. A phased approach may reduce risk while preserving upside.`,
      key_uncertainties: [
        "Actual market size and addressable share",
        "Competitive response timeline and intensity",
        "Internal execution capability and speed",
        "Customer adoption rate assumptions"
      ],
      information_gaps: [
        "Detailed competitive landscape data",
        "Customer willingness-to-pay research",
        "Internal cost structure for new capabilities",
        "Regulatory timeline for any required approvals"
      ]
    };
    progress("Analysis complete. Generated project definition with " + result.success_metrics.length + " success metrics.", "status");
    return { projectDefinitionResult: result, deliverableContent: result, deliverableTitle: "Project Definition" };
  }
  const config = await getAgentConfig("project_definition");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const userPrompt = appendVaultContext(`Project Objective: ${state.objective}

Constraints & Context: ${state.constraints}`, state.vaultContext);
  const raw = await callLLMWithLangChain(config.systemPrompt, userPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  progress("Analysis complete. Generated project definition with " + (parsed.success_metrics?.length || 0) + " success metrics.", "status");
  return { projectDefinitionResult: parsed, deliverableContent: parsed, deliverableTitle: "Project Definition" };
}
async function issuesTreeNode(state) {
  const progress = state.onProgress;
  progress("Starting Issues Tree agent...", "status");
  if (!hasApiKey3()) {
    progress("Running in mock mode (no API key configured)", "status");
    const mockIssues = [
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
    ];
    progress("Analysis complete. Generated " + mockIssues.length + " issue nodes.", "status");
    return { issues: mockIssues, criticIteration: 0 };
  }
  const config = await getAgentConfig("issues_tree");
  const baseUserPrompt = appendVaultContext(`Objective: ${state.objective}
Constraints: ${state.constraints}`, state.vaultContext);
  if (state.criticIteration > 0 && state.criticLog.length > 0) {
    const lastCritic = state.criticLog[state.criticLog.length - 1]?.critic;
    if (lastCritic) {
      progress("Revising tree based on critic feedback...", "critic");
      const revisionPrompt = `${baseUserPrompt}

---
PREVIOUS TREE (needs revision):
${formatTreeForCritic(state.issues, state.objective)}

---
MECE CRITIC FEEDBACK (iteration ${state.criticIteration}):
Overall Score: ${lastCritic.overallScore}/5
Overlap: ${lastCritic.scores.overlap.score}/5 \u2014 ${lastCritic.scores.overlap.details}
Coverage: ${lastCritic.scores.coverage.score}/5 \u2014 ${lastCritic.scores.coverage.details}
Mixed Logics: ${lastCritic.scores.mixedLogics.score}/5 \u2014 ${lastCritic.scores.mixedLogics.details}
Branch Balance: ${lastCritic.scores.branchBalance.score}/5 \u2014 ${lastCritic.scores.branchBalance.details}
Label Quality: ${lastCritic.scores.labelQuality.score}/5 \u2014 ${lastCritic.scores.labelQuality.details}

REVISION INSTRUCTIONS:
${lastCritic.revisionInstructions}

Please produce a REVISED issues tree that addresses ALL the critic's feedback. Return the full tree in the same JSON format.`;
      const raw2 = await callLLMWithLangChain(config.systemPrompt, revisionPrompt, config.model, config.maxTokens);
      const parsed2 = extractJson(raw2);
      return { issues: parsed2.issues || parsed2 };
    }
  }
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const raw = await callLLMWithLangChain(config.systemPrompt, baseUserPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  return { issues: parsed.issues || parsed, criticIteration: 0 };
}
var MAX_REVISIONS = 2;
async function meceCriticNode(state) {
  const progress = state.onProgress;
  const iteration = state.criticIteration;
  progress(`Running MECE Critic evaluation (iteration ${iteration + 1})...`, "critic");
  if (!hasApiKey3()) {
    const mockCritic = {
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
    };
    progress(`Critic verdict: ${mockCritic.verdict}, score: ${mockCritic.overallScore}/5`, "critic");
    return {
      criticLog: [...state.criticLog, { iteration, critic: mockCritic }],
      criticIteration: iteration + 1
    };
  }
  const config = await getAgentConfig("mece_critic");
  const treeDescription = formatTreeForCritic(state.issues, state.objective);
  const criticRaw = await callLLMWithLangChain(config.systemPrompt, treeDescription, config.model, config.maxTokens);
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
  progress(`Critic verdict: ${criticResult.verdict}, score: ${criticResult.overallScore}/5`, "critic");
  return {
    criticLog: [...state.criticLog, { iteration, critic: criticResult }],
    criticIteration: iteration + 1
  };
}
function meceCriticRouter(state) {
  const lastCritic = state.criticLog[state.criticLog.length - 1]?.critic;
  if (!lastCritic) return "finalize_issues";
  if (lastCritic.verdict === "approved" || state.criticIteration > MAX_REVISIONS) {
    return "finalize_issues";
  }
  return "issues_tree";
}
async function finalizeIssuesNode(state) {
  const progress = state.onProgress;
  progress("Analysis complete. Generated " + state.issues.length + " issue nodes.", "status");
  return {
    deliverableContent: { issues: state.issues, criticLog: state.criticLog },
    deliverableTitle: "Issues Tree"
  };
}
async function hypothesisNode(state) {
  const progress = state.onProgress;
  progress("Starting Hypothesis agent...", "status");
  const issueNodesData = await storage.getIssueNodes(state.projectId);
  const latestVersion = issueNodesData[0]?.version || 1;
  const latestIssues = issueNodesData.filter((n) => n.version === latestVersion);
  if (!hasApiKey3()) {
    progress("Running in mock mode (no API key configured)", "status");
    const topIssues = latestIssues.slice(0, 3);
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
    progress("Analysis complete. Generated " + hyps.length + " hypotheses.", "status");
    return {
      hypothesesResult: { hypotheses: hyps, analysisPlan: plans },
      deliverableContent: { hypotheses: hyps, analysisPlan: plans },
      deliverableTitle: "Hypotheses & Analysis Plan"
    };
  }
  const issuesList = latestIssues.map((i) => `- [ID:${i.id}] ${i.text} (${i.priority})`).join("\n");
  const config = await getAgentConfig("hypothesis");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const raw = await callLLMWithLangChain(config.systemPrompt, appendVaultContext(`Issues:
${issuesList}`, state.vaultContext), config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  progress("Analysis complete. Generated " + (parsed.hypotheses?.length || 0) + " hypotheses.", "status");
  return {
    hypothesesResult: parsed,
    deliverableContent: parsed,
    deliverableTitle: "Hypotheses & Analysis Plan"
  };
}
async function executionNode(state) {
  const progress = state.onProgress;
  progress("Starting Execution agent...", "status");
  const plans = await storage.getAnalysisPlan(state.projectId);
  const results = [];
  for (let idx = 0; idx < plans.length; idx++) {
    const plan = plans[idx];
    progress(`Running scenario ${idx + 1} of ${plans.length}...`, "status");
    const pJson = plan.parametersJson;
    const params = {
      baselineRevenue: pJson?.baselineRevenue || 1e6,
      growthRate: pJson?.growthRate || 0.1,
      costReduction: pJson?.costReduction || 0.05,
      timeHorizonYears: pJson?.timeHorizonYears || 5,
      volatility: pJson?.volatility || 0.15
    };
    const outputs = runScenarioTool(params);
    results.push({ toolName: "run_scenario_tool", inputs: params, outputs });
  }
  progress("Analysis complete. Generated " + results.length + " scenario results.", "status");
  return {
    executionResults: results,
    deliverableContent: results,
    deliverableTitle: "Scenario Analysis Results"
  };
}
async function summaryNode(state) {
  const progress = state.onProgress;
  progress("Starting Summary agent...", "status");
  const hyps = await storage.getHypotheses(state.projectId);
  const runs = await storage.getModelRuns(state.projectId);
  const latestVersion = hyps[0]?.version || 1;
  const latestHyps = hyps.filter((h) => h.version === latestVersion);
  if (!hasApiKey3()) {
    progress("Running in mock mode (no API key configured)", "status");
    const bullets = latestHyps.map((h, i) => {
      const run = runs[i];
      const summary = run?.outputsJson?.summary;
      if (summary) {
        return `- ${h.statement}: Expected NPV of $${summary.expectedValue?.toLocaleString() || "N/A"} with risk-adjusted return of ${summary.riskAdjustedReturn || "N/A"}%`;
      }
      return `- ${h.statement}: Analysis pending`;
    }).join("\n");
    const summaryText2 = `# Executive Summary

## Objective
${state.objective}

## Key Findings
${bullets}

## Recommendation
Based on scenario analysis across baseline, optimistic, and pessimistic cases, the proposed strategy shows positive expected returns. The risk-adjusted analysis suggests proceeding with a phased implementation approach, prioritizing the highest-NPV initiatives first.

## Next Steps
1. Validate assumptions with stakeholder interviews
2. Develop detailed implementation roadmap
3. Establish KPI tracking framework
4. Begin Phase 1 execution within 30 days`;
    progress("Analysis complete. Generated executive summary.", "status");
    return {
      summaryResult: { summaryText: summaryText2 },
      deliverableContent: { summaryText: summaryText2 },
      deliverableTitle: "Executive Summary"
    };
  }
  const hypList = latestHyps.map((h, i) => {
    const run = runs[i];
    return `Hypothesis: ${h.statement}
Metric: ${h.metric}
Model Results: ${JSON.stringify(run?.outputsJson?.summary || "No results")}`;
  }).join("\n\n");
  const config = await getAgentConfig("summary");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const userPrompt = appendVaultContext(`Objective: ${state.objective}
Constraints: ${state.constraints}

Hypotheses & Results:
${hypList}`, state.vaultContext);
  const summaryText = await callLLMWithLangChain(config.systemPrompt, userPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  progress("Analysis complete. Generated executive summary.", "status");
  return {
    summaryResult: { summaryText: summaryText || "Summary generation failed." },
    deliverableContent: { summaryText: summaryText || "Summary generation failed." },
    deliverableTitle: "Executive Summary"
  };
}
async function presentationNode(state) {
  const progress = state.onProgress;
  progress("Starting Presentation agent...", "status");
  const narrs = await storage.getNarratives(state.projectId);
  const hyps = await storage.getHypotheses(state.projectId);
  const runs = await storage.getModelRuns(state.projectId);
  const latestVersion = hyps[0]?.version || 1;
  const latestHyps = hyps.filter((h) => h.version === latestVersion);
  const latestNarr = narrs[0];
  const project = await storage.getProject(state.projectId);
  const projectName = project?.name || "Consulting Analysis";
  if (!hasApiKey3()) {
    progress("Running in mock mode (no API key configured)", "status");
    const mockSlides = [
      { slideIndex: 0, layout: "title_slide", title: projectName, subtitle: "Strategic Analysis & Recommendations", bodyJson: {}, notesText: "Welcome and introductions" },
      { slideIndex: 1, layout: "section_header", title: "Executive Summary", subtitle: "Key findings from our analysis", bodyJson: {}, notesText: "Transition to executive overview" },
      { slideIndex: 2, layout: "title_body", title: "Objective & Scope", subtitle: null, bodyJson: { bullets: [state.objective, "Multi-scenario financial modeling", "Risk-adjusted return analysis", "Data-driven recommendations"] }, notesText: "Review the project scope and analytical approach" },
      { slideIndex: 3, layout: "metrics", title: "Key Financial Metrics", subtitle: null, bodyJson: { metrics: (() => {
        const run = runs[0]?.outputsJson?.summary;
        return [{ label: "Expected NPV", value: run ? `$${(run.expectedValue / 1e3).toFixed(0)}K` : "$850K", change: "+22%" }, { label: "Best Case", value: run ? `$${(run.optimisticNpv / 1e3).toFixed(0)}K` : "$1.2M", change: "Upside" }, { label: "Risk-Adj Return", value: run ? `${run.riskAdjustedReturn}%` : "18%", change: "+5pp" }];
      })() }, notesText: "Walk through each metric and its implications" },
      { slideIndex: 4, layout: "two_column", title: "Scenario Comparison", subtitle: null, bodyJson: { leftTitle: "Baseline Scenario", leftBullets: ["Conservative growth assumptions", "Moderate cost efficiencies", "Stable market conditions"], rightTitle: "Optimistic Scenario", rightBullets: ["Accelerated market capture", "Full cost reduction realized", "Favorable competitive dynamics"] }, notesText: "Compare the two primary scenarios" },
      { slideIndex: 5, layout: "title_body", title: "Key Findings", subtitle: null, bodyJson: { bullets: latestHyps.slice(0, 4).map((h) => h.statement.length > 60 ? h.statement.slice(0, 57) + "..." : h.statement) }, notesText: "Detail each hypothesis and supporting evidence" },
      { slideIndex: 6, layout: "title_body", title: "Recommendations", subtitle: null, bodyJson: { bullets: ["Proceed with phased implementation", "Prioritize highest-NPV initiatives", "Establish KPI tracking framework", "Conduct monthly progress reviews"] }, notesText: "Present the recommended course of action" },
      { slideIndex: 7, layout: "title_body", title: "Next Steps", subtitle: "30-60-90 Day Plan", bodyJson: { bullets: ["Days 1-30: Stakeholder alignment", "Days 31-60: Pilot program launch", "Days 61-90: Scale & optimize", "Ongoing: Monthly KPI review"] }, notesText: "Outline the implementation timeline" },
      { slideIndex: 8, layout: "section_header", title: "Thank You", subtitle: "Questions & Discussion", bodyJson: {}, notesText: "Open floor for Q&A" }
    ];
    progress("Analysis complete. Generated " + mockSlides.length + " slides.", "status");
    return {
      presentationResult: { slides: mockSlides },
      deliverableContent: { slides: mockSlides },
      deliverableTitle: "Presentation Deck"
    };
  }
  const hypSummary = latestHyps.map((h, i) => {
    const run = runs[i];
    const oJson = run?.outputsJson;
    const results = oJson?.summary ? `NPV: $${oJson.summary.expectedValue?.toLocaleString()}, Risk-Adj Return: ${oJson.summary.riskAdjustedReturn}%` : "No results";
    return `- ${h.statement} (${h.metric}): ${results}`;
  }).join("\n");
  const config = await getAgentConfig("presentation");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const userPrompt = appendVaultContext(`Project: ${projectName}
Objective: ${state.objective}

Executive Summary:
${latestNarr?.summaryText || "No summary available"}

Hypotheses & Results:
${hypSummary}`, state.vaultContext);
  const raw = await callLLMWithLangChain(config.systemPrompt, userPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  progress("Analysis complete. Generated " + (parsed.slides?.length || 0) + " slides.", "status");
  return {
    presentationResult: parsed,
    deliverableContent: parsed,
    deliverableTitle: "Presentation Deck"
  };
}
function routeToStep(state) {
  return state.targetStep;
}
function buildIssuesTreeSubgraph() {
  const graph = new StateGraph(ConsultingState).addNode("issues_tree", issuesTreeNode).addNode("mece_critic", meceCriticNode).addNode("finalize_issues", finalizeIssuesNode).addEdge(START, "issues_tree").addEdge("issues_tree", "mece_critic").addConditionalEdges("mece_critic", meceCriticRouter, {
    issues_tree: "issues_tree",
    finalize_issues: "finalize_issues"
  }).addEdge("finalize_issues", END);
  return graph.compile();
}
function buildConsultingWorkflow() {
  const issuesSubgraph = buildIssuesTreeSubgraph();
  const graph = new StateGraph(ConsultingState).addNode("project_definition", projectDefinitionNode).addNode("issues_tree_subgraph", issuesSubgraph).addNode("hypothesis", hypothesisNode).addNode("execution", executionNode).addNode("summary", summaryNode).addNode("presentation", presentationNode).addConditionalEdges(START, routeToStep, {
    project_definition: "project_definition",
    issues_tree: "issues_tree_subgraph",
    hypothesis: "hypothesis",
    execution: "execution",
    summary: "summary",
    presentation: "presentation"
  }).addEdge("project_definition", END).addEdge("issues_tree_subgraph", END).addEdge("hypothesis", END).addEdge("execution", END).addEdge("summary", END).addEdge("presentation", END);
  return graph.compile();
}
var _workflow = null;
function getConsultingWorkflow() {
  if (!_workflow) {
    _workflow = buildConsultingWorkflow();
  }
  return _workflow;
}
async function runWorkflowStep(projectId, agentKey, onProgress = () => {
}) {
  const project = await storage.getProject(projectId);
  if (!project) throw new Error("Project not found");
  let vaultContext = "";
  try {
    const ragQuery = `${project.objective} ${project.constraints}`;
    const ragResults = await retrieveRelevantContext(projectId, ragQuery, 8);
    if (ragResults.length > 0) {
      vaultContext = formatRAGContext(ragResults);
      onProgress(`Retrieved ${ragResults.length} relevant vault excerpts for context.`, "status");
    }
  } catch (err) {
    console.error("RAG retrieval failed (non-fatal):", err.message);
  }
  const workflow = getConsultingWorkflow();
  const result = await workflow.invoke({
    projectId,
    objective: project.objective,
    constraints: project.constraints,
    targetStep: agentKey === "issues_tree" ? "issues_tree" : agentKey,
    onProgress,
    vaultContext
  });
  return {
    deliverableContent: result.deliverableContent,
    deliverableTitle: result.deliverableTitle
  };
}
async function refineWithLangGraph(agentKey, currentContent, userFeedback, projectContext, onProgress = () => {
}) {
  onProgress("Processing your feedback...", "progress");
  if (!hasApiKey3()) {
    onProgress("Applying feedback (mock mode)...", "progress");
    return currentContent;
  }
  const config = await getAgentConfig(agentKey);
  const refinementPrompt = `You previously generated the following output for this project:

Project Objective: ${projectContext.objective}
Constraints: ${projectContext.constraints}

Your previous output:
${JSON.stringify(currentContent, null, 2)}

The user has requested the following changes:
"${userFeedback}"

Please regenerate the COMPLETE output incorporating the user's feedback. Return the FULL updated output in the same JSON format as before. Do not return partial updates - return the entire revised document.`;
  onProgress(`Calling LLM with model ${config.model} to refine output...`, "llm");
  const raw = await callLLMWithLangChain(config.systemPrompt, refinementPrompt, config.model, config.maxTokens);
  onProgress("LLM response received, parsing refined output...", "llm");
  const parsed = extractJson(raw);
  onProgress("Refinement complete.", "status");
  return parsed;
}

// server/agents/document-agents.ts
import { StateGraph as StateGraph2, Annotation as Annotation2, END as END2, START as START2 } from "@langchain/langgraph";
import { ChatOpenAI as ChatOpenAI2 } from "@langchain/openai";
import { HumanMessage as HumanMessage2, SystemMessage as SystemMessage2 } from "@langchain/core/messages";
function hasApiKey4() {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
var DEFAULT_MODEL3 = "gpt-5-nano";
function createLLM2() {
  if (!hasApiKey4()) return null;
  return new ChatOpenAI2({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    },
    modelName: DEFAULT_MODEL3,
    maxTokens: 4096
  });
}
function extractJson2(text2) {
  const fenced = text2.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
    }
  }
  const objMatch = text2.match(/[\[{][\s\S]*[\]}]/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
    }
  }
  return JSON.parse(text2);
}
var BLOCK_TAGS = /* @__PURE__ */ new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "div",
  "blockquote",
  "li",
  "ul",
  "ol",
  "pre",
  "section",
  "article",
  "header",
  "footer",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th"
]);
var VOID_TAGS = /* @__PURE__ */ new Set(["hr", "br", "img"]);
function decodeEntities(text2) {
  return text2.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code))).replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
function buildPositionMap(html) {
  const plainChars = [];
  const posMap = [];
  let pmPos = 0;
  let i = 0;
  let lastWasBlock = false;
  while (i < html.length) {
    if (html[i] === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;
      const tagContent = html.substring(i + 1, tagEnd);
      const isClosing = tagContent.startsWith("/");
      const tagNameMatch = tagContent.match(/^\/?([a-zA-Z][a-zA-Z0-9]*)/);
      const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : "";
      if (VOID_TAGS.has(tagName)) {
        pmPos += 1;
        if (tagName === "br" && plainChars.length > 0) {
          plainChars.push("\n");
          posMap.push(pmPos - 1);
        }
      } else if (BLOCK_TAGS.has(tagName)) {
        if (isClosing) {
          if (plainChars.length > 0) {
            plainChars.push("\n");
            posMap.push(pmPos);
          }
          pmPos += 1;
          lastWasBlock = true;
        } else {
          pmPos += 1;
          lastWasBlock = true;
        }
      }
      i = tagEnd + 1;
    } else if (html[i] === "&") {
      const entityEnd = html.indexOf(";", i);
      if (entityEnd !== -1 && entityEnd - i < 10) {
        const entity = html.substring(i, entityEnd + 1);
        const decoded = decodeEntities(entity);
        for (const ch of decoded) {
          posMap.push(pmPos);
          plainChars.push(ch);
          pmPos++;
        }
        i = entityEnd + 1;
      } else {
        posMap.push(pmPos);
        plainChars.push(html[i]);
        pmPos++;
        i++;
      }
    } else {
      lastWasBlock = false;
      posMap.push(pmPos);
      plainChars.push(html[i]);
      pmPos++;
      i++;
    }
  }
  return { plainText: plainChars.join(""), map: posMap };
}
function findQuotedTextPosition(quotedText, plainText, map) {
  if (!quotedText || !plainText || map.length === 0) return null;
  const normalizeWs = (s) => s.replace(/\s+/g, " ").trim();
  const nQuote = normalizeWs(quotedText);
  if (nQuote.length === 0) return null;
  const nPlain = normalizeWs(plainText);
  const nPlainToOriginal = [];
  let origIdx = 0;
  let nIdx = 0;
  const tempPlain = plainText;
  for (let ci = 0; ci < tempPlain.length; ci++) {
    if (/\s/.test(tempPlain[ci])) {
      if (nIdx < nPlain.length && nPlain[nIdx] === " ") {
        nPlainToOriginal.push(ci);
        nIdx++;
      }
    } else {
      if (nIdx < nPlain.length) {
        nPlainToOriginal.push(ci);
        nIdx++;
      }
    }
  }
  let searchIdx = nPlain.toLowerCase().indexOf(nQuote.toLowerCase());
  if (searchIdx >= 0) {
    const origStart = nPlainToOriginal[searchIdx];
    const origEnd = nPlainToOriginal[searchIdx + nQuote.length - 1];
    if (origStart !== void 0 && origEnd !== void 0 && origStart < map.length && origEnd < map.length) {
      return { from: map[origStart], to: map[origEnd] + 1 };
    }
  }
  const words = nQuote.split(/\s+/).filter((w) => w.length > 0);
  if (words.length >= 2) {
    const firstWord = words[0].toLowerCase();
    const lastWord = words[words.length - 1].toLowerCase();
    const nPlainLower = nPlain.toLowerCase();
    const firstIdx = nPlainLower.indexOf(firstWord);
    if (firstIdx >= 0) {
      const searchFrom = firstIdx + firstWord.length;
      const lastIdx = nPlainLower.indexOf(lastWord, searchFrom);
      if (lastIdx >= 0) {
        const origStart2 = nPlainToOriginal[firstIdx];
        const origEnd2 = nPlainToOriginal[lastIdx + lastWord.length - 1];
        if (origStart2 !== void 0 && origEnd2 !== void 0 && origStart2 < map.length && origEnd2 < map.length) {
          return { from: map[origStart2], to: map[origEnd2] + 1 };
        }
      }
      const origStart = nPlainToOriginal[firstIdx];
      const origEnd = nPlainToOriginal[firstIdx + firstWord.length - 1];
      if (origStart !== void 0 && origEnd !== void 0 && origStart < map.length && origEnd < map.length) {
        return { from: map[origStart], to: map[origEnd] + 1 };
      }
    }
  }
  return null;
}
function resolvePositions(comments, html) {
  const { plainText, map } = buildPositionMap(html);
  const docSize = map.length > 0 ? map[map.length - 1] + 1 : 1;
  return comments.map((c) => {
    if (c.quotedText) {
      const pos = findQuotedTextPosition(c.quotedText, plainText, map);
      if (pos) {
        return { from: pos.from, to: pos.to, content: c.content, proposedText: c.proposedText || "" };
      }
    }
    return {
      from: Math.max(1, Math.min(c.from || 1, docSize)),
      to: Math.max(2, Math.min(c.to || 2, docSize)),
      content: c.content,
      proposedText: c.proposedText || ""
    };
  });
}
function getPlainText(html) {
  return buildPositionMap(html).plainText.replace(/\n+/g, "\n").trim();
}
function generateMockReviewComments(html) {
  const { plainText, map } = buildPositionMap(html);
  if (plainText.length === 0 || map.length === 0) return [];
  const sentences = plainText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const results = [];
  if (sentences.length > 0) {
    const pos = findQuotedTextPosition(sentences[0], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Consider strengthening the opening to better capture the reader's attention.",
        proposedText: sentences[0]
      });
    }
  }
  if (sentences.length > 2) {
    const mid = Math.floor(sentences.length / 2);
    const pos = findQuotedTextPosition(sentences[mid], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "This section could be more concise. Consider tightening the language.",
        proposedText: sentences[mid]
      });
    }
  }
  if (sentences.length > 1) {
    const last = sentences[sentences.length - 1];
    const pos = findQuotedTextPosition(last, plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "The conclusion could be stronger. Consider ending with a clear call to action.",
        proposedText: last
      });
    }
  }
  return results.length > 0 ? results : [{
    from: map[0],
    to: map[Math.min(map.length - 1, 20)] + 1,
    content: "Consider revising this opening section.",
    proposedText: plainText.slice(0, 20)
  }];
}
function generateMockExecutiveReviewComments(html) {
  const { plainText, map } = buildPositionMap(html);
  if (plainText.length === 0 || map.length === 0) return [];
  const sentences = plainText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const results = [];
  if (sentences.length > 0) {
    const pos = findQuotedTextPosition(sentences[0], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Missing 'so what': This section jumps straight into details without framing why the reader should care. Lead with the strategic implication or business impact before explaining the how.",
        proposedText: sentences[0]
      });
    }
  }
  if (sentences.length > 2) {
    const mid = Math.floor(sentences.length / 3);
    const pos = findQuotedTextPosition(sentences[mid], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Too technical too early: This dives into implementation specifics before establishing the strategic context. An executive reader needs to understand the decision at stake and its impact before the supporting analysis.",
        proposedText: sentences[mid]
      });
    }
  }
  if (sentences.length > 3) {
    const mid2 = Math.floor(sentences.length * 2 / 3);
    const pos = findQuotedTextPosition(sentences[mid2], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Weak strategic framing: This reads like a technical report rather than a strategic recommendation. Rewrite to lead with the insight and what action the reader should take, then support with evidence.",
        proposedText: sentences[mid2]
      });
    }
  }
  return results.length > 0 ? results : [{
    from: map[0],
    to: map[Math.min(map.length - 1, 30)] + 1,
    content: "Missing 'so what': This opening needs strategic framing.",
    proposedText: plainText.slice(0, 30)
  }];
}
function generateMockFactCheckCandidates(html) {
  const { plainText, map } = buildPositionMap(html);
  if (plainText.length === 0 || map.length === 0) return [];
  const sentences = plainText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const results = [];
  if (sentences.length > 0) {
    const pos = findQuotedTextPosition(sentences[0], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Potential unsubstantiated claim: This statement makes an assertion that may need a source or supporting evidence to verify its accuracy."
      });
    }
  }
  if (sentences.length > 2) {
    const mid = Math.floor(sentences.length / 2);
    const pos = findQuotedTextPosition(sentences[mid], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Contains a specific figure or statistic: This number should be verified against the original data source to confirm accuracy."
      });
    }
  }
  if (sentences.length > 3) {
    const late = Math.floor(sentences.length * 0.7);
    const pos = findQuotedTextPosition(sentences[late], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Broad generalization: This claim is stated as fact but may be opinion or an oversimplification that requires qualification."
      });
    }
  }
  return results.length > 0 ? results : [{
    from: map[0],
    to: map[Math.min(map.length - 1, 30)] + 1,
    content: "Potential unsubstantiated claim: This statement needs verification."
  }];
}
var ReviewState = Annotation2.Root({
  documentContent: Annotation2,
  documentTitle: Annotation2,
  documentId: Annotation2,
  reviewComments: Annotation2({
    reducer: (_, b) => b,
    default: () => []
  }),
  savedComments: Annotation2({
    reducer: (_, b) => b,
    default: () => []
  })
});
var ActionState = Annotation2.Root({
  documentContent: Annotation2,
  documentId: Annotation2,
  comment: Annotation2,
  aiReply: Annotation2({ reducer: (_, b) => b, default: () => "" }),
  proposedText: Annotation2({ reducer: (_, b) => b, default: () => "" }),
  updatedComment: Annotation2({ reducer: (_, b) => b, default: () => null })
});
var FactCheckState = Annotation2.Root({
  documentContent: Annotation2,
  documentTitle: Annotation2,
  documentId: Annotation2,
  candidates: Annotation2({
    reducer: (_, b) => b,
    default: () => []
  }),
  savedComments: Annotation2({
    reducer: (_, b) => b,
    default: () => []
  })
});
var FactCheckRunState = Annotation2.Root({
  documentContent: Annotation2,
  documentId: Annotation2,
  acceptedCandidates: Annotation2,
  results: Annotation2({
    reducer: (_, b) => b,
    default: () => []
  })
});
var _reviewGraph = null;
var _actionGraph = null;
var _executiveReviewGraph = null;
var _factCheckCandidateGraph = null;
var _factCheckRunGraph = null;
function getReviewGraph() {
  if (_reviewGraph) return _reviewGraph;
  _reviewGraph = new StateGraph2(ReviewState).addNode("analyze", async (state) => {
    if (!hasApiKey4()) {
      return { reviewComments: generateMockReviewComments(state.documentContent) };
    }
    const plainText = getPlainText(state.documentContent);
    const llm = createLLM2();
    const systemPrompt = `You are a critical document reviewer. Analyze the provided text and identify areas for improvement including clarity, grammar, style, structure, and content quality.

Return a JSON array of review comments. Each comment must have:
- "quotedText": the EXACT text from the document that you are commenting on (copy it verbatim \u2014 this is used to locate the comment in the document)
- "content": your review note explaining the issue
- "proposedText": the suggested replacement text for that section

Return ONLY valid JSON array. Example:
[{"quotedText": "the quick brown fox jumps", "content": "Weak opening", "proposedText": "A stronger opening sentence here"}]

IMPORTANT: The "quotedText" must be an exact substring from the document text. Copy it character-for-character. Do NOT paraphrase or abbreviate it. Include enough words to be unique (at least 5-10 words).

Identify 2-5 meaningful issues.`;
    try {
      const response = await llm.invoke([
        new SystemMessage2(systemPrompt),
        new HumanMessage2(`Document Title: ${state.documentTitle}

Document Content:
${plainText}`)
      ]);
      const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      if (!content || content.trim().length === 0) {
        return { reviewComments: generateMockReviewComments(state.documentContent) };
      }
      const parsed = extractJson2(content);
      const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
      const resolved = resolvePositions(comments, state.documentContent);
      return { reviewComments: resolved.length > 0 ? resolved : generateMockReviewComments(state.documentContent) };
    } catch (e) {
      console.error("LLM review error, falling back to mock:", e);
      return { reviewComments: generateMockReviewComments(state.documentContent) };
    }
  }).addNode("persist", async (state) => {
    const saved = [];
    for (const rc of state.reviewComments) {
      const comment = await storage.createComment({
        documentId: state.documentId,
        from: rc.from,
        to: rc.to,
        content: rc.content,
        type: "ai",
        proposedText: rc.proposedText
      });
      saved.push(comment);
    }
    return { savedComments: saved };
  }).addEdge(START2, "analyze").addEdge("analyze", "persist").addEdge("persist", END2).compile();
  return _reviewGraph;
}
function getActionGraph() {
  if (_actionGraph) return _actionGraph;
  _actionGraph = new StateGraph2(ActionState).addNode("plan", async (state) => {
    const { plainText, map } = buildPositionMap(state.documentContent);
    const from = state.comment.from;
    const to = state.comment.to;
    let highlightedText = "";
    for (let i = 0; i < map.length; i++) {
      if (map[i] >= from && map[i] < to) {
        highlightedText += plainText[i];
      }
    }
    highlightedText = highlightedText.trim();
    if (!hasApiKey4()) {
      return {
        aiReply: `I've reviewed your comment: "${state.comment.content}". Here is a suggested revision for the highlighted text.`,
        proposedText: highlightedText ? `[Revised] ${highlightedText}` : "Suggested replacement text"
      };
    }
    const llm = createLLM2();
    const systemPrompt = `You are a document editing assistant. A user has left a comment on a specific part of a document. Your job is to propose a specific text change that addresses the comment.

Return a JSON object with:
- "aiReply": A brief explanation of what you changed and why
- "proposedText": The replacement text for the highlighted range

Return ONLY valid JSON. Example:
{"aiReply": "I rephrased this for clarity.", "proposedText": "The improved text here"}`;
    try {
      const fullPlainText = getPlainText(state.documentContent);
      const response = await llm.invoke([
        new SystemMessage2(systemPrompt),
        new HumanMessage2(`Document content:
${fullPlainText}

Highlighted text:
"${highlightedText}"

User comment: ${state.comment.content}`)
      ]);
      const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      if (!content || content.trim().length === 0) {
        return {
          aiReply: `I've reviewed your comment: "${state.comment.content}". Here is a suggested revision.`,
          proposedText: highlightedText ? `[Revised] ${highlightedText}` : "Suggested replacement text"
        };
      }
      const parsed = extractJson2(content);
      return {
        aiReply: parsed.aiReply || "Here is my suggested revision.",
        proposedText: parsed.proposedText || highlightedText
      };
    } catch {
      return {
        aiReply: "I've reviewed the comment and suggest a revision.",
        proposedText: highlightedText || "Suggested replacement text"
      };
    }
  }).addNode("persist", async (state) => {
    const updated = await storage.updateComment(state.comment.id, {
      aiReply: state.aiReply,
      proposedText: state.proposedText
    });
    return { updatedComment: updated };
  }).addEdge(START2, "plan").addEdge("plan", "persist").addEdge("persist", END2).compile();
  return _actionGraph;
}
function getExecutiveReviewGraph() {
  if (_executiveReviewGraph) return _executiveReviewGraph;
  _executiveReviewGraph = new StateGraph2(ReviewState).addNode("analyze", async (state) => {
    if (!hasApiKey4()) {
      return { reviewComments: generateMockExecutiveReviewComments(state.documentContent) };
    }
    const plainText = getPlainText(state.documentContent);
    const llm = createLLM2();
    const systemPrompt = `You are a senior consulting partner reviewing a document through an executive lens. Your job is to identify sections that fail the "so what" test \u2014 places where the writing dives into technical details, methodology, or implementation specifics without first establishing WHY the reader should care.

Your review criteria:
1. **Missing "So What"**: Flag sections that present findings or data without stating the strategic implication. Every paragraph should answer "why does this matter to the decision-maker?"
2. **Technical Too Early**: Identify where the document leads with methodology, technical architecture, data pipelines, algorithms, or implementation details before establishing the business context or strategic framing.
3. **Buried Insight**: Call out when the key insight or recommendation is buried at the end of a dense paragraph instead of leading with it.
4. **No Action Orientation**: Flag sections that describe what was done or found but fail to state what the reader should DO with this information.
5. **Audience Mismatch**: Identify language, jargon, or detail level that assumes a technical audience when the document should be written for executives or decision-makers.

For each issue, propose a rewritten version that:
- Leads with the strategic implication or business impact
- States the "so what" upfront
- Moves technical details to supporting evidence rather than the lead
- Ends with a clear recommendation or next step

Return a JSON array of review comments. Each comment must have:
- "quotedText": the EXACT text from the document that you are commenting on (copy it verbatim \u2014 this is used to locate the comment in the document)
- "content": your executive review note \u2014 start with a category label like "Missing 'so what':", "Too technical too early:", "Buried insight:", "No action orientation:", or "Audience mismatch:"
- "proposedText": the suggested rewrite that leads with strategic framing

IMPORTANT: The "quotedText" must be an exact substring from the document text. Copy it character-for-character. Do NOT paraphrase or abbreviate it. Include enough words to be unique (at least 5-10 words).

Return ONLY valid JSON array. Identify 2-5 meaningful issues.`;
    try {
      const response = await llm.invoke([
        new SystemMessage2(systemPrompt),
        new HumanMessage2(`Document Title: ${state.documentTitle}

Document Content:
${plainText}`)
      ]);
      const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      if (!content || content.trim().length === 0) {
        return { reviewComments: generateMockExecutiveReviewComments(state.documentContent) };
      }
      const parsed = extractJson2(content);
      const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
      const resolved = resolvePositions(comments, state.documentContent);
      return { reviewComments: resolved.length > 0 ? resolved : generateMockExecutiveReviewComments(state.documentContent) };
    } catch (e) {
      console.error("LLM executive review error, falling back to mock:", e);
      return { reviewComments: generateMockExecutiveReviewComments(state.documentContent) };
    }
  }).addNode("persist", async (state) => {
    const saved = [];
    for (const rc of state.reviewComments) {
      const comment = await storage.createComment({
        documentId: state.documentId,
        from: rc.from,
        to: rc.to,
        content: rc.content,
        type: "executive",
        proposedText: rc.proposedText
      });
      saved.push(comment);
    }
    return { savedComments: saved };
  }).addEdge(START2, "analyze").addEdge("analyze", "persist").addEdge("persist", END2).compile();
  return _executiveReviewGraph;
}
function getFactCheckCandidateGraph() {
  if (_factCheckCandidateGraph) return _factCheckCandidateGraph;
  _factCheckCandidateGraph = new StateGraph2(FactCheckState).addNode("spot", async (state) => {
    if (!hasApiKey4()) {
      return { candidates: generateMockFactCheckCandidates(state.documentContent) };
    }
    const plainText = getPlainText(state.documentContent);
    const llm = createLLM2();
    const systemPrompt = `You are a fact-checking analyst. Your job is to scan a document and identify statements, claims, statistics, or assertions that should be fact-checked. Look for:

1. **Specific statistics or numbers** \u2014 e.g. "revenue grew 40%", "47 microservices", "120ms latency"
2. **Unsubstantiated claims** \u2014 assertions stated as fact without citing a source
3. **Bold or sweeping generalizations** \u2014 e.g. "the best in the industry", "always leads to"
4. **Historical or factual claims** \u2014 dates, events, attributions that could be wrong
5. **Causal claims** \u2014 statements implying cause and effect without evidence

Do NOT flag opinions clearly marked as opinions, or obvious rhetorical devices.

Return a JSON array of candidate items. Each must have:
- "quotedText": the EXACT text from the document that contains the claim (copy it verbatim \u2014 this is used to locate the claim in the document)
- "content": a brief note explaining WHY this should be fact-checked (start with a category like "Statistic:", "Unsubstantiated claim:", "Generalization:", "Causal claim:", or "Historical claim:")

IMPORTANT: The "quotedText" must be an exact substring from the document text. Copy it character-for-character. Do NOT paraphrase or abbreviate it. Include enough words to be unique (at least 5-10 words).

Return ONLY valid JSON array. Identify 2-6 candidates.`;
    try {
      const response = await llm.invoke([
        new SystemMessage2(systemPrompt),
        new HumanMessage2(`Document Title: ${state.documentTitle}

Document Content:
${plainText}`)
      ]);
      const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      if (!content || content.trim().length === 0) {
        return { candidates: generateMockFactCheckCandidates(state.documentContent) };
      }
      const parsed = extractJson2(content);
      const items = Array.isArray(parsed) ? parsed : parsed.candidates || parsed.comments || [];
      const resolved = resolvePositions(items, state.documentContent).map((r) => ({
        from: r.from,
        to: r.to,
        content: r.content
      }));
      return { candidates: resolved.length > 0 ? resolved : generateMockFactCheckCandidates(state.documentContent) };
    } catch (e) {
      console.error("LLM factcheck candidate error, falling back to mock:", e);
      return { candidates: generateMockFactCheckCandidates(state.documentContent) };
    }
  }).addNode("persist", async (state) => {
    const saved = [];
    for (const c of state.candidates) {
      const comment = await storage.createComment({
        documentId: state.documentId,
        from: c.from,
        to: c.to,
        content: c.content,
        type: "factcheck",
        proposedText: ""
      });
      saved.push(comment);
    }
    return { savedComments: saved };
  }).addEdge(START2, "spot").addEdge("spot", "persist").addEdge("persist", END2).compile();
  return _factCheckCandidateGraph;
}
function getFactCheckRunGraph() {
  if (_factCheckRunGraph) return _factCheckRunGraph;
  _factCheckRunGraph = new StateGraph2(FactCheckRunState).addNode("check", async (state) => {
    const updatedComments = [];
    const { plainText, map } = buildPositionMap(state.documentContent);
    const fullPlainText = getPlainText(state.documentContent);
    for (const candidate of state.acceptedCandidates) {
      let highlightedText = "";
      for (let i = 0; i < map.length; i++) {
        if (map[i] >= candidate.from && map[i] < candidate.to) {
          highlightedText += plainText[i];
        }
      }
      highlightedText = highlightedText.trim();
      let verdict = "";
      if (!hasApiKey4()) {
        verdict = `Fact check result: The claim "${highlightedText.slice(0, 50)}${highlightedText.length > 50 ? "..." : ""}" appears to be a reasonable assertion but could not be independently verified. Recommend adding a source citation to strengthen credibility.`;
      } else {
        const llm = createLLM2();
        const systemPrompt = `You are a rigorous fact-checker. You are given a specific claim or statement from a document. Your job is to assess its accuracy.

Evaluate the claim and return a JSON object with:
- "verdict": One of "Verified", "Likely Accurate", "Unverifiable", "Misleading", or "Inaccurate"
- "explanation": A clear 2-3 sentence explanation of your assessment. Include what you found, why you reached this conclusion, and any caveats.
- "recommendation": A brief suggestion (e.g. "Add source citation", "Rephrase to qualify the claim", "Remove or correct this figure")

Return ONLY valid JSON.`;
        try {
          const response = await llm.invoke([
            new SystemMessage2(systemPrompt),
            new HumanMessage2(`Claim to fact-check: "${highlightedText}"

Original reviewer note: ${candidate.content}

Full document context:
${fullPlainText}`)
          ]);
          const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
          if (content && content.trim().length > 0) {
            try {
              const parsed = extractJson2(content);
              verdict = `[${parsed.verdict || "Reviewed"}] ${parsed.explanation || "Review complete."} Recommendation: ${parsed.recommendation || "No specific recommendation."}`;
            } catch {
              verdict = content.trim().slice(0, 500);
            }
          } else {
            verdict = `Fact check result: The claim "${highlightedText.slice(0, 50)}${highlightedText.length > 50 ? "..." : ""}" could not be independently verified at this time. Consider adding a source citation.`;
          }
        } catch (e) {
          console.error("LLM fact check error for candidate:", candidate.id, e);
          verdict = `Fact check result: Unable to verify this claim at this time. Manual verification recommended.`;
        }
      }
      const updated = await storage.updateComment(candidate.id, {
        aiReply: verdict,
        status: "accepted"
      });
      updatedComments.push(updated);
    }
    return { results: updatedComments };
  }).addEdge(START2, "check").addEdge("check", END2).compile();
  return _factCheckRunGraph;
}
async function spotFactCheckCandidates(doc) {
  try {
    const graph = getFactCheckCandidateGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentTitle: doc.title || "",
      documentId: doc.id
    });
    return result.savedComments;
  } catch (error) {
    console.error("spotFactCheckCandidates error:", error);
    return [];
  }
}
async function runFactCheck(doc, acceptedCandidates) {
  try {
    const graph = getFactCheckRunGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentId: doc.id,
      acceptedCandidates
    });
    return result.results;
  } catch (error) {
    console.error("runFactCheck error:", error);
    return [];
  }
}
async function executiveReviewDocument(doc) {
  try {
    const graph = getExecutiveReviewGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentTitle: doc.title || "",
      documentId: doc.id
    });
    return result.savedComments;
  } catch (error) {
    console.error("executiveReviewDocument error:", error);
    return [];
  }
}
async function reviewDocument(doc) {
  try {
    const graph = getReviewGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentTitle: doc.title || "",
      documentId: doc.id
    });
    return result.savedComments;
  } catch (error) {
    console.error("reviewDocument error:", error);
    return [];
  }
}
async function actionComment(doc, comment) {
  try {
    const graph = getActionGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentId: doc.id,
      comment
    });
    return result.updatedComment || comment;
  } catch (error) {
    console.error("actionComment error:", error);
    return comment;
  }
}

// server/routes.ts
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});
var STAGE_ORDER = [
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
  "complete"
];
var APPROVE_MAP = {
  definition_draft: "definition_approved",
  issues_draft: "issues_approved",
  hypotheses_draft: "hypotheses_approved",
  execution_done: "execution_approved",
  summary_draft: "summary_approved",
  presentation_draft: "complete"
};
var UNAPPROVE_MAP = {
  definition_approved: "definition_draft",
  issues_approved: "issues_draft",
  hypotheses_approved: "hypotheses_draft",
  execution_approved: "execution_done",
  summary_approved: "summary_draft",
  complete: "presentation_draft"
};
var RUN_NEXT_MAP = {
  created: "definition_draft",
  definition_approved: "issues_draft",
  issues_approved: "hypotheses_draft",
  hypotheses_approved: "execution_done",
  execution_approved: "summary_draft",
  summary_approved: "presentation_draft"
};
var DEFAULT_AGENTS = [
  { key: "project_definition", name: "Project Definition", role: "Framing", roleColor: "#F59E0B", description: "Translates vague briefs into structured, decision-based problem definitions with governing questions, success metrics, and initial hypotheses" },
  { key: "issues_tree", name: "Issues Tree", role: "Generator", roleColor: "#3B82F6", description: "Builds MECE issues tree from project objective" },
  { key: "mece_critic", name: "MECE Critic", role: "Quality Gate", roleColor: "#8B5CF6", description: "Validates MECE structure and compliance" },
  { key: "hypothesis", name: "Hypothesis", role: "Analyst", roleColor: "#0891B2", description: "Generates testable hypotheses and analysis plans" },
  { key: "execution", name: "Execution", role: "Tool Caller", roleColor: "#059669", description: "Runs scenario analysis with calculator tool" },
  { key: "summary", name: "Summary", role: "Synthesizer", roleColor: "#D97706", description: "Synthesizes findings into executive summary" },
  { key: "presentation", name: "Presentation", role: "Designer", roleColor: "#E11D48", description: "Creates professional slide deck" }
];
var DEFAULT_WORKFLOW_STEPS = [
  { stepOrder: 1, name: "Project Definition", agentKey: "project_definition" },
  { stepOrder: 2, name: "Issues Tree", agentKey: "issues_tree" },
  { stepOrder: 3, name: "Hypotheses & Analysis Plan", agentKey: "hypothesis" },
  { stepOrder: 4, name: "Execution", agentKey: "execution" },
  { stepOrder: 5, name: "Executive Summary", agentKey: "summary" },
  { stepOrder: 6, name: "Presentation", agentKey: "presentation" }
];
async function ensureDefaults() {
  for (const a of DEFAULT_AGENTS) {
    await storage.upsertAgent(a);
  }
  const templates = await storage.listWorkflowTemplates();
  if (templates.length === 0) {
    const template = await storage.createWorkflowTemplate({
      name: "Consulting Analysis",
      description: "Standard consulting workflow: Project Definition -> Issues Tree -> Hypotheses -> Execution -> Summary -> Presentation"
    });
    for (const step of DEFAULT_WORKFLOW_STEPS) {
      await storage.addWorkflowTemplateStep({
        workflowTemplateId: template.id,
        ...step
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
          agentKey: "project_definition"
        });
      }
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
  const STAGE_MAP = {
    project_definition: "definition_draft",
    issues_tree: "issues_draft",
    hypothesis: "hypotheses_draft",
    execution: "execution_done",
    summary: "summary_draft",
    presentation: "presentation_draft"
  };
  async function persistAgentResults(projectId, agentKey, deliverableContent) {
    if (agentKey === "issues_tree") {
      const issues = deliverableContent?.issues || deliverableContent;
      if (Array.isArray(issues)) {
        const version = await storage.getLatestIssueVersion(projectId) + 1;
        const idMap = /* @__PURE__ */ new Map();
        let remaining = [...issues];
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
      }
    } else if (agentKey === "hypothesis") {
      const result = deliverableContent;
      if (result?.hypotheses) {
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
        if (result.analysisPlan) {
          await storage.insertAnalysisPlan(
            projectId,
            result.analysisPlan.map((p) => ({
              hypothesisId: insertedHyps[p.hypothesisIndex]?.id || insertedHyps[0]?.id || null,
              method: p.method,
              parametersJson: p.parameters,
              requiredDataset: p.requiredDataset
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
        const version = await storage.getLatestNarrativeVersion(projectId) + 1;
        await storage.insertNarrative(projectId, version, deliverableContent.summaryText);
      }
    } else if (agentKey === "presentation") {
      if (deliverableContent?.slides) {
        const slideVersion = await storage.getLatestSlideVersion(projectId) + 1;
        await storage.insertSlides(
          projectId,
          slideVersion,
          deliverableContent.slides.map((s) => ({
            slideIndex: s.slideIndex,
            layout: s.layout,
            title: s.title,
            subtitle: s.subtitle || void 0,
            bodyJson: s.bodyJson,
            notesText: s.notesText || void 0
          }))
        );
      }
    }
  }
  async function executeStepAgent(projectId, stepId, onProgress = () => {
  }) {
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
      const result = await runWorkflowStep(projectId, step.agentKey, onProgress);
      const { deliverableContent, deliverableTitle } = result;
      await persistAgentResults(projectId, step.agentKey, deliverableContent);
      const newStage = STAGE_MAP[step.agentKey];
      if (newStage) {
        await storage.updateProjectStage(projectId, newStage);
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
      return {
        project: updatedProject,
        step: await storage.getWorkflowInstanceStep(stepId),
        deliverableTitle
      };
    } catch (agentErr) {
      await storage.updateWorkflowInstanceStep(stepId, { status: "failed" });
      await storage.updateRunLog(runLog.id, null, "failed", agentErr.message);
      throw new Error(`Agent failed: ${agentErr.message}`);
    }
  }
  app2.post("/api/projects/:id/workflow/steps/:stepId/run", async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const stepId = Number(req.params.stepId);
      const result = await executeStepAgent(projectId, stepId);
      res.json({ project: result.project, step: result.step });
    } catch (err) {
      const status = err.message?.startsWith("Agent failed:") ? 500 : err.message === "Project not found" || err.message === "Step not found" ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:id/workflow/steps/:stepId/run-stream", async (req, res) => {
    const projectId = Number(req.params.id);
    const stepId = Number(req.params.stepId);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    let closed = false;
    req.on("close", () => {
      closed = true;
    });
    function sendSSE(type, content) {
      if (closed) return;
      const payload = JSON.stringify({ type, content, timestamp: Date.now() });
      res.write(`data: ${payload}

`);
    }
    sendSSE("connected", "Stream connected");
    const onProgress = (message, type) => {
      sendSSE(type || "progress", message);
      storage.insertStepChatMessage({
        stepId,
        role: "assistant",
        content: message,
        messageType: type || "progress"
      }).catch(() => {
      });
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
          metadata: { deliverableId: latestDel.id, title: latestDel.title, version: latestDel.version, agentKey: result.step?.agentKey }
        });
      }
      sendSSE("complete", JSON.stringify({ deliverableTitle: result.deliverableTitle, project: result.project, step: result.step }));
    } catch (err) {
      sendSSE("error", err.message || "Unknown error");
    } finally {
      if (!closed) res.end();
    }
  });
  app2.get("/api/projects/:id/workflow/steps/:stepId/chat", async (req, res) => {
    try {
      const stepId = Number(req.params.stepId);
      const messages3 = await storage.getStepChatMessages(stepId);
      res.json(messages3);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/projects/:id/workflow/steps/:stepId/chat", async (req, res) => {
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
        messageType: "message"
      });
      const stepDeliverables = await storage.getStepDeliverables(stepId);
      const currentDeliverable = stepDeliverables[0];
      if (currentDeliverable) {
        const refined = await refineWithLangGraph(
          step.agentKey,
          currentDeliverable.contentJson,
          message,
          { objective: project.objective, constraints: project.constraints }
        );
        await storage.updateDeliverable(currentDeliverable.id, { contentJson: refined });
        await storage.insertStepChatMessage({
          stepId,
          role: "assistant",
          content: JSON.stringify(refined),
          messageType: "deliverable",
          metadata: { deliverableId: currentDeliverable.id, title: currentDeliverable.title, version: currentDeliverable.version, agentKey: step.agentKey }
        });
      } else {
        await storage.insertStepChatMessage({
          stepId,
          role: "assistant",
          content: "No deliverable found to refine. Please run the agent first.",
          messageType: "message"
        });
      }
      const messages3 = await storage.getStepChatMessages(stepId);
      res.json(messages3);
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
  app2.post("/api/projects/:id/workflow/steps/:stepId/unapprove", async (req, res) => {
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
          definition_draft: "project_definition",
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
      const agentKeyForStage = {
        definition_draft: "project_definition",
        issues_draft: "issues_tree",
        hypotheses_draft: "hypothesis",
        execution_done: "execution",
        summary_draft: "summary",
        presentation_draft: "presentation"
      };
      const agentKey = agentKeyForStage[nextStage];
      const modelUsed = getModelUsed();
      const runLog = await storage.insertRunLog(projectId, nextStage, { currentStage: project.stage }, modelUsed);
      try {
        const result = await runWorkflowStep(projectId, agentKey, () => {
        });
        await persistAgentResults(projectId, agentKey, result.deliverableContent);
        await storage.updateRunLog(runLog.id, result.deliverableContent, "success");
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
        definition: "created",
        issues: "definition_approved",
        hypotheses: "issues_approved",
        execution: "hypotheses_approved",
        summary: "execution_approved",
        presentation: "summary_approved"
      };
      const targetStage = stageMap[step];
      if (!targetStage) return res.status(400).json({ error: `Invalid step "${step}"` });
      const currentIdx = STAGE_ORDER.indexOf(project.stage);
      const stepDraftStages = {
        definition: "definition_draft",
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
      const keyParam = req.params.key;
      const agent = await storage.getAgentByKey(keyParam);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const saved = await storage.getAgentConfig(keyParam);
      res.json({
        ...agent,
        systemPrompt: saved?.systemPrompt || agent.promptTemplate || DEFAULT_PROMPTS[keyParam] || "",
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
  app2.get("/api/documents", async (req, res) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : void 0;
      res.json(await storage.listDocuments(projectId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/documents", async (req, res) => {
    try {
      const { projectId, title, content, contentJson } = req.body;
      res.status(201).json(await storage.createDocument({ projectId, title, content, contentJson }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/documents/:id", async (req, res) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.put("/api/documents/:id", async (req, res) => {
    try {
      res.json(await storage.updateDocument(Number(req.params.id), req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/documents/:id", async (req, res) => {
    try {
      await storage.deleteDocument(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/documents/:id/comments", async (req, res) => {
    try {
      res.json(await storage.listComments(Number(req.params.id)));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/documents/:id/comments", async (req, res) => {
    try {
      const { from, to, content, type, proposedText, aiReply } = req.body;
      res.status(201).json(await storage.createComment({
        documentId: Number(req.params.id),
        from,
        to,
        content,
        type,
        proposedText,
        aiReply
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.put("/api/comments/:id", async (req, res) => {
    try {
      res.json(await storage.updateComment(Number(req.params.id), req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/comments/:id", async (req, res) => {
    try {
      await storage.deleteComment(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/documents/:id/review", async (req, res) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      const comments = await reviewDocument(doc);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/documents/:id/executive-review", async (req, res) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      const comments = await executiveReviewDocument(doc);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/documents/:id/comments/:commentId/action", async (req, res) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      const commentId = Number(req.params.commentId);
      const comments = await storage.listComments(doc.id);
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      const result = await actionComment(doc, comment);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/documents/:id/factcheck-candidates", async (req, res) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      const comments = await spotFactCheckCandidates(doc);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/documents/:id/factcheck", async (req, res) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      const allComments = await storage.listComments(doc.id);
      const acceptedCandidates = allComments.filter(
        (c) => c.type === "factcheck" && c.status === "accepted"
      );
      if (acceptedCandidates.length === 0) {
        return res.status(400).json({ error: "No accepted fact-check candidates found. Accept some candidates first." });
      }
      const results = await runFactCheck(doc, acceptedCandidates);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/projects/:projectId/vault/upload", upload.single("file"), async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });
      const storagePath = `vault/${projectId}/${Date.now()}_${file.originalname}`;
      const vaultFile = await storage.createVaultFile({
        projectId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath
      });
      processVaultFile(vaultFile.id, file.buffer).catch(
        (err) => console.error("Background processing failed:", err)
      );
      res.status(201).json(vaultFile);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:projectId/vault", async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const search = req.query.search;
      const files = await storage.listVaultFiles(projectId, search);
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:projectId/vault/:fileId", async (req, res) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:projectId/vault/:fileId/download", async (req, res) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
      res.send(file.extractedText || "File content not available for download in this mode.");
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/projects/:projectId/vault/:fileId", async (req, res) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      await storage.deleteVaultChunksByFile(file.id);
      await storage.deleteVaultFile(file.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/projects/:projectId/vault/:fileId/chunks", async (req, res) => {
    try {
      const file = await storage.getVaultFile(Number(req.params.fileId));
      if (!file || file.projectId !== Number(req.params.projectId)) {
        return res.status(404).json({ error: "File not found" });
      }
      const chunks = await storage.getVaultChunksByFile(file.id);
      res.json(chunks.map((c) => ({ id: c.id, chunkIndex: c.chunkIndex, content: c.content, tokenCount: c.tokenCount })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/projects/:projectId/vault/query", async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const { query, maxChunks } = req.body;
      if (!query) return res.status(400).json({ error: "query is required" });
      const results = await retrieveRelevantContext(projectId, query, maxChunks || 10);
      res.json({ results, formattedContext: formatRAGContext(results) });
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
