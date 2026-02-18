import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { storage } from "../storage";
import { runScenarioTool, type ScenarioInput, type ScenarioOutput } from "./scenario-tool";
import { DEFAULT_PROMPTS, type ProgressCallback } from "./index";

function hasApiKey(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  );
}

const DEFAULT_MODEL = "gpt-5-nano";

function createLLM(model?: string, maxTokens?: number): ChatOpenAI | null {
  if (!hasApiKey()) return null;
  return new ChatOpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    },
    modelName: model || DEFAULT_MODEL,
    maxTokens: maxTokens || 8192,
  });
}

async function getAgentConfig(agentType: string) {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config;
  } catch {}
  return {
    systemPrompt: DEFAULT_PROMPTS[agentType] || "",
    model: DEFAULT_MODEL,
    maxTokens: 8192,
  };
}

function repairJson(text: string): string {
  let s = text.trim();
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

function extractJson(text: string): any {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {
      try { return JSON.parse(repairJson(match[1].trim())); } catch {}
    }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {
      try { return JSON.parse(repairJson(jsonMatch[0])); } catch {}
    }
  }
  const partialJson = text.match(/\{[\s\S]*/);
  if (partialJson) {
    try { return JSON.parse(repairJson(partialJson[0])); } catch {}
  }
  return JSON.parse(text);
}

async function callLLMWithLangChain(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  maxTokens?: number,
  retries = 1
): Promise<string> {
  const llm = createLLM(model, maxTokens);
  if (!llm) return "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const prompt = attempt > 0
      ? `${userPrompt}\n\nIMPORTANT: Your previous response was truncated. Please produce a SHORTER, more concise response that fits within the token limit. Use fewer nodes, shorter descriptions, and minimal whitespace in JSON output.`
      : userPrompt;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt),
    ]);

    const content = typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

    if (response.response_metadata?.finish_reason === "length" && attempt < retries) {
      continue;
    }

    return content;
  }

  return "";
}

export const ConsultingState = Annotation.Root({
  projectId: Annotation<number>,
  objective: Annotation<string>,
  constraints: Annotation<string>,
  targetStep: Annotation<string>,
  onProgress: Annotation<ProgressCallback>,

  projectDefinitionResult: Annotation<any>({ reducer: (_, b) => b, default: () => null }),
  issues: Annotation<any[]>({ reducer: (_, b) => b, default: () => [] }),
  criticLog: Annotation<any[]>({ reducer: (_, b) => b, default: () => [] }),
  criticIteration: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  hypothesesResult: Annotation<any>({ reducer: (_, b) => b, default: () => null }),
  executionResults: Annotation<any[]>({ reducer: (_, b) => b, default: () => [] }),
  summaryResult: Annotation<any>({ reducer: (_, b) => b, default: () => null }),
  presentationResult: Annotation<any>({ reducer: (_, b) => b, default: () => null }),

  deliverableContent: Annotation<any>({ reducer: (_, b) => b, default: () => null }),
  deliverableTitle: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  error: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});

type ConsultingStateType = typeof ConsultingState.State;

function formatTreeForCritic(issues: any[], objective: string): string {
  function renderBranch(parentId: string | null, indent: number): string {
    const children = issues.filter((n: any) => n.parentId === parentId);
    return children
      .map((c: any) => {
        const prefix = "  ".repeat(indent) + "- ";
        const line = `${prefix}[${c.priority.toUpperCase()}] ${c.text}`;
        const sub = renderBranch(c.id, indent + 1);
        return sub ? `${line}\n${sub}` : line;
      })
      .join("\n");
  }
  const treeText = renderBranch(null, 0);
  return `Governing Question / Objective: ${objective}\n\nIssues Tree (${issues.length} nodes):\n${treeText}`;
}

