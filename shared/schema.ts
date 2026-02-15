import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  constraints: text("constraints").notNull(),
  stage: text("stage").notNull().default("created"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
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

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
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
