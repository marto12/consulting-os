import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import {
  projects,
  issueNodes,
  hypotheses,
  analysisPlan,
  modelRuns,
  narratives,
  runLogs,
  type Project,
  type InsertProject,
  type IssueNode,
  type Hypothesis,
  type AnalysisPlan,
  type ModelRun,
  type Narrative,
  type RunLog,
} from "@shared/schema";

export const storage = {
  async createProject(data: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({ ...data, stage: "created" })
      .returning();
    return project;
  },

  async listProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  },

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project;
  },

  async updateProjectStage(id: number, stage: string): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ stage, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  },

  async getLatestIssueVersion(projectId: number): Promise<number> {
    const nodes = await db
      .select()
      .from(issueNodes)
      .where(eq(issueNodes.projectId, projectId))
      .orderBy(desc(issueNodes.version));
    return nodes[0]?.version || 0;
  },

  async insertIssueNodes(
    projectId: number,
    version: number,
    nodes: { parentId: number | null; text: string; priority: string }[]
  ): Promise<IssueNode[]> {
    if (nodes.length === 0) return [];
    const values = nodes.map((n) => ({
      projectId,
      parentId: n.parentId,
      text: n.text,
      priority: n.priority,
      version,
    }));
    return db.insert(issueNodes).values(values).returning();
  },

  async getIssueNodes(projectId: number): Promise<IssueNode[]> {
    return db
      .select()
      .from(issueNodes)
      .where(eq(issueNodes.projectId, projectId))
      .orderBy(desc(issueNodes.version), issueNodes.id);
  },

  async getLatestHypothesisVersion(projectId: number): Promise<number> {
    const hyps = await db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.projectId, projectId))
      .orderBy(desc(hypotheses.version));
    return hyps[0]?.version || 0;
  },

  async insertHypotheses(
    projectId: number,
    version: number,
    hyps: {
      issueNodeId: number | null;
      statement: string;
      metric: string;
      dataSource: string;
      method: string;
    }[]
  ): Promise<Hypothesis[]> {
    if (hyps.length === 0) return [];
    const values = hyps.map((h) => ({
      projectId,
      issueNodeId: h.issueNodeId,
      statement: h.statement,
      metric: h.metric,
      dataSource: h.dataSource,
      method: h.method,
      version,
    }));
    return db.insert(hypotheses).values(values).returning();
  },

  async getHypotheses(projectId: number): Promise<Hypothesis[]> {
    return db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.projectId, projectId))
      .orderBy(desc(hypotheses.version), hypotheses.id);
  },

  async insertAnalysisPlan(
    projectId: number,
    plans: {
      hypothesisId: number | null;
      method: string;
      parametersJson: any;
      requiredDataset: string;
    }[]
  ): Promise<AnalysisPlan[]> {
    if (plans.length === 0) return [];
    const values = plans.map((p) => ({
      projectId,
      hypothesisId: p.hypothesisId,
      method: p.method,
      parametersJson: p.parametersJson,
      requiredDataset: p.requiredDataset,
    }));
    return db.insert(analysisPlan).values(values).returning();
  },

  async getAnalysisPlan(projectId: number): Promise<AnalysisPlan[]> {
    return db
      .select()
      .from(analysisPlan)
      .where(eq(analysisPlan.projectId, projectId))
      .orderBy(analysisPlan.id);
  },

  async insertModelRun(
    projectId: number,
    toolName: string,
    inputsJson: any,
    outputsJson: any
  ): Promise<ModelRun> {
    const [run] = await db
      .insert(modelRuns)
      .values({ projectId, toolName, inputsJson, outputsJson })
      .returning();
    return run;
  },

  async getModelRuns(projectId: number): Promise<ModelRun[]> {
    return db
      .select()
      .from(modelRuns)
      .where(eq(modelRuns.projectId, projectId))
      .orderBy(modelRuns.id);
  },

  async getLatestNarrativeVersion(projectId: number): Promise<number> {
    const narrs = await db
      .select()
      .from(narratives)
      .where(eq(narratives.projectId, projectId))
      .orderBy(desc(narratives.version));
    return narrs[0]?.version || 0;
  },

  async insertNarrative(
    projectId: number,
    version: number,
    summaryText: string
  ): Promise<Narrative> {
    const [narr] = await db
      .insert(narratives)
      .values({ projectId, summaryText, version })
      .returning();
    return narr;
  },

  async getNarratives(projectId: number): Promise<Narrative[]> {
    return db
      .select()
      .from(narratives)
      .where(eq(narratives.projectId, projectId))
      .orderBy(desc(narratives.version));
  },

  async insertRunLog(
    projectId: number,
    stage: string,
    inputJson: any,
    modelUsed: string,
    status: string = "pending"
  ): Promise<RunLog> {
    const [log] = await db
      .insert(runLogs)
      .values({ projectId, stage, inputJson, modelUsed, status })
      .returning();
    return log;
  },

  async updateRunLog(
    id: number,
    outputJson: any,
    status: string,
    errorText?: string
  ): Promise<RunLog> {
    const [log] = await db
      .update(runLogs)
      .set({ outputJson, status, errorText })
      .where(eq(runLogs.id, id))
      .returning();
    return log;
  },

  async getRunLogs(projectId: number): Promise<RunLog[]> {
    return db
      .select()
      .from(runLogs)
      .where(eq(runLogs.projectId, projectId))
      .orderBy(desc(runLogs.createdAt));
  },
};