async function projectDefinitionNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
  const progress = state.onProgress;
  progress("Starting Project Definition agent...", "status");

  if (!hasApiKey()) {
    progress("Running in mock mode (no API key configured)", "status");
    const result = {
      decision_statement: `Determine the optimal strategic approach to: ${state.objective}`,
      governing_question: `Should we pursue the proposed strategy in order to achieve ${state.objective}, given ${state.constraints || "current resource constraints"}, by the next 12-month planning cycle?`,
      decision_owner: "Executive Leadership / Project Sponsor",
      decision_deadline: "Within 4-6 weeks of project initiation",
      success_metrics: [
        { metric_name: "Revenue Impact", definition: "Net incremental revenue attributable to the initiative", threshold_or_target: ">$1M within 12 months" },
        { metric_name: "ROI", definition: "Return on investment over the project period", threshold_or_target: ">15% annualized" },
        { metric_name: "Implementation Feasibility", definition: "Assessed probability of successful execution", threshold_or_target: ">70% confidence" },
      ],
      alternatives: [
        "Pursue full-scale implementation immediately",
        "Phased rollout starting with pilot program",
        "Partner or acquire capability externally",
        "Do nothing — maintain current trajectory",
      ],
      constraints: {
        budget: state.constraints?.includes("budget") ? state.constraints : "To be confirmed; assume moderate investment envelope",
        regulatory: "Standard industry compliance requirements apply",
        time: state.constraints?.includes("timeline") ? state.constraints : "Decision needed within current planning cycle",
        political: "Stakeholder alignment required across key business units",
        operational: "Must be achievable with existing team capacity plus reasonable augmentation",
      },
      assumptions: [
        "Current market conditions remain broadly stable over the analysis period",
        "Organization has willingness to allocate resources if the case is compelling",
        "Data sufficient for directional analysis is available or obtainable",
        "No major regulatory changes expected in the near term",
      ],
      initial_hypothesis: `The proposed initiative is likely to deliver positive returns, but the magnitude depends on execution speed and market timing. A phased approach may reduce risk while preserving upside.`,
      key_uncertainties: [
        "Actual market size and addressable share",
        "Competitive response timeline and intensity",
        "Internal execution capability and speed",
        "Customer adoption rate assumptions",
      ],
      information_gaps: [
        "Detailed competitive landscape data",
        "Customer willingness-to-pay research",
        "Internal cost structure for new capabilities",
        "Regulatory timeline for any required approvals",
      ],
    };
    progress("Analysis complete. Generated project definition with " + result.success_metrics.length + " success metrics.", "status");
    return { projectDefinitionResult: result, deliverableContent: result, deliverableTitle: "Project Definition" };
  }

  const config = await getAgentConfig("project_definition");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const userPrompt = `Project Objective: ${state.objective}\n\nConstraints & Context: ${state.constraints}`;
  const raw = await callLLMWithLangChain(config.systemPrompt, userPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  progress("Analysis complete. Generated project definition with " + (parsed.success_metrics?.length || 0) + " success metrics.", "status");
  return { projectDefinitionResult: parsed, deliverableContent: parsed, deliverableTitle: "Project Definition" };
}

async function issuesTreeNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
  const progress = state.onProgress;
  progress("Starting Issues Tree agent...", "status");

  if (!hasApiKey()) {
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
      { id: "21", parentId: "19", text: "Data Pipeline Setup", priority: "medium" },
    ];
    progress("Analysis complete. Generated " + mockIssues.length + " issue nodes.", "status");
    return { issues: mockIssues, criticIteration: 0 };
  }

  const config = await getAgentConfig("issues_tree");
  const baseUserPrompt = `Objective: ${state.objective}\nConstraints: ${state.constraints}`;

  if (state.criticIteration > 0 && state.criticLog.length > 0) {
    const lastCritic = state.criticLog[state.criticLog.length - 1]?.critic;
    if (lastCritic) {
      progress("Revising tree based on critic feedback...", "critic");
      const revisionPrompt = `${baseUserPrompt}\n\n---\nPREVIOUS TREE (needs revision):\n${formatTreeForCritic(state.issues, state.objective)}\n\n---\nMECE CRITIC FEEDBACK (iteration ${state.criticIteration}):\nOverall Score: ${lastCritic.overallScore}/5\nOverlap: ${lastCritic.scores.overlap.score}/5 — ${lastCritic.scores.overlap.details}\nCoverage: ${lastCritic.scores.coverage.score}/5 — ${lastCritic.scores.coverage.details}\nMixed Logics: ${lastCritic.scores.mixedLogics.score}/5 — ${lastCritic.scores.mixedLogics.details}\nBranch Balance: ${lastCritic.scores.branchBalance.score}/5 — ${lastCritic.scores.branchBalance.details}\nLabel Quality: ${lastCritic.scores.labelQuality.score}/5 — ${lastCritic.scores.labelQuality.details}\n\nREVISION INSTRUCTIONS:\n${lastCritic.revisionInstructions}\n\nPlease produce a REVISED issues tree that addresses ALL the critic's feedback. Return the full tree in the same JSON format.`;
      const raw = await callLLMWithLangChain(config.systemPrompt, revisionPrompt, config.model, config.maxTokens);
      const parsed = extractJson(raw);
      return { issues: parsed.issues || parsed };
    }
  }

  progress(`Calling LLM with model ${config.model}...`, "llm");
  const raw = await callLLMWithLangChain(config.systemPrompt, baseUserPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  return { issues: parsed.issues || parsed, criticIteration: 0 };
}

