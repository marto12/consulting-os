import OpenAI from "openai";
import { runScenarioTool, type ScenarioInput, type ScenarioOutput } from "./scenario-tool";
import { storage } from "../storage";

const hasApiKey = !!(
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
);

let openai: OpenAI | null = null;
if (hasApiKey) {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

const DEFAULT_MODEL = "gpt-5-nano";

function getModelUsed(): string {
  return hasApiKey ? DEFAULT_MODEL : "mock";
}

export const DEFAULT_PROMPTS: Record<string, string> = {
  issues_tree: `You are a McKinsey-style consulting analyst. Given a project objective and constraints, produce a MECE issues tree with AT LEAST 3 levels of depth. Return ONLY valid JSON matching this schema:
{
  "issues": [
    { "id": "1", "parentId": null, "text": "Root issue", "priority": "high" },
    { "id": "2", "parentId": "1", "text": "Level 2 sub-issue", "priority": "medium" },
    { "id": "3", "parentId": "2", "text": "Level 3 detail", "priority": "low" }
  ]
}
Priority must be "high", "medium", or "low". Use string IDs. parentId is null for root nodes. Include 15-25 nodes across 3+ levels of depth. Each root issue should have 2-3 children, and at least some children should have their own children (grandchildren of root).`,

  hypothesis: `You are a consulting analyst. Given an issues tree, generate hypotheses and an analysis plan. Return ONLY valid JSON matching this schema:
{
  "hypotheses": [
    {
      "issueNodeId": "1",
      "statement": "Hypothesis text",
      "metric": "Revenue growth %",
      "dataSource": "Industry benchmarks",
      "method": "scenario_analysis"
    }
  ],
  "analysisPlan": [
    {
      "hypothesisIndex": 0,
      "method": "run_scenario_tool",
      "parameters": {
        "baselineRevenue": 1000000,
        "growthRate": 0.1,
        "costReduction": 0.05,
        "timeHorizonYears": 5,
        "volatility": 0.15
      },
      "requiredDataset": "Financial projections"
    }
  ]
}
Generate 2-4 hypotheses linked to the most important issues. Each hypothesis must have a corresponding analysis plan entry. The parameters must have all fields: baselineRevenue (number), growthRate (0-1), costReduction (0-1), timeHorizonYears (integer), volatility (0-1). Use realistic business numbers.`,

  mece_critic: `You are a rigorous MECE quality auditor for consulting issues trees. Your job is to evaluate an issues tree and either approve it or return specific revision instructions.

Evaluate the tree against these 5 criteria:

1. OVERLAP: Check for semantic overlap between sibling branches at each level. Siblings must be mutually exclusive — no branch should partially restate or subsume another.

2. COVERAGE: Check for material gaps. Are there important dimensions of the governing question that are completely missing? Would a senior partner say "you forgot about X"?

3. MIXED LOGICS: Check whether branches at the same level mix different types of decomposition — e.g., mixing drivers with symptoms, or actions with conditions. Each level should use one consistent logic.

4. BRANCH BALANCE: Check whether any single branch has significantly more children than its siblings (more than 2x). An unbalanced tree suggests the decomposition logic is wrong.

5. LABEL QUALITY: Check for vague or generic labels like "Other factors", "Miscellaneous", "General considerations". Every branch must be specific and descriptive.

Return ONLY valid JSON matching this schema:
{
  "verdict": "approved" | "revise",
  "scores": {
    "overlap": { "score": 1-5, "details": "explanation" },
    "coverage": { "score": 1-5, "details": "explanation" },
    "mixedLogics": { "score": 1-5, "details": "explanation" },
    "branchBalance": { "score": 1-5, "details": "explanation" },
    "labelQuality": { "score": 1-5, "details": "explanation" }
  },
  "overallScore": 1-5,
  "revisionInstructions": "Specific instructions for what to fix. Empty string if approved."
}

Score guide: 1=critical failure, 2=major issues, 3=acceptable, 4=good, 5=excellent.
Set verdict to "approved" if overallScore >= 4. Set to "revise" if overallScore < 4.
Be strict but fair. Provide actionable, specific revision instructions when verdict is "revise".`,

  execution: `Execute the analysis plan using the scenario calculator tool.`,

  summary: `You are a senior consulting partner writing an executive summary. Produce a clear, structured summary with: Key Findings (bullet points), Recommendation (2-3 sentences), and Next Steps (numbered list). Use markdown formatting. Be concise and actionable. Return ONLY the summary text, not JSON.`,
};

export function getDefaultConfigs() {
  return Object.entries(DEFAULT_PROMPTS).map(([agentType, systemPrompt]) => ({
    agentType,
    systemPrompt,
    model: DEFAULT_MODEL,
    maxTokens: 8192,
  }));
}

async function getAgentPrompt(agentType: string): Promise<string> {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config.systemPrompt;
  } catch {}
  return DEFAULT_PROMPTS[agentType] || "";
}

