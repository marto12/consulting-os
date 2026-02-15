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
  DEFAULT_PROMPTS,
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

  const AGENT_METADATA: Record<string, any> = {
    issues_tree: {
      key: "issues_tree",
      label: "Issues Tree",
      role: "Generator",
      roleColor: "#3B82F6",
      roleBg: "#EFF6FF",
      stage: "issues_draft",
      description: "Breaks down the project objective into a MECE (Mutually Exclusive, Collectively Exhaustive) issues tree with 3+ levels of depth. This is the foundational decomposition step of the consulting workflow.",
      inputs: [
        { name: "objective", type: "string", description: "The project's stated objective or governing question" },
        { name: "constraints", type: "string", description: "Known constraints, boundaries, or limitations for the analysis" },
      ],
      outputs: [
        { name: "issues", type: "IssueNode[]", description: "Array of 15-25 issue nodes forming a hierarchical tree with id, parentId, text, and priority (high/medium/low)" },
        { name: "criticLog", type: "CriticResult[]", description: "Log of MECE Critic review iterations, including scores and revision instructions" },
      ],
      outputSchema: '{\n  "issues": [\n    { "id": "1", "parentId": null, "text": "Root issue", "priority": "high" },\n    { "id": "2", "parentId": "1", "text": "Sub-issue", "priority": "medium" }\n  ]\n}',
      tools: [],
      triggerStage: "created",
      producesStage: "issues_draft",
    },
    mece_critic: {
      key: "mece_critic",
      label: "MECE Critic",
      role: "Quality Gate",
      roleColor: "#8B5CF6",
      roleBg: "#F5F3FF",
      stage: "issues_draft",
      description: "Quality gate that audits the issues tree for MECE compliance. Scores across 5 criteria (overlap, coverage, mixed logics, branch balance, label quality) on a 1-5 scale. If score < 4, sends revision instructions back to the Issues Tree agent. Runs up to 2 revision loops.",
      inputs: [
        { name: "issues", type: "IssueNode[]", description: "The generated issues tree to evaluate" },
        { name: "objective", type: "string", description: "The original project objective for context" },
      ],
      outputs: [
        { name: "verdict", type: "'approved' | 'revise'", description: "Whether the tree passes quality review or needs revision" },
        { name: "scores", type: "CriticScores", description: "Detailed scores (1-5) for overlap, coverage, mixed logics, branch balance, and label quality" },
        { name: "overallScore", type: "number", description: "Aggregate score from 1-5. Tree is approved if >= 4" },
        { name: "revisionInstructions", type: "string", description: "Specific instructions for what the Issues Tree agent should fix" },
      ],
      outputSchema: '{\n  "verdict": "approved" | "revise",\n  "scores": {\n    "overlap": { "score": 4, "details": "..." },\n    "coverage": { "score": 5, "details": "..." },\n    "mixedLogics": { "score": 4, "details": "..." },\n    "branchBalance": { "score": 3, "details": "..." },\n    "labelQuality": { "score": 5, "details": "..." }\n  },\n  "overallScore": 4,\n  "revisionInstructions": ""\n}',
      tools: [],
      triggerStage: "issues_draft",
      producesStage: "issues_approved",
    },
    hypothesis: {
      key: "hypothesis",
      label: "Hypothesis",
      role: "Analyst",
      roleColor: "#0891B2",
      roleBg: "#ECFEFF",
      stage: "hypotheses_draft",
      description: "Generates testable hypotheses linked to the top issues from the tree, and creates a structured analysis plan. Each hypothesis includes a statement, metric, data source, and method. The analysis plan defines parameters for the scenario calculator tool.",
      inputs: [
        { name: "issues", type: "IssueNode[]", description: "The approved issues tree nodes, with id, text, and priority" },
      ],
      outputs: [
        { name: "hypotheses", type: "HypothesisOutput[]", description: "2-4 testable hypotheses, each linked to an issue node with statement, metric, data source, and method" },
        { name: "analysisPlan", type: "AnalysisPlanOutput[]", description: "Corresponding execution plans with method, financial parameters, and required dataset" },
      ],
      outputSchema: '{\n  "hypotheses": [\n    {\n      "issueNodeId": "1",\n      "statement": "If we address X, we achieve Y",\n      "metric": "Revenue growth %",\n      "dataSource": "Industry benchmarks",\n      "method": "scenario_analysis"\n    }\n  ],\n  "analysisPlan": [\n    {\n      "hypothesisIndex": 0,\n      "method": "run_scenario_tool",\n      "parameters": {\n        "baselineRevenue": 1000000,\n        "growthRate": 0.1,\n        "costReduction": 0.05,\n        "timeHorizonYears": 5,\n        "volatility": 0.15\n      },\n      "requiredDataset": "Financial projections"\n    }\n  ]\n}',
      tools: [],
      triggerStage: "issues_approved",
      producesStage: "hypotheses_draft",
    },
    execution: {
      key: "execution",
      label: "Execution",
      role: "Tool Caller",
      roleColor: "#059669",
      roleBg: "#ECFDF5",
      stage: "execution_done",
      description: "Executes the analysis plan by calling the Scenario Calculator tool for each hypothesis. Performs financial scenario analysis with baseline, optimistic, and pessimistic projections, calculates NPV, expected value, and risk-adjusted returns. This is the only agent that uses real tool calling.",
      inputs: [
        { name: "analysisPlan", type: "AnalysisPlanOutput[]", description: "Array of analysis plans from the Hypothesis agent, each specifying method and financial parameters" },
      ],
      outputs: [
        { name: "results", type: "ToolCallResult[]", description: "Array of tool call results with tool name, input parameters, and full scenario output including baseline/optimistic/pessimistic projections and NPV summary" },
      ],
      outputSchema: '[\n  {\n    "toolName": "run_scenario_tool",\n    "inputs": {\n      "baselineRevenue": 1000000,\n      "growthRate": 0.1,\n      "costReduction": 0.05,\n      "timeHorizonYears": 5,\n      "volatility": 0.15\n    },\n    "outputs": {\n      "baseline": [{ "year": 1, "revenue": ..., "costs": ..., "profit": ... }],\n      "optimistic": [...],\n      "pessimistic": [...],\n      "summary": {\n        "baselineNPV": ...,\n        "optimisticNPV": ...,\n        "pessimisticNPV": ...,\n        "expectedValue": ...,\n        "riskAdjustedReturn": ...\n      }\n    }\n  }\n]',
      tools: [
        {
          name: "run_scenario_tool",
          description: "Financial scenario calculator that projects revenue, costs, and profit across baseline, optimistic, and pessimistic scenarios over a configurable time horizon",
          parameters: {
            baselineRevenue: "number — Starting annual revenue",
            growthRate: "number (0-1) — Annual growth rate",
            costReduction: "number (0-1) — Expected cost reduction factor",
            timeHorizonYears: "integer — Projection period in years",
            volatility: "number (0-1) — Market volatility factor for scenario spread",
          },
        },
      ],
      triggerStage: "hypotheses_approved",
      producesStage: "execution_done",
    },
    summary: {
      key: "summary",
      label: "Summary",
      role: "Synthesizer",
      roleColor: "#D97706",
      roleBg: "#FFFBEB",
      stage: "summary_draft",
      description: "Synthesizes all analysis results into a structured executive summary with Key Findings, Recommendations, and Next Steps. Uses markdown formatting for rich text rendering. The output reads like a senior partner's memo to a client.",
      inputs: [
        { name: "objective", type: "string", description: "The original project objective" },
        { name: "constraints", type: "string", description: "Project constraints" },
        { name: "hypotheses", type: "Hypothesis[]", description: "The tested hypotheses with statement and metric" },
        { name: "modelRuns", type: "ModelRun[]", description: "Execution results with input/output JSON from scenario analysis" },
      ],
      outputs: [
        { name: "summaryText", type: "string (markdown)", description: "Full executive summary in markdown format with headings, bullet points, and numbered lists" },
      ],
      outputSchema: '"# Executive Summary\\n\\n## Key Findings\\n- Finding 1: ...\\n- Finding 2: ...\\n\\n## Recommendation\\nBased on...\\n\\n## Next Steps\\n1. Step one\\n2. Step two"',
      tools: [],
      triggerStage: "execution_approved",
      producesStage: "summary_draft",
    },
    presentation: {
      key: "presentation",
      label: "Presentation",
      role: "Designer",
      roleColor: "#E11D48",
      roleBg: "#FFF1F2",
      stage: "presentation_draft",
      description: "Generates a professional 16:9 slide deck from the analysis results. Produces 6-10 slides using 5 layout types: title_slide, section_header, title_body, two_column, and metrics. Each slide includes speaker notes. The deck follows a standard consulting structure: Title, Executive Summary, Key Findings, Analysis Results, Recommendations, Next Steps.",
      inputs: [
        { name: "projectName", type: "string", description: "Project name for the title slide" },
        { name: "objective", type: "string", description: "Project objective" },
        { name: "summaryText", type: "string", description: "The executive summary text" },
        { name: "hypotheses", type: "Hypothesis[]", description: "Tested hypotheses" },
        { name: "modelRuns", type: "ModelRun[]", description: "Scenario analysis results" },
      ],
      outputs: [
        { name: "slides", type: "SlideOutput[]", description: "Array of 6-10 slide objects, each with slideIndex, layout, title, subtitle, bodyJson, and notesText" },
      ],
      outputSchema: '{\n  "slides": [\n    {\n      "slideIndex": 0,\n      "layout": "title_slide",\n      "title": "Project Name",\n      "subtitle": "Strategic Analysis",\n      "bodyJson": {},\n      "notesText": "Speaker notes"\n    }\n  ]\n}',
      tools: [],
      triggerStage: "summary_approved",
      producesStage: "presentation_draft",
    },
  };

  app.get("/api/agents", async (_req: Request, res: Response) => {
    try {
      const configs = await storage.getAllAgentConfigs();
      const agents = Object.values(AGENT_METADATA).map((meta: any) => {
        const saved = configs.find((c) => c.agentType === meta.key);
        return {
          ...meta,
          systemPrompt: saved?.systemPrompt || DEFAULT_PROMPTS[meta.key] || "",
          model: saved?.model || "gpt-5-nano",
          maxTokens: saved?.maxTokens || 8192,
        };
      });
      res.json(agents);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/agents/:key", async (req: Request, res: Response) => {
    try {
      const key = req.params.key as string;
      const meta = (AGENT_METADATA as any)[key];
      if (!meta) return res.status(404).json({ error: "Agent not found" });
      const saved = await storage.getAgentConfig(key);
      res.json({
        ...meta,
        systemPrompt: saved?.systemPrompt || (DEFAULT_PROMPTS as any)[key] || "",
        model: saved?.model || "gpt-5-nano",
        maxTokens: saved?.maxTokens || 8192,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pipelines", async (_req: Request, res: Response) => {
    try {
      const pipelines = await storage.listPipelines();
      res.json(pipelines);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pipelines", async (req: Request, res: Response) => {
    try {
      const { name, agentsJson } = req.body;
      if (!name || !agentsJson) {
        return res.status(400).json({ error: "name and agentsJson are required" });
      }
      const pipeline = await storage.createPipeline({ name, agentsJson });
      res.status(201).json(pipeline);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pipelines/:id", async (req: Request, res: Response) => {
    try {
      const pipeline = await storage.getPipeline(Number(req.params.id));
      if (!pipeline) return res.status(404).json({ error: "Not found" });
      res.json(pipeline);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/pipelines/:id", async (req: Request, res: Response) => {
    try {
      const { name, agentsJson } = req.body;
      const pipeline = await storage.updatePipeline(Number(req.params.id), {
        name,
        agentsJson,
      });
      res.json(pipeline);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/pipelines/:id", async (req: Request, res: Response) => {
    try {
      await storage.deletePipeline(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
