import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import {
  issuesTreeAgent,
  hypothesisAgent,
  executionAgent,
  summaryAgent,
  presentationAgent,
  getModelUsed,
  getDefaultConfigs,
} from "./agents";

const STAGE_ORDER = [
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
  "complete",
];

const PENDING_STAGES = [
  "issues_draft",
  "hypotheses_draft",
  "execution_done",
  "summary_draft",
  "presentation_draft",
];

const APPROVE_MAP: Record<string, string> = {
  issues_draft: "issues_approved",
  hypotheses_draft: "hypotheses_approved",
  execution_done: "execution_approved",
  summary_draft: "summary_approved",
  presentation_draft: "complete",
};

const RUN_NEXT_MAP: Record<string, string> = {
  created: "issues_draft",
  issues_approved: "hypotheses_draft",
  hypotheses_approved: "execution_done",
  execution_approved: "summary_draft",
  summary_approved: "presentation_draft",
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const { name, objective, constraints } = req.body;
      if (!name || !objective || !constraints) {
        return res
          .status(400)
          .json({ error: "name, objective, and constraints are required" });
      }
      const project = await storage.createProject({ name, objective, constraints });
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

  app.post("/api/projects/:id/run-next", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const nextStage = RUN_NEXT_MAP[project.stage];
      if (!nextStage) {
        return res.status(400).json({
          error: `Cannot run next stage from "${project.stage}". Current stage must be approved first or workflow is complete.`,
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
          const version = (await storage.getLatestIssueVersion(projectId)) + 1;

          const idMap = new Map<string, number>();

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
                parentId: n.parentId ? (idMap.get(n.parentId) || null) : null,
                text: n.text,
                priority: n.priority,
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
              priority: n.priority,
            }))
          );

          const version = (await storage.getLatestHypothesisVersion(projectId)) + 1;

          const insertedHyps = await storage.insertHypotheses(
            projectId,
            version,
            result.hypotheses.map((h) => ({
              issueNodeId: null,
              statement: h.statement,
              metric: h.metric,
              dataSource: h.dataSource,
              method: h.method,
            }))
          );

          await storage.insertAnalysisPlan(
            projectId,
            result.analysisPlan.map((p, i) => ({
              hypothesisId: insertedHyps[p.hypothesisIndex]?.id || insertedHyps[0]?.id || null,
              method: p.method,
              parametersJson: p.parameters,
              requiredDataset: p.requiredDataset,
            }))
          );

          await storage.updateRunLog(runLog.id, result, "success");
        } else if (nextStage === "execution_done") {
          const plans = await storage.getAnalysisPlan(projectId);
          const results = await executionAgent(
            plans.map((p) => ({
              method: p.method,
              parameters: p.parametersJson,
              requiredDataset: p.requiredDataset,
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
              metric: h.metric,
            })),
            runs.map((r) => ({
              inputsJson: r.inputsJson,
              outputsJson: r.outputsJson,
            }))
          );

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

          const result = await presentationAgent(
            project.name,
            project.objective,
            latestNarr?.summaryText || "No summary available",
            latestHyps.map((h) => ({
              statement: h.statement,
              metric: h.metric,
            })),
            runs.map((r) => ({
              inputsJson: r.inputsJson,
              outputsJson: r.outputsJson,
            }))
          );

          const version = (await storage.getLatestSlideVersion(projectId)) + 1;
          await storage.insertSlides(
            projectId,
            version,
            result.slides.map((s) => ({
              slideIndex: s.slideIndex,
              layout: s.layout,
              title: s.title,
              subtitle: s.subtitle || undefined,
              bodyJson: s.bodyJson,
              notesText: s.notesText || undefined,
            }))
          );

          await storage.updateRunLog(runLog.id, result, "success");
        }

        const updated = await storage.updateProjectStage(projectId, nextStage);
        res.json(updated);
      } catch (agentErr: any) {
        await storage.updateRunLog(
          runLog.id,
          null,
          "failed",
          agentErr.message
        );
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
        return res.status(400).json({
          error: `Cannot approve stage "${project.stage}". No pending approval.`,
        });
      }

      const updated = await storage.updateProjectStage(projectId, nextStage);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const REDO_MAP: Record<string, string> = {
    issues_draft: "created",
    issues_approved: "created",
    hypotheses_draft: "issues_approved",
    hypotheses_approved: "issues_approved",
    execution_done: "hypotheses_approved",
    execution_approved: "hypotheses_approved",
    summary_draft: "execution_approved",
    summary_approved: "execution_approved",
    presentation_draft: "summary_approved",
    complete: "summary_approved",
  };

  app.post("/api/projects/:id/redo", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const { step } = req.body;
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const stageMap: Record<string, string> = {
        issues: "created",
        hypotheses: "issues_approved",
        execution: "hypotheses_approved",
        summary: "execution_approved",
        presentation: "summary_approved",
      };

      const targetStage = stageMap[step];
      if (!targetStage) {
        return res.status(400).json({ error: `Invalid step "${step}"` });
      }

      const currentIdx = STAGE_ORDER.indexOf(project.stage);
      const stepDraftStages: Record<string, string> = {
        issues: "issues_draft",
        hypotheses: "hypotheses_draft",
        execution: "execution_done",
        summary: "summary_draft",
        presentation: "presentation_draft",
      };
      const draftIdx = STAGE_ORDER.indexOf(stepDraftStages[step]);

      if (currentIdx < draftIdx) {
        return res.status(400).json({
          error: `Cannot redo "${step}" — that step hasn't been run yet.`,
        });
      }

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
        storage.getIssueNodes(projectId),
        storage.getHypotheses(projectId),
        storage.getAnalysisPlan(projectId),
        storage.getModelRuns(projectId),
        storage.getNarratives(projectId),
        storage.getSlides(projectId),
      ]);
      res.json({
        issueNodes: issues,
        hypotheses: hyps,
        analysisPlan: plans,
        modelRuns: runs,
        narratives: narrs,
        slides: slds,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/logs", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const logs = await storage.getRunLogs(projectId);
      res.json(logs);
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
        maxTokens: maxTokens || 8192,
      });
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
