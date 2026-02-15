import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import {
  issuesTreeAgent,
  hypothesisAgent,
  executionAgent,
  summaryAgent,
  getModelUsed,
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
  "complete",
];

const PENDING_STAGES = [
  "issues_draft",
  "hypotheses_draft",
  "execution_done",
  "summary_draft",
];

const APPROVE_MAP: Record<string, string> = {
  issues_draft: "issues_approved",
  hypotheses_draft: "hypotheses_approved",
  execution_done: "execution_approved",
  summary_draft: "complete",
};

const RUN_NEXT_MAP: Record<string, string> = {
  created: "issues_draft",
  issues_approved: "hypotheses_draft",
  hypotheses_approved: "execution_done",
  execution_approved: "summary_draft",
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
          const rootNodes = result.issues.filter((n) => !n.parentId);
          const childNodes = result.issues.filter((n) => !!n.parentId);

          const insertedRoots = await storage.insertIssueNodes(
            projectId,
            version,
            rootNodes.map((n) => ({
              parentId: null,
              text: n.text,
              priority: n.priority,
            }))
          );
          rootNodes.forEach((n, i) => {
            idMap.set(n.id, insertedRoots[i].id);
          });

          if (childNodes.length > 0) {
            await storage.insertIssueNodes(
              projectId,
              version,
              childNodes.map((n) => ({
                parentId: n.parentId ? (idMap.get(n.parentId) || null) : null,
                text: n.text,
                priority: n.priority,
              }))
            );
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

  app.get("/api/projects/:id/artifacts", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.id);
      const [issues, hyps, plans, runs, narrs] = await Promise.all([
        storage.getIssueNodes(projectId),
        storage.getHypotheses(projectId),
        storage.getAnalysisPlan(projectId),
        storage.getModelRuns(projectId),
        storage.getNarratives(projectId),
      ]);
      res.json({
        issueNodes: issues,
        hypotheses: hyps,
        analysisPlan: plans,
        modelRuns: runs,
        narratives: narrs,
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

  const httpServer = createServer(app);
  return httpServer;
}
