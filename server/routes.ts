import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import { storage } from "./storage";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import {
  getModelUsed,
  getDefaultConfigs,
  DEFAULT_PROMPTS,
  type ProgressCallback,
} from "./agents";
import { runWorkflowStep, refineWithLangGraph, refineWithLangGraphStreaming } from "./agents/workflow-graph";
import { reviewDocument, actionComment, executiveReviewDocument, spotFactCheckCandidates, runFactCheck, narrativeReviewDocument } from "./agents/document-agents";
import { processVaultFile, retrieveRelevantContext, formatRAGContext } from "./vault-rag";
import { generateChartSpec } from "./agents/chart-agent";
import { db } from "./db";
import { datasetRows } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

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
];

const DEFAULT_WORKFLOW_STEPS = [
  { stepOrder: 1, name: "Project Definition", agentKey: "project_definition" },
  { stepOrder: 2, name: "Issues Tree", agentKey: "issues_tree" },
  { stepOrder: 3, name: "Hypotheses & Analysis Plan", agentKey: "hypothesis" },
  { stepOrder: 4, name: "Execution", agentKey: "execution" },
  { stepOrder: 5, name: "Executive Summary", agentKey: "summary" },
  { stepOrder: 6, name: "Presentation", agentKey: "presentation" },
];

async function ensureDefaults() {
  for (const a of DEFAULT_AGENTS) {
    await storage.upsertAgent(a);
  }

  const templates = await storage.listWorkflowTemplates();
  if (templates.length === 0) {
    const template = await storage.createWorkflowTemplate({
      name: "Consulting Analysis",
      description: "Standard consulting workflow: Project Definition -> Issues Tree -> Hypotheses -> Execution -> Summary -> Presentation",
    });
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
}

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureDefaults();

  app.post("/api/projects", async (req: Request, res: Response) => {
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
        workflowTemplateId: templateId || null,
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
            configJson: s.configJson,
          })),
        });
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
      const result = await runWorkflowStep(projectId, step.agentKey, onProgress);
      const { deliverableContent, deliverableTitle } = result;

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

      await storage.updateWorkflowInstanceStep(stepId, {
        status: "completed",
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
            description: s.description,
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
      const { name, description, steps } = req.body;
      const template = await storage.updateWorkflowTemplate(Number(req.params.id), { name, description });
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
      const { name, description, owner, accessLevel, sourceType, sourceUrl, schemaJson, metadata } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const ds = await storage.createDataset({ name, description, owner, accessLevel, sourceType, sourceUrl, schemaJson, metadata });
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
      const { name, description, sourceType, sourceUrl, schemaJson, metadata, rowCount } = req.body;
      const ds = await storage.updateDataset(id, { name, description, sourceType, sourceUrl, schemaJson, metadata, rowCount });
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
      const ds = await storage.updateDataset(id, {
        sourceType: "csv",
        schemaJson,
        rowCount: rows.length,
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

  app.post("/api/data/models", async (req: Request, res: Response) => {
    try {
      const { name, description, inputSchema, outputSchema, apiConfig } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const m = await storage.createModel({ name, description, inputSchema, outputSchema, apiConfig });
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
      const { systemPrompt, model, maxTokens } = req.body;
      if (!systemPrompt) return res.status(400).json({ error: "systemPrompt is required" });
      const config = await storage.upsertAgentConfig({
        agentType, systemPrompt, model: model || "gpt-5-nano", maxTokens: maxTokens || 8192,
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

  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      res.json(await storage.listDocuments(projectId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/documents", async (req: Request, res: Response) => {
    try {
      const { projectId, title, content, contentJson } = req.body;
      res.status(201).json(await storage.createDocument({ projectId, title, content, contentJson }));
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
      const { projectId, datasetId, name, description, chartType, chartConfig } = req.body;
      if (!name || !chartType) return res.status(400).json({ error: "name and chartType are required" });
      const chart = await storage.createChart({
        projectId: projectId || undefined,
        datasetId: datasetId || undefined,
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
      if (!chart.datasetId) return res.json({ chart, rows: [] });

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
      const { datasetId, prompt, projectId } = req.body;
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
      const projectCharts = await storage.getChartsByProject(Number(req.params.id));
      res.json(projectCharts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Presentations ──
  app.get("/api/presentations", async (_req: Request, res: Response) => {
    try {
      res.json(await storage.listPresentations());
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
        projectId: pres.projectId || 0,
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

      const { documentId, documentContent } = req.body;
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
          projectId: pres.projectId || 0,
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

  registerChatRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