async function getAgentModel(agentType: string): Promise<string> {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config.model;
  } catch {}
  return DEFAULT_MODEL;
}

async function getAgentMaxTokens(agentType: string): Promise<number> {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config.maxTokens;
  } catch {}
  return 8192;
}

async function callLLM(systemPrompt: string, userPrompt: string, model?: string, maxTokens?: number): Promise<string> {
  if (!openai) {
    return "";
  }

  const response = await openai.chat.completions.create({
    model: model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: maxTokens || 8192,
  });

  return response.choices[0]?.message?.content || "";
}

function extractJson(text: string): any {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    return JSON.parse(match[1].trim());
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return JSON.parse(text);
}

export interface IssueNodeOutput {
  id: string;
  parentId: string | null;
  text: string;
  priority: "high" | "medium" | "low";
}

export interface CriticResult {
  verdict: "approved" | "revise";
  scores: {
    overlap: { score: number; details: string };
    coverage: { score: number; details: string };
    mixedLogics: { score: number; details: string };
    branchBalance: { score: number; details: string };
    labelQuality: { score: number; details: string };
  };
  overallScore: number;
  revisionInstructions: string;
}

function formatTreeForCritic(issues: IssueNodeOutput[], objective: string): string {
  const roots = issues.filter((n) => !n.parentId);
  function renderBranch(parentId: string | null, indent: number): string {
    const children = issues.filter((n) => n.parentId === parentId);
    return children
      .map((c) => {
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

const MAX_REVISIONS = 2;

export async function issuesTreeAgent(
  objective: string,
  constraints: string
): Promise<{ issues: IssueNodeOutput[]; criticLog: { iteration: number; critic: CriticResult }[] }> {
  if (!openai) {
    return {
      issues: [
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
      ],
      criticLog: [{
        iteration: 0,
        critic: {
          verdict: "approved",
          scores: {
            overlap: { score: 5, details: "No overlap between sibling branches" },
            coverage: { score: 4, details: "Key dimensions covered: market, revenue, operations" },
            mixedLogics: { score: 4, details: "Consistent strategic decomposition at each level" },
            branchBalance: { score: 4, details: "Balanced across 3 root branches (7/7/7 nodes)" },
            labelQuality: { score: 5, details: "All labels are specific and descriptive" },
          },
          overallScore: 4,
          revisionInstructions: "",
        },
      }],
    };
  }

  const generatorPrompt = await getAgentPrompt("issues_tree");
  const generatorModel = await getAgentModel("issues_tree");
  const generatorMaxTokens = await getAgentMaxTokens("issues_tree");
  const criticPrompt = await getAgentPrompt("mece_critic");
  const criticModel = await getAgentModel("mece_critic");
  const criticMaxTokens = await getAgentMaxTokens("mece_critic");

  const baseUserPrompt = `Objective: ${objective}\nConstraints: ${constraints}`;
  const criticLog: { iteration: number; critic: CriticResult }[] = [];

  let currentTree: { issues: IssueNodeOutput[] };
  let raw = await callLLM(generatorPrompt, baseUserPrompt, generatorModel, generatorMaxTokens);
  currentTree = extractJson(raw);

  for (let iteration = 0; iteration <= MAX_REVISIONS; iteration++) {
    const treeDescription = formatTreeForCritic(currentTree.issues, objective);
    const criticRaw = await callLLM(criticPrompt, treeDescription, criticModel, criticMaxTokens);

    let criticResult: CriticResult;
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

    criticLog.push({ iteration, critic: criticResult });

    if (criticResult.verdict === "approved" || iteration === MAX_REVISIONS) {
      break;
    }

    const revisionPrompt = `${baseUserPrompt}\n\n---\nPREVIOUS TREE (needs revision):\n${formatTreeForCritic(currentTree.issues, objective)}\n\n---\nMECE CRITIC FEEDBACK (iteration ${iteration + 1}):\nOverall Score: ${criticResult.overallScore}/5\nOverlap: ${criticResult.scores.overlap.score}/5 — ${criticResult.scores.overlap.details}\nCoverage: ${criticResult.scores.coverage.score}/5 — ${criticResult.scores.coverage.details}\nMixed Logics: ${criticResult.scores.mixedLogics.score}/5 — ${criticResult.scores.mixedLogics.details}\nBranch Balance: ${criticResult.scores.branchBalance.score}/5 — ${criticResult.scores.branchBalance.details}\nLabel Quality: ${criticResult.scores.labelQuality.score}/5 — ${criticResult.scores.labelQuality.details}\n\nREVISION INSTRUCTIONS:\n${criticResult.revisionInstructions}\n\nPlease produce a REVISED issues tree that addresses ALL the critic's feedback. Return the full tree in the same JSON format.`;

    raw = await callLLM(generatorPrompt, revisionPrompt, generatorModel, generatorMaxTokens);
    currentTree = extractJson(raw);
  }

  return { ...currentTree, criticLog };
}

export interface HypothesisOutput {
  issueNodeId: string;
  statement: string;
  metric: string;
  dataSource: string;
  method: string;
}

export interface AnalysisPlanOutput {
  hypothesisIndex: number;
  method: string;
  parameters: ScenarioInput;
  requiredDataset: string;
}

export async function hypothesisAgent(
  issues: { id: number; text: string; priority: string }[]
): Promise<{
  hypotheses: HypothesisOutput[];
  analysisPlan: AnalysisPlanOutput[];
}> {
  if (!openai) {
    const topIssues = issues.slice(0, 3);
    const hyps: HypothesisOutput[] = topIssues.map((issue, i) => ({
      issueNodeId: String(issue.id),
      statement: `If we address "${issue.text}", we can achieve 15-25% improvement in the target metric`,
      metric: ["Revenue growth %", "Cost reduction %", "Market share %"][i] || "ROI %",
      dataSource: ["Industry benchmarks", "Internal financials", "Market research"][i] || "Survey data",
      method: "scenario_analysis",
    }));

    const plans: AnalysisPlanOutput[] = hyps.map((_, i) => ({
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

    return { hypotheses: hyps, analysisPlan: plans };
  }

  const issuesList = issues.map((i) => `- [ID:${i.id}] ${i.text} (${i.priority})`).join("\n");

  const systemPrompt = await getAgentPrompt("hypothesis");
  const model = await getAgentModel("hypothesis");
  const maxTokens = await getAgentMaxTokens("hypothesis");

  const raw = await callLLM(systemPrompt, `Issues:\n${issuesList}`, model, maxTokens);
  return extractJson(raw);
}

export async function executionAgent(
  plans: { method: string; parameters: any; requiredDataset: string }[]
): Promise<{ toolName: string; inputs: ScenarioInput; outputs: ScenarioOutput }[]> {
  const results: { toolName: string; inputs: ScenarioInput; outputs: ScenarioOutput }[] = [];

  for (const plan of plans) {
    const params: ScenarioInput = {
      baselineRevenue: plan.parameters.baselineRevenue || 1000000,
      growthRate: plan.parameters.growthRate || 0.1,
      costReduction: plan.parameters.costReduction || 0.05,
      timeHorizonYears: plan.parameters.timeHorizonYears || 5,
      volatility: plan.parameters.volatility || 0.15,
    };

    const outputs = runScenarioTool(params);
    results.push({
      toolName: "run_scenario_tool",
      inputs: params,
      outputs,
    });
  }

  return results;
}

export async function summaryAgent(
  objective: string,
  constraints: string,
  hypotheses: { statement: string; metric: string }[],
  modelRuns: { inputsJson: any; outputsJson: any }[]
): Promise<{ summaryText: string }> {
  if (!openai) {
    const bullets = hypotheses
      .map((h, i) => {
        const run = modelRuns[i];
        const summary = run?.outputsJson?.summary;
        if (summary) {
          return `- ${h.statement}: Expected NPV of $${summary.expectedValue?.toLocaleString() || "N/A"} with risk-adjusted return of ${summary.riskAdjustedReturn || "N/A"}%`;
        }
        return `- ${h.statement}: Analysis pending`;
      })
      .join("\n");

    return {
      summaryText: `# Executive Summary\n\n## Objective\n${objective}\n\n## Key Findings\n${bullets}\n\n## Recommendation\nBased on scenario analysis across baseline, optimistic, and pessimistic cases, the proposed strategy shows positive expected returns. The risk-adjusted analysis suggests proceeding with a phased implementation approach, prioritizing the highest-NPV initiatives first.\n\n## Next Steps\n1. Validate assumptions with stakeholder interviews\n2. Develop detailed implementation roadmap\n3. Establish KPI tracking framework\n4. Begin Phase 1 execution within 30 days`,
    };
  }

  const hypList = hypotheses
    .map((h, i) => {
      const run = modelRuns[i];
      return `Hypothesis: ${h.statement}\nMetric: ${h.metric}\nModel Results: ${JSON.stringify(run?.outputsJson?.summary || "No results")}`;
    })
    .join("\n\n");

  const systemPrompt = await getAgentPrompt("summary");
  const model = await getAgentModel("summary");
  const maxTokens = await getAgentMaxTokens("summary");

  const userPrompt = `Objective: ${objective}\nConstraints: ${constraints}\n\nHypotheses & Results:\n${hypList}`;
  const summaryText = await callLLM(systemPrompt, userPrompt, model, maxTokens);

  return { summaryText: summaryText || "Summary generation failed." };
}

export { getModelUsed, runScenarioTool };
