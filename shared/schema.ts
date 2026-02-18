import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const workflowTemplates = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const workflowTemplateSteps = pgTable("workflow_template_steps", {
  id: serial("id").primaryKey(),
  workflowTemplateId: integer("workflow_template_id")
    .notNull()
    .references(() => workflowTemplates.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  name: text("name").notNull(),
  agentKey: text("agent_key").notNull(),
  description: text("description").notNull().default(""),
  configJson: jsonb("config_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const agents = pgTable("agents", {
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
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  owner: text("owner").notNull().default("system"),
  accessLevel: text("access_level").notNull().default("private"),
  sourceType: text("source_type").notNull().default("manual"),
  sourceUrl: text("source_url"),
  schemaJson: jsonb("schema_json"),
  metadata: jsonb("metadata"),
  rowCount: integer("row_count").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const datasetRows = pgTable("dataset_rows", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id").notNull().references(() => datasets.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(),
  data: jsonb("data").notNull(),
});

export const models = pgTable("models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  apiConfig: jsonb("api_config"),
  linkedWorkflowIds: jsonb("linked_workflow_ids").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  constraints: text("constraints").notNull(),
  stage: text("stage").notNull().default("created"),
  workflowTemplateId: integer("workflow_template_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const workflowInstances = pgTable("workflow_instances", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  workflowTemplateId: integer("workflow_template_id")
    .notNull(),
  currentStepOrder: integer("current_step_order").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const workflowInstanceSteps = pgTable("workflow_instance_steps", {
  id: serial("id").primaryKey(),
  workflowInstanceId: integer("workflow_instance_id")
    .notNull()
    .references(() => workflowInstances.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  name: text("name").notNull(),
  agentKey: text("agent_key").notNull(),
  status: text("status").notNull().default("not_started"),
  configJson: jsonb("config_json"),
  outputSummary: jsonb("output_summary"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  stepId: integer("step_id")
    .notNull()
    .references(() => workflowInstanceSteps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  contentJson: jsonb("content_json").notNull(),
  version: integer("version").notNull().default(1),
  locked: boolean("locked").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const issueNodes = pgTable("issue_nodes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  text: text("text").notNull(),
  priority: text("priority").notNull().default("medium"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const hypotheses = pgTable("hypotheses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  issueNodeId: integer("issue_node_id"),
  statement: text("statement").notNull(),
  metric: text("metric").notNull(),
  dataSource: text("data_source").notNull(),
  method: text("method").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const analysisPlan = pgTable("analysis_plan", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  hypothesisId: integer("hypothesis_id"),
  method: text("method").notNull(),
  parametersJson: jsonb("parameters_json").notNull(),
  requiredDataset: text("required_dataset").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const modelRuns = pgTable("model_runs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  inputsJson: jsonb("inputs_json").notNull(),
  outputsJson: jsonb("outputs_json").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const narratives = pgTable("narratives", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  summaryText: text("summary_text").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const runLogs = pgTable("run_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json"),
  modelUsed: text("model_used").notNull(),
  status: text("status").notNull().default("pending"),
  errorText: text("error_text"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const slides = pgTable("slides", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  slideIndex: integer("slide_index").notNull(),
  layout: text("layout").notNull().default("title_body"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  bodyJson: jsonb("body_json").notNull(),
  notesText: text("notes_text"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const stepChatMessages = pgTable("step_chat_messages", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id")
    .notNull()
    .references(() => workflowInstanceSteps.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const agentConfigs = pgTable("agent_configs", {
  id: serial("id").primaryKey(),
  agentType: text("agent_type").notNull().unique(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-5-nano"),
  maxTokens: integer("max_tokens").notNull().default(8192),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  projectId: integer("project_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const pipelineConfigs = pgTable("pipeline_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentsJson: jsonb("agents_json").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Document"),
  content: text("content").notNull().default(""),
  contentJson: jsonb("content_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const documentComments = pgTable("document_comments", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  from: integer("from_pos").notNull(),
  to: integer("to_pos").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  proposedText: text("proposed_text"),
  aiReply: text("ai_reply"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const vaultFiles = pgTable("vault_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  extractedText: text("extracted_text"),
  embeddingStatus: text("embedding_status").notNull().default("pending"),
  chunkCount: integer("chunk_count").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const vaultChunks = pgTable("vault_chunks", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id")
    .notNull()
    .references(() => vaultFiles.id, { onDelete: "cascade" }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding"),
  tokenCount: integer("token_count").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const charts = pgTable("charts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  datasetId: integer("dataset_id").references(() => datasets.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  chartType: text("chart_type").notNull().default("bar"),
  chartConfig: jsonb("chart_config").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  stage: true,
  createdAt: true,
  updatedAt: true,
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type IssueNode = typeof issueNodes.$inferSelect;
export type Hypothesis = typeof hypotheses.$inferSelect;
export type AnalysisPlan = typeof analysisPlan.$inferSelect;
export type ModelRun = typeof modelRuns.$inferSelect;
export type Narrative = typeof narratives.$inferSelect;
export type RunLog = typeof runLogs.$inferSelect;
export type Slide = typeof slides.$inferSelect;
export type AgentConfig = typeof agentConfigs.$inferSelect;
export type PipelineConfig = typeof pipelineConfigs.$inferSelect;

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type WorkflowTemplateStep = typeof workflowTemplateSteps.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Dataset = typeof datasets.$inferSelect;
export type Model = typeof models.$inferSelect;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type WorkflowInstanceStep = typeof workflowInstanceSteps.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type StepChatMessage = typeof stepChatMessages.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentComment = typeof documentComments.$inferSelect;
export type VaultFile = typeof vaultFiles.$inferSelect;
export type VaultChunk = typeof vaultChunks.$inferSelect;
export type Chart = typeof charts.$inferSelect;