const MAX_REVISIONS = 2;

async function meceCriticNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
  const progress = state.onProgress;
  const iteration = state.criticIteration;
  progress(`Running MECE Critic evaluation (iteration ${iteration + 1})...`, "critic");

  if (!hasApiKey()) {
    const mockCritic = {
      verdict: "approved" as const,
      scores: {
        overlap: { score: 5, details: "No overlap between sibling branches" },
        coverage: { score: 4, details: "Key dimensions covered: market, revenue, operations" },
        mixedLogics: { score: 4, details: "Consistent strategic decomposition at each level" },
        branchBalance: { score: 4, details: "Balanced across 3 root branches (7/7/7 nodes)" },
        labelQuality: { score: 5, details: "All labels are specific and descriptive" },
      },
      overallScore: 4,
      revisionInstructions: "",
    };
    progress(`Critic verdict: ${mockCritic.verdict}, score: ${mockCritic.overallScore}/5`, "critic");
    return {
      criticLog: [...state.criticLog, { iteration, critic: mockCritic }],
      criticIteration: iteration + 1,
    };
  }

  const config = await getAgentConfig("mece_critic");
  const treeDescription = formatTreeForCritic(state.issues, state.objective);
  const criticRaw = await callLLMWithLangChain(config.systemPrompt, treeDescription, config.model, config.maxTokens);

  let criticResult: any;
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
        labelQuality: { score: 3, details: "Could not parse critic response" },
      },
      overallScore: 3,
      revisionInstructions: "",
    };
  }

  progress(`Critic verdict: ${criticResult.verdict}, score: ${criticResult.overallScore}/5`, "critic");

  return {
    criticLog: [...state.criticLog, { iteration, critic: criticResult }],
    criticIteration: iteration + 1,
  };
}

function meceCriticRouter(state: ConsultingStateType): string {
  const lastCritic = state.criticLog[state.criticLog.length - 1]?.critic;
  if (!lastCritic) return "finalize_issues";
  if (lastCritic.verdict === "approved" || state.criticIteration > MAX_REVISIONS) {
    return "finalize_issues";
  }
  return "issues_tree";
}

async function finalizeIssuesNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
  const progress = state.onProgress;
  progress("Analysis complete. Generated " + state.issues.length + " issue nodes.", "status");
  return {
    deliverableContent: { issues: state.issues, criticLog: state.criticLog },
    deliverableTitle: "Issues Tree",
  };
}

