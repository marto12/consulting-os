import { db } from "./db";
import { eq, desc, and, asc, ilike, sql } from "drizzle-orm";
import {
  projects,
  issueNodes,
  hypotheses,
  analysisPlan,
  modelRuns,
  narratives,
  runLogs,
  slides,
  agentConfigs,
  pipelineConfigs,
  workflowTemplates,
  workflowTemplateSteps,
  agents,
  datasets,
  models,
  workflowInstances,
  workflowInstanceSteps,
  deliverables,
  stepChatMessages,
  conversations,
  messages,
  documents,
  documentComments,
  vaultFiles,
  vaultChunks,
  datasetRows,
  type Project,
  type InsertProject,
  type StepChatMessage,
  type IssueNode,
  type Hypothesis,
  type AnalysisPlan,
  type ModelRun,
  type Narrative,
  type RunLog,
  type Slide,
  type AgentConfig,
  type PipelineConfig,
  type WorkflowTemplate,
  type WorkflowTemplateStep,
  type Agent,
  type Dataset,
  type Model,
  type WorkflowInstance,
  type WorkflowInstanceStep,
  type Deliverable,
  type Document,
  type DocumentComment,
  type VaultFile,
  type VaultChunk,
} from "@shared/schema";

export const storage = {
  async createProject(data: InsertProject & { workflowTemplateId?: number }): Promise<Project> {
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

  async createWorkflowTemplate(data: { name: string; description?: string }): Promise<WorkflowTemplate> {
    const [template] = await db
      .insert(workflowTemplates)
      .values({ name: data.name, description: data.description || "" })
      .returning();
    return template;
  },

  async listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    return db.select().from(workflowTemplates).orderBy(desc(workflowTemplates.updatedAt));
  },

  async getWorkflowTemplate(id: number): Promise<WorkflowTemplate | undefined> {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, id));
    return template;
  },

  async updateWorkflowTemplate(id: number, data: { name?: string; description?: string }): Promise<WorkflowTemplate> {
    const [template] = await db
      .update(workflowTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowTemplates.id, id))
      .returning();
    return template;
  },

  async getWorkflowTemplateSteps(templateId: number): Promise<WorkflowTemplateStep[]> {
    return db
      .select()
      .from(workflowTemplateSteps)
      .where(eq(workflowTemplateSteps.workflowTemplateId, templateId))
      .orderBy(asc(workflowTemplateSteps.stepOrder));
  },

  async addWorkflowTemplateStep(data: {
    workflowTemplateId: number;
    stepOrder: number;
    name: string;
    agentKey: string;
    description?: string;
    configJson?: any;
  }): Promise<WorkflowTemplateStep> {
    const [step] = await db
      .insert(workflowTemplateSteps)
      .values({
        workflowTemplateId: data.workflowTemplateId,
        stepOrder: data.stepOrder,
        name: data.name,
        agentKey: data.agentKey,
        description: data.description || "",
        configJson: data.configJson || null,
      })
      .returning();
    return step;
  },

  async updateWorkflowTemplateStep(id: number, data: { stepOrder?: number; name?: string; agentKey?: string }): Promise<void> {
    await db.update(workflowTemplateSteps).set(data).where(eq(workflowTemplateSteps.id, id));
  },

  async deleteWorkflowTemplateStep(id: number): Promise<void> {
    await db.delete(workflowTemplateSteps).where(eq(workflowTemplateSteps.id, id));
  },

  async deleteWorkflowTemplate(id: number): Promise<void> {
    await db.delete(workflowTemplateSteps).where(eq(workflowTemplateSteps.workflowTemplateId, id));
    await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
  },

  async replaceWorkflowTemplateSteps(templateId: number, steps: Array<{ stepOrder: number; name: string; agentKey: string; description?: string }>): Promise<WorkflowTemplateStep[]> {
    await db.delete(workflowTemplateSteps).where(eq(workflowTemplateSteps.workflowTemplateId, templateId));
    for (const s of steps) {
      await db.insert(workflowTemplateSteps).values({
        workflowTemplateId: templateId,
        stepOrder: s.stepOrder,
        name: s.name,
        agentKey: s.agentKey,
        description: s.description || "",
      });
    }
    return db.select().from(workflowTemplateSteps)
      .where(eq(workflowTemplateSteps.workflowTemplateId, templateId))
      .orderBy(asc(workflowTemplateSteps.stepOrder));
  },

  async listAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(asc(agents.key));
  },

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  },

  async getAgentByKey(key: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.key, key));
    return agent;
  },

  async upsertAgent(data: {
    key: string;
    name: string;
    description?: string;
    role?: string;
    roleColor?: string;
    promptTemplate?: string;
    model?: string;
    maxTokens?: number;
    inputSchema?: any;
    outputSchema?: any;
    toolRefs?: any;
    datasetRefs?: any;
    modelRefs?: any;
  }): Promise<Agent> {
    const existing = await this.getAgentByKey(data.key);
    if (existing) {
      const [updated] = await db
        .update(agents)
        .set({
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
          updatedAt: new Date(),
        })
        .where(eq(agents.key, data.key))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(agents)
      .values({
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
        modelRefs: data.modelRefs || [],
      })
      .returning();
    return created;
  },

  async listDatasets(): Promise<Dataset[]> {
    return db.select().from(datasets).orderBy(desc(datasets.createdAt));
  },

  async getDataset(id: number): Promise<Dataset | undefined> {
    const [d] = await db.select().from(datasets).where(eq(datasets.id, id));
    return d;
  },

  async createDataset(data: { name: string; description?: string; owner?: string; accessLevel?: string; sourceType?: string; sourceUrl?: string; schemaJson?: any; metadata?: any; rowCount?: number }): Promise<Dataset> {
    const [d] = await db.insert(datasets).values({
      name: data.name,
      description: data.description || "",
      owner: data.owner || "system",
      accessLevel: data.accessLevel || "private",
      sourceType: data.sourceType || "manual",
      sourceUrl: data.sourceUrl || null,
      schemaJson: data.schemaJson || null,
      metadata: data.metadata || null,
      rowCount: data.rowCount || 0,
    }).returning();
    return d;
  },

  async updateDataset(id: number, data: { name?: string; description?: string; sourceType?: string; sourceUrl?: string; schemaJson?: any; metadata?: any; rowCount?: number }): Promise<Dataset> {
    const [d] = await db.update(datasets).set({ ...data, updatedAt: new Date() }).where(eq(datasets.id, id)).returning();
    return d;
  },

  async deleteDataset(id: number): Promise<void> {
    await db.delete(datasetRows).where(eq(datasetRows.datasetId, id));
    await db.delete(datasets).where(eq(datasets.id, id));
  },

  async insertDatasetRows(datasetId: number, rows: Array<{ rowIndex: number; data: any }>): Promise<void> {
    await db.delete(datasetRows).where(eq(datasetRows.datasetId, datasetId));
    if (rows.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map((r) => ({
          datasetId,
          rowIndex: r.rowIndex,
          data: r.data,
        }));
        await db.insert(datasetRows).values(batch);
      }
    }
  },

  async getDatasetRows(datasetId: number, limit = 100, offset = 0): Promise<any[]> {
    return db.select().from(datasetRows)
      .where(eq(datasetRows.datasetId, datasetId))
      .orderBy(asc(datasetRows.rowIndex))
      .limit(limit)
      .offset(offset);
  },

  async listModels(): Promise<Model[]> {
    return db.select().from(models).orderBy(desc(models.createdAt));
  },

  async getModel(id: number): Promise<Model | undefined> {
    const [m] = await db.select().from(models).where(eq(models.id, id));
    return m;
  },

  async createModel(data: { name: string; description?: string; inputSchema?: any; outputSchema?: any; apiConfig?: any }): Promise<Model> {
    const [m] = await db.insert(models).values({
      name: data.name,
      description: data.description || "",
      inputSchema: data.inputSchema || null,
      outputSchema: data.outputSchema || null,
      apiConfig: data.apiConfig || null,
    }).returning();
    return m;
  },

  async createWorkflowInstance(data: {
    projectId: number;
    workflowTemplateId: number;
    steps: { stepOrder: number; name: string; agentKey: string; configJson?: any }[];
  }): Promise<WorkflowInstance> {
    const [instance] = await db
      .insert(workflowInstances)
      .values({
        projectId: data.projectId,
        workflowTemplateId: data.workflowTemplateId,
        currentStepOrder: 0,
        status: "active",
      })
      .returning();

    if (data.steps.length > 0) {
      await db.insert(workflowInstanceSteps).values(
        data.steps.map((s) => ({
          workflowInstanceId: instance.id,
          stepOrder: s.stepOrder,
          name: s.name,
          agentKey: s.agentKey,
          status: "not_started" as const,
          configJson: s.configJson || null,
        }))
      );
    }

    return instance;
  },

  async getWorkflowInstance(projectId: number): Promise<WorkflowInstance | undefined> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.projectId, projectId))
      .orderBy(desc(workflowInstances.createdAt));
    return instance;
  },

  async getWorkflowInstanceSteps(instanceId: number): Promise<WorkflowInstanceStep[]> {
    return db
      .select()
      .from(workflowInstanceSteps)
      .where(eq(workflowInstanceSteps.workflowInstanceId, instanceId))
      .orderBy(asc(workflowInstanceSteps.stepOrder));
  },

  async getWorkflowInstanceStep(stepId: number): Promise<WorkflowInstanceStep | undefined> {
    const [step] = await db
      .select()
      .from(workflowInstanceSteps)
      .where(eq(workflowInstanceSteps.id, stepId));
    return step;
  },

  async updateWorkflowInstanceStep(stepId: number, data: { status?: string; outputSummary?: any }): Promise<WorkflowInstanceStep> {
    const [step] = await db
      .update(workflowInstanceSteps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowInstanceSteps.id, stepId))
      .returning();
    return step;
  },

  async updateWorkflowInstanceCurrentStep(instanceId: number, stepOrder: number): Promise<WorkflowInstance> {
    const [instance] = await db
      .update(workflowInstances)
      .set({ currentStepOrder: stepOrder, updatedAt: new Date() })
      .where(eq(workflowInstances.id, instanceId))
      .returning();
    return instance;
  },

  async createDeliverable(data: {
    projectId: number;
    stepId: number;
    title: string;
    contentJson: any;
    version?: number;
  }): Promise<Deliverable> {
    const [d] = await db
      .insert(deliverables)
      .values({
        projectId: data.projectId,
        stepId: data.stepId,
        title: data.title,
        contentJson: data.contentJson,
        version: data.version || 1,
        locked: false,
      })
      .returning();
    return d;
  },

  async getDeliverables(projectId: number): Promise<Deliverable[]> {
    return db
      .select()
      .from(deliverables)
      .where(eq(deliverables.projectId, projectId))
      .orderBy(desc(deliverables.createdAt));
  },

  async getStepDeliverables(stepId: number): Promise<Deliverable[]> {
    return db
      .select()
      .from(deliverables)
      .where(eq(deliverables.stepId, stepId))
      .orderBy(desc(deliverables.version));
  },

  async updateDeliverable(id: number, data: { contentJson?: any; title?: string }): Promise<void> {
    await db.update(deliverables).set(data).where(eq(deliverables.id, id));
  },

  async lockDeliverables(stepId: number): Promise<void> {
    await db
      .update(deliverables)
      .set({ locked: true })
      .where(eq(deliverables.stepId, stepId));
  },

  async unlockDeliverables(stepId: number): Promise<void> {
    await db
      .update(deliverables)
      .set({ locked: false })
      .where(eq(deliverables.stepId, stepId));
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

  async getLatestSlideVersion(projectId: number): Promise<number> {
    const s = await db
      .select()
      .from(slides)
      .where(eq(slides.projectId, projectId))
      .orderBy(desc(slides.version));
    return s[0]?.version || 0;
  },

  async insertSlides(
    projectId: number,
    version: number,
    slideData: {
      slideIndex: number;
      layout: string;
      title: string;
      subtitle?: string;
      bodyJson: any;
      notesText?: string;
    }[]
  ): Promise<Slide[]> {
    if (slideData.length === 0) return [];
    const values = slideData.map((s) => ({
      projectId,
      slideIndex: s.slideIndex,
      layout: s.layout,
      title: s.title,
      subtitle: s.subtitle || null,
      bodyJson: s.bodyJson,
      notesText: s.notesText || null,
      version,
    }));
    return db.insert(slides).values(values).returning();
  },

  async getSlides(projectId: number): Promise<Slide[]> {
    return db
      .select()
      .from(slides)
      .where(eq(slides.projectId, projectId))
      .orderBy(desc(slides.version), slides.slideIndex);
  },

  async getAllAgentConfigs(): Promise<AgentConfig[]> {
    return db.select().from(agentConfigs);
  },

  async getAgentConfig(agentType: string): Promise<AgentConfig | undefined> {
    const [config] = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.agentType, agentType));
    return config;
  },

  async upsertAgentConfig(data: {
    agentType: string;
    systemPrompt: string;
    model: string;
    maxTokens: number;
  }): Promise<AgentConfig> {
    const existing = await this.getAgentConfig(data.agentType);
    if (existing) {
      const [updated] = await db
        .update(agentConfigs)
        .set({
          systemPrompt: data.systemPrompt,
          model: data.model,
          maxTokens: data.maxTokens,
          updatedAt: new Date(),
        })
        .where(eq(agentConfigs.agentType, data.agentType))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(agentConfigs)
      .values(data)
      .returning();
    return created;
  },

  async createPipeline(data: { name: string; agentsJson: any }): Promise<PipelineConfig> {
    const [pipeline] = await db
      .insert(pipelineConfigs)
      .values(data)
      .returning();
    return pipeline;
  },

  async listPipelines(): Promise<PipelineConfig[]> {
    return db.select().from(pipelineConfigs).orderBy(desc(pipelineConfigs.updatedAt));
  },

  async getPipeline(id: number): Promise<PipelineConfig | undefined> {
    const [pipeline] = await db
      .select()
      .from(pipelineConfigs)
      .where(eq(pipelineConfigs.id, id));
    return pipeline;
  },

  async updatePipeline(id: number, data: { name?: string; agentsJson?: any }): Promise<PipelineConfig> {
    const [pipeline] = await db
      .update(pipelineConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pipelineConfigs.id, id))
      .returning();
    return pipeline;
  },

  async deletePipeline(id: number): Promise<void> {
    await db.delete(pipelineConfigs).where(eq(pipelineConfigs.id, id));
  },

  async getStepChatMessages(stepId: number): Promise<StepChatMessage[]> {
    return db
      .select()
      .from(stepChatMessages)
      .where(eq(stepChatMessages.stepId, stepId))
      .orderBy(asc(stepChatMessages.createdAt));
  },

  async insertStepChatMessage(data: {
    stepId: number;
    role: string;
    content: string;
    messageType?: string;
    metadata?: any;
  }): Promise<StepChatMessage> {
    const [msg] = await db
      .insert(stepChatMessages)
      .values({
        stepId: data.stepId,
        role: data.role,
        content: data.content,
        messageType: data.messageType || "message",
        metadata: data.metadata || null,
      })
      .returning();
    return msg;
  },

  async clearStepChatMessages(stepId: number): Promise<void> {
    await db.delete(stepChatMessages).where(eq(stepChatMessages.stepId, stepId));
  },

  async createDocument(data: { projectId?: number; title?: string; content?: string; contentJson?: any }): Promise<Document> {
    const [doc] = await db
      .insert(documents)
      .values({
        projectId: data.projectId || null,
        title: data.title || "Untitled Document",
        content: data.content || "",
        contentJson: data.contentJson || null,
      })
      .returning();
    return doc;
  },

  async listDocuments(projectId?: number): Promise<Document[]> {
    if (projectId) {
      return db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.updatedAt));
    }
    return db.select().from(documents).orderBy(desc(documents.updatedAt));
  },

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  },

  async updateDocument(id: number, data: { title?: string; content?: string; contentJson?: any }): Promise<Document> {
    const [doc] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  },

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  },

  async createComment(data: { documentId: number; from: number; to: number; content: string; type?: string; proposedText?: string; aiReply?: string }): Promise<DocumentComment> {
    const [comment] = await db
      .insert(documentComments)
      .values({
        documentId: data.documentId,
        from: data.from,
        to: data.to,
        content: data.content,
        type: data.type || "user",
        proposedText: data.proposedText || null,
        aiReply: data.aiReply || null,
      })
      .returning();
    return comment;
  },

  async listComments(documentId: number): Promise<DocumentComment[]> {
    return db
      .select()
      .from(documentComments)
      .where(eq(documentComments.documentId, documentId))
      .orderBy(asc(documentComments.createdAt));
  },

  async updateComment(id: number, data: { status?: string; proposedText?: string; aiReply?: string; resolvedAt?: Date }): Promise<DocumentComment> {
    const [comment] = await db
      .update(documentComments)
      .set(data)
      .where(eq(documentComments.id, id))
      .returning();
    return comment;
  },

  async deleteComment(id: number): Promise<void> {
    await db.delete(documentComments).where(eq(documentComments.id, id));
  },

  async deleteDocumentComments(documentId: number): Promise<void> {
    await db.delete(documentComments).where(eq(documentComments.documentId, documentId));
  },

  async createVaultFile(data: {
    projectId: number;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
    extractedText?: string;
    embeddingStatus?: string;
    metadata?: any;
  }): Promise<VaultFile> {
    const [file] = await db
      .insert(vaultFiles)
      .values({
        projectId: data.projectId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        storagePath: data.storagePath,
        extractedText: data.extractedText || null,
        embeddingStatus: data.embeddingStatus || "pending",
        metadata: data.metadata || null,
      })
      .returning();
    return file;
  },

  async listVaultFiles(projectId: number, search?: string): Promise<VaultFile[]> {
    if (search) {
      return db
        .select()
        .from(vaultFiles)
        .where(and(eq(vaultFiles.projectId, projectId), ilike(vaultFiles.fileName, `%${search}%`)))
        .orderBy(desc(vaultFiles.createdAt));
    }
    return db
      .select()
      .from(vaultFiles)
      .where(eq(vaultFiles.projectId, projectId))
      .orderBy(desc(vaultFiles.createdAt));
  },

  async getVaultFile(id: number): Promise<VaultFile | undefined> {
    const [file] = await db.select().from(vaultFiles).where(eq(vaultFiles.id, id));
    return file;
  },

  async updateVaultFile(id: number, data: Partial<{
    extractedText: string;
    embeddingStatus: string;
    chunkCount: number;
    metadata: any;
  }>): Promise<VaultFile> {
    const [file] = await db
      .update(vaultFiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vaultFiles.id, id))
      .returning();
    return file;
  },

  async deleteVaultFile(id: number): Promise<void> {
    await db.delete(vaultFiles).where(eq(vaultFiles.id, id));
  },

  async createVaultChunks(chunks: {
    fileId: number;
    projectId: number;
    chunkIndex: number;
    content: string;
    embedding?: any;
    tokenCount?: number;
  }[]): Promise<VaultChunk[]> {
    if (chunks.length === 0) return [];
    return db.insert(vaultChunks).values(chunks).returning();
  },

  async getVaultChunksByFile(fileId: number): Promise<VaultChunk[]> {
    return db
      .select()
      .from(vaultChunks)
      .where(eq(vaultChunks.fileId, fileId))
      .orderBy(asc(vaultChunks.chunkIndex));
  },

  async getVaultChunksByProject(projectId: number): Promise<VaultChunk[]> {
    return db
      .select()
      .from(vaultChunks)
      .where(eq(vaultChunks.projectId, projectId))
      .orderBy(asc(vaultChunks.createdAt));
  },

  async deleteVaultChunksByFile(fileId: number): Promise<void> {
    await db.delete(vaultChunks).where(eq(vaultChunks.fileId, fileId));
  },
};
