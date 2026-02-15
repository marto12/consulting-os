import OpenAI from "openai";
import { runScenarioTool, type ScenarioInput, type ScenarioOutput } from "./scenario-tool";

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

const MODEL = "gpt-5-nano";

function getModelUsed(): string {
  return hasApiKey ? MODEL : "mock";
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!openai) {
    return "";
  }

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 8192,
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

export async function issuesTreeAgent(
  objective: string,
  constraints: string
): Promise<{ issues: IssueNodeOutput[] }> {
  if (!openai) {
    return {
      issues: [
        { id: "1", parentId: null, text: "Market Entry Strategy", priority: "high" },
        { id: "2", parentId: "1", text: "Target Market Sizing", priority: "high" },
        { id: "3", parentId: "1", text: "Competitive Landscape Analysis", priority: "medium" },
        { id: "4", parentId: null, text: "Revenue Model Design", priority: "high" },
        { id: "5", parentId: "4", text: "Pricing Strategy Optimization", priority: "high" },
        { id: "6", parentId: "4", text: "Channel Mix Selection", priority: "medium" },
        { id: "7", parentId: null, text: "Operational Readiness", priority: "medium" },
        { id: "8", parentId: "7", text: "Team Scaling Plan", priority: "medium" },
        { id: "9", parentId: "7", text: "Technology Infrastructure", priority: "low" },
      ],
    };
  }

  const systemPrompt = `You are a McKinsey-style consulting analyst. Given a project objective and constraints, produce a MECE issues tree. Return ONLY valid JSON matching this schema:
{
  "issues": [
    { "id": "1", "parentId": null, "text": "Root issue", "priority": "high" },
    { "id": "2", "parentId": "1", "text": "Sub-issue", "priority": "medium" }
  ]
}
Priority must be "high", "medium", or "low". Use string IDs. parentId is null for root nodes. Include 6-12 nodes.`;

  const userPrompt = `Objective: ${objective}\nConstraints: ${constraints}`;
  const raw = await callLLM(systemPrompt, userPrompt);
  return extractJson(raw);
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

  const systemPrompt = `You are a consulting analyst. Given an issues tree, generate hypotheses and an analysis plan. Return ONLY valid JSON matching this schema:
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
Generate 2-4 hypotheses linked to the most important issues. Each hypothesis must have a corresponding analysis plan entry. The parameters must have all fields: baselineRevenue (number), growthRate (0-1), costReduction (0-1), timeHorizonYears (integer), volatility (0-1). Use realistic business numbers.`;

  const raw = await callLLM(systemPrompt, `Issues:\n${issuesList}`);
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

  const systemPrompt = `You are a senior consulting partner writing an executive summary. Produce a clear, structured summary with: Key Findings (bullet points), Recommendation (2-3 sentences), and Next Steps (numbered list). Use markdown formatting. Be concise and actionable. Return ONLY the summary text, not JSON.`;

  const userPrompt = `Objective: ${objective}\nConstraints: ${constraints}\n\nHypotheses & Results:\n${hypList}`;
  const summaryText = await callLLM(systemPrompt, userPrompt);

  return { summaryText: summaryText || "Summary generation failed." };
}

export { getModelUsed, runScenarioTool };