async function hypothesisNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
  const progress = state.onProgress;
  progress("Starting Hypothesis agent...", "status");

  const issueNodesData = await storage.getIssueNodes(state.projectId);
  const latestVersion = issueNodesData[0]?.version || 1;
  const latestIssues = issueNodesData.filter((n) => n.version === latestVersion);

  if (!hasApiKey()) {
    progress("Running in mock mode (no API key configured)", "status");
    const topIssues = latestIssues.slice(0, 3);
    const hyps = topIssues.map((issue, i) => ({
      issueNodeId: String(issue.id),
      statement: `If we address "${issue.text}", we can achieve 15-25% improvement in the target metric`,
      metric: ["Revenue growth %", "Cost reduction %", "Market share %"][i] || "ROI %",
      dataSource: ["Industry benchmarks", "Internal financials", "Market research"][i] || "Survey data",
      method: "scenario_analysis",
    }));
    const plans = hyps.map((_, i) => ({
      hypothesisIndex: i,
      method: "run_scenario_tool",
      parameters: {
        baselineRevenue: 1000000 + i * 500000,
        growthRate: 0.08 + i * 0.02,
        costReduction: 0.05 + i * 0.03,
        timeHorizonYears: 5,
        volatility: 0.15,
      },
      requiredDataset: "Financial projections + market data",
    }));
    progress("Analysis complete. Generated " + hyps.length + " hypotheses.", "status");
    return {
      hypothesesResult: { hypotheses: hyps, analysisPlan: plans },
      deliverableContent: { hypotheses: hyps, analysisPlan: plans },
      deliverableTitle: "Hypotheses & Analysis Plan",
    };
  }

  const issuesList = latestIssues.map((i) => `- [ID:${i.id}] ${i.text} (${i.priority})`).join("\n");
  const config = await getAgentConfig("hypothesis");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const raw = await callLLMWithLangChain(config.systemPrompt, `Issues:\n${issuesList}`, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  progress("Analysis complete. Generated " + (parsed.hypotheses?.length || 0) + " hypotheses.", "status");
  return {
    hypothesesResult: parsed,
    deliverableContent: parsed,
    deliverableTitle: "Hypotheses & Analysis Plan",
  };
}

async function executionNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
  const progress = state.onProgress;
  progress("Starting Execution agent...", "status");

  const plans = await storage.getAnalysisPlan(state.projectId);
  const results: { toolName: string; inputs: ScenarioInput; outputs: ScenarioOutput }[] = [];

  for (let idx = 0; idx < plans.length; idx++) {
    const plan = plans[idx];
    progress(`Running scenario ${idx + 1} of ${plans.length}...`, "status");
    const pJson = plan.parametersJson as any;
    const params: ScenarioInput = {
      baselineRevenue: pJson?.baselineRevenue || 1000000,
      growthRate: pJson?.growthRate || 0.1,
      costReduction: pJson?.costReduction || 0.05,
      timeHorizonYears: pJson?.timeHorizonYears || 5,
      volatility: pJson?.volatility || 0.15,
    };
    const outputs = runScenarioTool(params);
    results.push({ toolName: "run_scenario_tool", inputs: params, outputs });
  }

  progress("Analysis complete. Generated " + results.length + " scenario results.", "status");
  return {
    executionResults: results,
    deliverableContent: results,
    deliverableTitle: "Scenario Analysis Results",
  };
}

async function summaryNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
  const progress = state.onProgress;
  progress("Starting Summary agent...", "status");

  const hyps = await storage.getHypotheses(state.projectId);
  const runs = await storage.getModelRuns(state.projectId);
  const latestVersion = hyps[0]?.version || 1;
  const latestHyps = hyps.filter((h) => h.version === latestVersion);

  if (!hasApiKey()) {
    progress("Running in mock mode (no API key configured)", "status");
    const bullets = latestHyps
      .map((h, i) => {
        const run = runs[i];
        const summary = (run?.outputsJson as any)?.summary;
        if (summary) {
          return `- ${h.statement}: Expected NPV of $${summary.expectedValue?.toLocaleString() || "N/A"} with risk-adjusted return of ${summary.riskAdjustedReturn || "N/A"}%`;
        }
        return `- ${h.statement}: Analysis pending`;
      })
      .join("\n");
    const summaryText = `# Executive Summary\n\n## Objective\n${state.objective}\n\n## Key Findings\n${bullets}\n\n## Recommendation\nBased on scenario analysis across baseline, optimistic, and pessimistic cases, the proposed strategy shows positive expected returns. The risk-adjusted analysis suggests proceeding with a phased implementation approach, prioritizing the highest-NPV initiatives first.\n\n## Next Steps\n1. Validate assumptions with stakeholder interviews\n2. Develop detailed implementation roadmap\n3. Establish KPI tracking framework\n4. Begin Phase 1 execution within 30 days`;
    progress("Analysis complete. Generated executive summary.", "status");
    return {
      summaryResult: { summaryText },
      deliverableContent: { summaryText },
      deliverableTitle: "Executive Summary",
    };
  }

  const hypList = latestHyps
    .map((h, i) => {
      const run = runs[i];
      return `Hypothesis: ${h.statement}\nMetric: ${h.metric}\nModel Results: ${JSON.stringify((run?.outputsJson as any)?.summary || "No results")}`;
    })
    .join("\n\n");

  const config = await getAgentConfig("summary");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const userPrompt = `Objective: ${state.objective}\nConstraints: ${state.constraints}\n\nHypotheses & Results:\n${hypList}`;
  const summaryText = await callLLMWithLangChain(config.systemPrompt, userPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  progress("Analysis complete. Generated executive summary.", "status");
  return {
    summaryResult: { summaryText: summaryText || "Summary generation failed." },
    deliverableContent: { summaryText: summaryText || "Summary generation failed." },
    deliverableTitle: "Executive Summary",
  };
}

