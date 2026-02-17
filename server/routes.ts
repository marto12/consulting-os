import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import {
  projectDefinitionAgent,
  issuesTreeAgent,
  hypothesisAgent,
  executionAgent,
  summaryAgent,
  presentationAgent,
  getModelUsed,
  getDefaultConfigs,
  DEFAULT_PROMPTS,
  type ProgressCallback,
} from "./agents";

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
      let deliverableContent: any = null;
      let deliverableTitle = step.name;

      if (step.agentKey === "project_definition") {
        const result = await projectDefinitionAgent(project.objective, project.constraints, onProgress);
        deliverableContent = result;
        deliverableTitle = "Project Definition";
        await storage.updateProjectStage(projectId, "definition_draft");
      } else if (step.agentKey === "issues_tree") {
        const result = await issuesTreeAgent(project.objective, project.constraints, onProgress);
        const version = (await storage.getLatestIssueVersion(projectId)) + 1;
        const idMap = new Map<string, number>();
        let remaining = [...result.issues];
        let pass = 0;
        while (remaining.length > 0 && pass < 10) {
          pass++;
          const canInsert = remaining.filter((n) => !n.parentId || idMap.has(n.parentId));
          const cannotInsert = remaining.filter((n) => n.parentId && !idMap.has(n.parentId));
          if (canInsert.length === 0) break;
          const insertedNodes = await storage.insertIssueNodes(
            projectId, version,
            canInsert.map((n) => ({
              parentId: n.parentId ? (idMap.get(n.parentId) || null) : null,
              text: n.text, priority: n.priority,
            }))
          );
          canInsert.forEach((n, i) => { idMap.set(n.id, insertedNodes[i].id); });
          remaining = cannotInsert;
        }
        deliverableContent = result;
        deliverableTitle = "Issues Tree";
        await storage.updateProjectStage(projectId, "issues_draft");
      } else if (step.agentKey === "hypothesis") {
        const issueNodesData = await storage.getIssueNodes(projectId);
        const latestVersion = issueNodesData[0]?.version || 1;
        const latestIssues = issueNodesData.filter((n) => n.version === latestVersion);
        const result = await hypothesisAgent(latestIssues.map((n) => ({ id: n.id, text: n.text, priority: n.priority })), onProgress);
        const version = (await storage.getLatestHypothesisVersion(projectId)) + 1;
        const insertedHyps = await storage.insertHypotheses(
          projectId, version,
          result.hypotheses.map((h) => ({
            issueNodeId: null, statement: h.statement, metric: h.metric, dataSource: h.dataSource, method: h.method,
          }))
        );
        await storage.insertAnalysisPlan(
          projectId,
          result.analysisPlan.map((p, i) => ({
            hypothesisId: insertedHyps[p.hypothesisIndex]?.id || insertedHyps[0]?.id || null,
            method: p.method, parametersJson: p.parameters, requiredDataset: p.requiredDataset,
          }))
        );
        deliverableContent = result;
        deliverableTitle = "Hypotheses & Analysis Plan";
        await storage.updateProjectStage(projectId, "hypotheses_draft");
      } else if (step.agentKey === "execution") {
        const plans = await storage.getAnalysisPlan(projectId);
        const results = await executionAgent(
          plans.map((p) => ({ method: p.method, parameters: p.parametersJson, requiredDataset: p.requiredDataset })),
          onProgress
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
          project.objective, project.constraints,
          latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
          runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson })),
          onProgress
        );
        const version = (await storage.getLatestNarrativeVersion(projectId)) + 1;
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
          project.name, project.objective,
          latestNarr?.summaryText || "No summary available",
          latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
          runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson })),
          onProgress
        );
        const slideVersion = (await storage.getLatestSlideVersion(projectId)) + 1;
        await storage.insertSlides(
          projectId, slideVersion,
          result.slides.map((s) => ({
            slideIndex: s.slideIndex, layout: s.layout, title: s.title,
            subtitle: s.subtitle || undefined, bodyJson: s.bodyJson, notesText: s.notesText || undefined,
          }))
        );
        deliverableContent = result;
        deliverableTitle = "Presentation Deck";
        await storage.updateProjectStage(projectId, "presentation_draft");
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
      const stepId = Number(req.params.stepId);
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "message is required" });

      await storage.insertStepChatMessage({
        stepId,
        role: "user",
        content: message,
        messageType: "message",
      });

      await storage.insertStepChatMessage({
        stepId,
        role: "assistant",
        content: `Acknowledged: "${message}". This step's agent will process your input in the next run.`,
        messageType: "message",
      });

      const messages = await storage.getStepChatMessages(stepId);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

      const modelUsed = getModelUsed();
      const runLog = await storage.insertRunLog(projectId, nextStage, { currentStage: project.stage }, modelUsed);

      try {
        if (nextStage === "definition_draft") {
          const result = await projectDefinitionAgent(project.objective, project.constraints);
          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "issues_draft") {
          const result = await issuesTreeAgent(project.objective, project.constraints);
          const version = (await storage.getLatestIssueVersion(projectId)) + 1;
          const idMap = new Map<string, number>();
          let remaining = [...result.issues];
          let pass = 0;
          while (remaining.length > 0 && pass < 10) {
            pass++;
            const canInsert = remaining.filter((n) => !n.parentId || idMap.has(n.parentId));
            const cannotInsert = remaining.filter((n) => n.parentId && !idMap.has(n.parentId));
            if (canInsert.length === 0) break;
            const insertedNodes = await storage.insertIssueNodes(projectId, version,
              canInsert.map((n) => ({ parentId: n.parentId ? (idMap.get(n.parentId) || null) : null, text: n.text, priority: n.priority })));
            canInsert.forEach((n, i) => { idMap.set(n.id, insertedNodes[i].id); });
            remaining = cannotInsert;
          }
          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "hypotheses_draft") {
          const issueNodesData = await storage.getIssueNodes(projectId);
          const latestVersion = issueNodesData[0]?.version || 1;
          const latestIssues = issueNodesData.filter((n) => n.version === latestVersion);
          const result = await hypothesisAgent(latestIssues.map((n) => ({ id: n.id, text: n.text, priority: n.priority })));
          const version = (await storage.getLatestHypothesisVersion(projectId)) + 1;
          const insertedHyps = await storage.insertHypotheses(projectId, version,
            result.hypotheses.map((h) => ({ issueNodeId: null, statement: h.statement, metric: h.metric, dataSource: h.dataSource, method: h.method })));
          await storage.insertAnalysisPlan(projectId,
            result.analysisPlan.map((p, i) => ({
              hypothesisId: insertedHyps[p.hypothesisIndex]?.id || insertedHyps[0]?.id || null,
              method: p.method, parametersJson: p.parameters, requiredDataset: p.requiredDataset,
            })));
          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "execution_done") {
          const plans = await storage.getAnalysisPlan(projectId);
          const results = await executionAgent(plans.map((p) => ({ method: p.method, parameters: p.parametersJson, requiredDataset: p.requiredDataset })));
          for (const r of results) { await storage.insertModelRun(projectId, r.toolName, r.inputs, r.outputs); }
          await storage.updateRunLog(runLog.id, results, "success");
        } else if (nextStage === "summary_draft") {
          const hyps = await storage.getHypotheses(projectId);
          const runs = await storage.getModelRuns(projectId);
          const latestVersion = hyps[0]?.version || 1;
          const latestHyps = hyps.filter((h) => h.version === latestVersion);
          const result = await summaryAgent(project.objective, project.constraints,
            latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
            runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson })));
          const version = (await storage.getLatestNarrativeVersion(projectId)) + 1;
          await storage.insertNarrative(projectId, version, result.summaryText);
          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "presentation_draft") {
          const narrs = await storage.getNarratives(projectId);
          const hyps = await storage.getHypotheses(projectId);
          const runs = await storage.getModelRuns(projectId);
          const latestVersion = hyps[0]?.version || 1;
          const latestHyps = hyps.filter((h) => h.version === latestVersion);
          const latestNarr = narrs[0];
          const result = await presentationAgent(project.name, project.objective,
            latestNarr?.summaryText || "No summary available",
            latestHyps.map((h) => ({ statement: h.statement, metric: h.metric })),
            runs.map((r) => ({ inputsJson: r.inputsJson, outputsJson: r.outputsJson })));
          const slideVersion = (await storage.getLatestSlideVersion(projectId)) + 1;
          await storage.insertSlides(projectId, slideVersion,
            result.slides.map((s) => ({ slideIndex: s.slideIndex, layout: s.layout, title: s.title, subtitle: s.subtitle || undefined, bodyJson: s.bodyJson, notesText: s.notesText || undefined })));
          await storage.updateRunLog(runLog.id, result, "success");
        }
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
      const { name, description } = req.body;
      const template = await storage.updateWorkflowTemplate(Number(req.params.id), { name, description });
      const steps = await storage.getWorkflowTemplateSteps(template.id);
      res.json({ ...template, steps });
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
      const { name, description, owner, accessLevel, schemaJson, metadata } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const ds = await storage.createDataset({ name, description, owner, accessLevel, schemaJson, metadata });
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

  registerChatRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