async function presentationNode(state: ConsultingStateType): Promise<Partial<ConsultingStateType>> {
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

  if (!hasApiKey()) {
    progress("Running in mock mode (no API key configured)", "status");
    const mockSlides = [
      { slideIndex: 0, layout: "title_slide", title: projectName, subtitle: "Strategic Analysis & Recommendations", bodyJson: {}, notesText: "Welcome and introductions" },
      { slideIndex: 1, layout: "section_header", title: "Executive Summary", subtitle: "Key findings from our analysis", bodyJson: {}, notesText: "Transition to executive overview" },
      { slideIndex: 2, layout: "title_body", title: "Objective & Scope", subtitle: null, bodyJson: { bullets: [state.objective, "Multi-scenario financial modeling", "Risk-adjusted return analysis", "Data-driven recommendations"] }, notesText: "Review the project scope and analytical approach" },
      { slideIndex: 3, layout: "metrics", title: "Key Financial Metrics", subtitle: null, bodyJson: { metrics: (() => { const run = (runs[0]?.outputsJson as any)?.summary; return [{ label: "Expected NPV", value: run ? `$${(run.expectedValue / 1000).toFixed(0)}K` : "$850K", change: "+22%" }, { label: "Best Case", value: run ? `$${(run.optimisticNpv / 1000).toFixed(0)}K` : "$1.2M", change: "Upside" }, { label: "Risk-Adj Return", value: run ? `${run.riskAdjustedReturn}%` : "18%", change: "+5pp" }]; })() }, notesText: "Walk through each metric and its implications" },
      { slideIndex: 4, layout: "two_column", title: "Scenario Comparison", subtitle: null, bodyJson: { leftTitle: "Baseline Scenario", leftBullets: ["Conservative growth assumptions", "Moderate cost efficiencies", "Stable market conditions"], rightTitle: "Optimistic Scenario", rightBullets: ["Accelerated market capture", "Full cost reduction realized", "Favorable competitive dynamics"] }, notesText: "Compare the two primary scenarios" },
      { slideIndex: 5, layout: "title_body", title: "Key Findings", subtitle: null, bodyJson: { bullets: latestHyps.slice(0, 4).map((h) => h.statement.length > 60 ? h.statement.slice(0, 57) + "..." : h.statement) }, notesText: "Detail each hypothesis and supporting evidence" },
      { slideIndex: 6, layout: "title_body", title: "Recommendations", subtitle: null, bodyJson: { bullets: ["Proceed with phased implementation", "Prioritize highest-NPV initiatives", "Establish KPI tracking framework", "Conduct monthly progress reviews"] }, notesText: "Present the recommended course of action" },
      { slideIndex: 7, layout: "title_body", title: "Next Steps", subtitle: "30-60-90 Day Plan", bodyJson: { bullets: ["Days 1-30: Stakeholder alignment", "Days 31-60: Pilot program launch", "Days 61-90: Scale & optimize", "Ongoing: Monthly KPI review"] }, notesText: "Outline the implementation timeline" },
      { slideIndex: 8, layout: "section_header", title: "Thank You", subtitle: "Questions & Discussion", bodyJson: {}, notesText: "Open floor for Q&A" },
    ];
    progress("Analysis complete. Generated " + mockSlides.length + " slides.", "status");
    return {
      presentationResult: { slides: mockSlides },
      deliverableContent: { slides: mockSlides },
      deliverableTitle: "Presentation Deck",
    };
  }

  const hypSummary = latestHyps
    .map((h, i) => {
      const run = runs[i];
      const oJson = run?.outputsJson as any;
      const results = oJson?.summary
        ? `NPV: $${oJson.summary.expectedValue?.toLocaleString()}, Risk-Adj Return: ${oJson.summary.riskAdjustedReturn}%`
        : "No results";
      return `- ${h.statement} (${h.metric}): ${results}`;
    })
    .join("\n");

  const config = await getAgentConfig("presentation");
  progress(`Calling LLM with model ${config.model}...`, "llm");
  const userPrompt = `Project: ${projectName}\nObjective: ${state.objective}\n\nExecutive Summary:\n${latestNarr?.summaryText || "No summary available"}\n\nHypotheses & Results:\n${hypSummary}`;
  const raw = await callLLMWithLangChain(config.systemPrompt, userPrompt, config.model, config.maxTokens);
  progress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  progress("Analysis complete. Generated " + (parsed.slides?.length || 0) + " slides.", "status");
  return {
    presentationResult: parsed,
    deliverableContent: parsed,
    deliverableTitle: "Presentation Deck",
  };
}

function routeToStep(state: ConsultingStateType): string {
  return state.targetStep;
}

function buildIssuesTreeSubgraph() {
  const graph = new StateGraph(ConsultingState)
    .addNode("issues_tree", issuesTreeNode)
    .addNode("mece_critic", meceCriticNode)
    .addNode("finalize_issues", finalizeIssuesNode)
    .addEdge(START, "issues_tree")
    .addEdge("issues_tree", "mece_critic")
    .addConditionalEdges("mece_critic", meceCriticRouter, {
      issues_tree: "issues_tree",
      finalize_issues: "finalize_issues",
    })
    .addEdge("finalize_issues", END);

  return graph.compile();
}

function buildConsultingWorkflow() {
  const issuesSubgraph = buildIssuesTreeSubgraph();

  const graph = new StateGraph(ConsultingState)
    .addNode("project_definition", projectDefinitionNode)
    .addNode("issues_tree_subgraph", issuesSubgraph)
    .addNode("hypothesis", hypothesisNode)
    .addNode("execution", executionNode)
    .addNode("summary", summaryNode)
    .addNode("presentation", presentationNode)
    .addConditionalEdges(START, routeToStep, {
      project_definition: "project_definition",
      issues_tree: "issues_tree_subgraph",
      hypothesis: "hypothesis",
      execution: "execution",
      summary: "summary",
      presentation: "presentation",
    })
    .addEdge("project_definition", END)
    .addEdge("issues_tree_subgraph", END)
    .addEdge("hypothesis", END)
    .addEdge("execution", END)
    .addEdge("summary", END)
    .addEdge("presentation", END);

  return graph.compile();
}

let _workflow: ReturnType<typeof buildConsultingWorkflow> | null = null;

export function getConsultingWorkflow() {
  if (!_workflow) {
    _workflow = buildConsultingWorkflow();
  }
  return _workflow;
}

export async function runWorkflowStep(
  projectId: number,
  agentKey: string,
  onProgress: ProgressCallback = () => {}
): Promise<{ deliverableContent: any; deliverableTitle: string }> {
  const project = await storage.getProject(projectId);
  if (!project) throw new Error("Project not found");

  const workflow = getConsultingWorkflow();

  const result = await workflow.invoke({
    projectId,
    objective: project.objective,
    constraints: project.constraints,
    targetStep: agentKey === "issues_tree" ? "issues_tree" : agentKey,
    onProgress,
  });

  return {
    deliverableContent: result.deliverableContent,
    deliverableTitle: result.deliverableTitle,
  };
}

export async function refineWithLangGraph(
  agentKey: string,
  currentContent: any,
  userFeedback: string,
  projectContext: { objective: string; constraints: string },
  onProgress: ProgressCallback = () => {}
): Promise<any> {
  onProgress("Processing your feedback...", "progress");

  if (!hasApiKey()) {
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
