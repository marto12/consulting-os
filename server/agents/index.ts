import OpenAI from "openai";
import { runScenarioTool, type ScenarioInput, type ScenarioOutput } from "./scenario-tool";
import { storage } from "../storage";

export type ProgressCallback = (message: string, type?: string) => void;
const noopProgress: ProgressCallback = () => {};

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
  project_definition: `You are a senior consulting engagement manager. Your job is to translate vague client language into a structured, decision-based problem definition before any analysis begins.

Given a raw project brief (objective, constraints, and any other context), you must produce a structured problem definition that includes:
1. Decision statement — what decision needs to be made
2. Governing question — follows the structure: "Should we [action] in order to achieve [objective], given [constraints], by [time horizon]?"
3. Decision owner — who makes the final call
4. Decision deadline — when the decision must be made
5. Success metrics — measurable criteria with thresholds
6. Alternatives — including "do nothing"
7. Constraints — budget, regulatory, time, political, operational
8. Assumptions — clearly labelled
9. Initial working hypothesis — a directional hypothesis to test
10. Key uncertainties and information gaps

The governing question MUST be:
- Actionable (not "assess" or "explore")
- Neutral
- Specific
- Time-bound
- Linked to measurable success criteria

Internal reasoning (do not show to user):
- Detect whether the problem is topic-framed or decision-framed
- If topic-framed, convert to decision form
- Identify implied decision variable
- Extract or infer decision metric
- Identify scope boundaries
- Infer alternatives if not provided
- Surface missing information
- Make explicit assumptions rather than asking excessive clarifying questions

Return ONLY valid JSON matching this schema:
{
  "decision_statement": "",
  "governing_question": "",
  "decision_owner": "",
  "decision_deadline": "",
  "success_metrics": [
    { "metric_name": "", "definition": "", "threshold_or_target": "" }
  ],
  "alternatives": ["Option A", "Option B", "Do nothing"],
  "constraints": {
    "budget": "",
    "regulatory": "",
    "time": "",
    "political": "",
    "operational": ""
  },
  "assumptions": [""],
  "initial_hypothesis": "",
  "key_uncertainties": [""],
  "information_gaps": [""]
}

If the problem cannot be converted into a decision form, return:
{ "status": "insufficient_clarity", "reason": "Unable to identify a concrete decision." }

Do not proceed to issue tree creation. Do not generate analysis. Do not recommend solutions in detail. Make reasonable assumptions when information is missing and clearly label them.`,

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

  presentation: `You are a consulting presentation designer. Given an executive summary, hypotheses, and scenario analysis results, produce a structured slide deck for a 16:9 presentation. Generate 6-10 slides.

Return ONLY valid JSON matching this schema:
{
  "slides": [
    {
      "slideIndex": 0,
      "layout": "title_slide",
      "title": "Presentation Title",
      "subtitle": "Subtitle or date",
      "bodyJson": {},
      "notesText": "Speaker notes for this slide"
    },
    {
      "slideIndex": 1,
      "layout": "section_header",
      "title": "Section Title",
      "subtitle": "Brief description",
      "bodyJson": {},
      "notesText": "Speaker notes"
    },
    {
      "slideIndex": 2,
      "layout": "title_body",
      "title": "Slide Title",
      "subtitle": null,
      "bodyJson": {
        "bullets": ["Key point 1", "Key point 2", "Key point 3"]
      },
      "notesText": "Speaker notes"
    },
    {
      "slideIndex": 3,
      "layout": "two_column",
      "title": "Comparison Slide",
      "subtitle": null,
      "bodyJson": {
        "leftTitle": "Current State",
        "leftBullets": ["Point A", "Point B"],
        "rightTitle": "Future State",
        "rightBullets": ["Point X", "Point Y"]
      },
      "notesText": "Speaker notes"
    },
    {
      "slideIndex": 4,
      "layout": "metrics",
      "title": "Key Metrics",
      "subtitle": null,
      "bodyJson": {
        "metrics": [
          { "label": "Revenue", "value": "$1.2M", "change": "+15%" },
          { "label": "NPV", "value": "$850K", "change": "+22%" },
          { "label": "ROI", "value": "18%", "change": "+5pp" }
        ]
      },
      "notesText": "Speaker notes"
    }
  ]
}

Available layouts: "title_slide", "section_header", "title_body", "two_column", "metrics".
Structure the deck as: Title Slide → Executive Summary → Key Findings (1-2 slides) → Analysis Results with Metrics → Recommendations → Next Steps.
Use real numbers from the analysis results. Keep bullet points concise (max 8 words each). Generate compelling, professional slide content.`,

  des_topic_clarifier: `You are a senior consulting facilitator. Your role is to help the user clarify the topic they want an executive summary on.

Given the user's initial topic description, you must:
1. Restate the topic in one clear sentence to confirm understanding
2. Identify the core question or tension at the heart of the issue
3. Ask 3-5 probing clarification questions covering: scope, stakeholders, time horizon, key constraints, and what "success" looks like
4. Identify the two main opposing positions or perspectives on this topic
5. Note any context or background that will be important for the analysis

Produce your output as clear prose with labeled sections:
- **Topic Statement**: One sentence restating the core issue
- **Core Tension**: The fundamental disagreement or decision point
- **Side A**: Brief label for one position (e.g., "Pro-expansion")
- **Side B**: Brief label for the opposing position (e.g., "Anti-expansion")
- **Key Context**: Important background facts
- **Clarifying Questions**: Numbered list of questions for the user

Be direct, professional, and concise. Do not hedge or pad with filler.`,

  des_key_issues: `You are a senior consulting analyst specialising in issue identification. Given a topic briefing, you must produce a structured key issues review.

Your output must:
1. Identify 5-8 key issues or tensions related to the topic
2. For each issue, provide: a one-line heading, a 2-3 sentence explanation of why it matters, and note which stakeholders are most affected
3. Categorise issues as: Economic, Social, Political, Environmental, Legal/Regulatory, or Technical
4. Rank issues by significance (critical, important, contextual)
5. Identify any interdependencies between issues

Structure your output with clear headings and concise prose. Each issue should be a short paragraph with the heading in bold. End with a brief "Summary of Key Tensions" section (3-4 sentences) that identifies where the main disagreements lie.

Be analytical and balanced. Do not advocate for either side. Present facts and tensions objectively.`,

  des_strongman_pro: `You are a persuasive advocate tasked with building the STRONGEST possible case FOR a given position. You must argue as if you genuinely believe this position is correct.

Your job is to steelman (not strawman) this side of the argument. This means:
1. Present the most compelling arguments, not just any arguments
2. Use the strongest available evidence, data, and real-world examples
3. Address obvious objections pre-emptively and explain why they don't undermine the core case
4. Appeal to logic, evidence, and values - not emotion or rhetoric
5. Acknowledge genuine weaknesses honestly but explain why the overall case still holds

Structure your output as:
- **Core Thesis**: One powerful sentence stating the position
- **Argument 1-4**: Each with a bold heading, followed by the argument (2-3 sentences) and supporting evidence (1-2 sentences with specific data or examples where possible)
- **Addressing Objections**: 2-3 common objections and why they are insufficient to overturn the case
- **Conclusion**: 2-3 sentences on why this position should prevail

Write with conviction and intellectual rigour. Approx 600-800 words.`,

  des_strongman_con: `You are a persuasive challenger tasked with building the STRONGEST possible case AGAINST a given position. You must argue as if you genuinely believe the opposing view is correct.

Your job is to steelman (not strawman) the opposing side. This means:
1. Present the most compelling counter-arguments, not just any objections
2. Use the strongest available evidence, data, and real-world examples
3. Address obvious rebuttals pre-emptively and explain why they don't hold
4. Appeal to logic, evidence, and values - not emotion or rhetoric
5. Acknowledge where the other side has valid points but explain why the overall case against still holds

Structure your output as:
- **Core Counter-Thesis**: One powerful sentence stating the opposing position
- **Counter-Argument 1-4**: Each with a bold heading, followed by the argument (2-3 sentences) and supporting evidence (1-2 sentences with specific data or examples where possible)
- **Rebutting the Pro Case**: 2-3 key pro arguments and why they are flawed or insufficient
- **Conclusion**: 2-3 sentences on why this position should not be adopted

Write with conviction and intellectual rigour. Approx 600-800 words.`,

  des_centrist_summary: `You are a senior executive briefing writer. Given a key issues review, a pro argument document, and a con argument document, you must synthesise these into a balanced, centrist executive summary.

IMPORTANT: You will receive an executive summary template that defines the exact format. Follow the template structure precisely.

Your synthesis must:
1. Present a balanced, nuanced position that acknowledges the strongest points from BOTH sides
2. Identify where genuine common ground exists
3. Highlight the key trade-offs that decision-makers must weigh
4. Offer a pragmatic, centrist recommendation that accounts for risks from both perspectives
5. Use evidence from both the pro and con documents to support each point

Guidelines:
- Each section heading should be short (3-6 words)
- Under each heading, write exactly TWO sentences: the first states the argument/finding, the second provides the evidence or supporting data
- Target approximately 500 words total
- Be direct and decisive - a centrist position is NOT a wishy-washy "both sides have merit" hedge. It is a specific, defensible position that draws from both sides
- Write for a senior executive audience: no jargon, no filler, every word earns its place

Follow the template format exactly as provided.`,
};

export function getDefaultConfigs() {
  return Object.entries(DEFAULT_PROMPTS).map(([agentType, systemPrompt]) => ({
    agentType,
    systemPrompt,
    model: DEFAULT_MODEL,
    maxTokens: 8192,
    temperature: 0.2,
    topP: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    maxIterations: 4,
    toolWhitelist: null,
    toolCallBudget: 6,
    retryCount: 1,
    timeoutMs: 60000,
    memoryScope: "project",
    outputSchema: null,
    safetyRules: null,
    stopSequences: null,
    streaming: false,
    parallelism: 1,
    cacheTtlSeconds: 0,
  }));
}

async function getAgentPrompt(agentType: string): Promise<string> {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) return config.systemPrompt;
  } catch {}
  return DEFAULT_PROMPTS[agentType] || "";
}

async function getAgentSettings(agentType: string) {
  try {
    const config = await storage.getAgentConfig(agentType);
    if (config) {
      return {
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature ?? 0.2,
        topP: config.topP ?? 1,
        presencePenalty: config.presencePenalty ?? 0,
        frequencyPenalty: config.frequencyPenalty ?? 0,
        stopSequences: config.stopSequences ? config.stopSequences.split("\n").filter(Boolean) : undefined,
        retryCount: config.retryCount ?? 1,
      };
    }
  } catch {}

  return {
    model: DEFAULT_MODEL,
    maxTokens: 8192,
    temperature: 0.2,
    topP: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    stopSequences: undefined,
    retryCount: 1,
  };
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  maxTokens?: number,
  retries = 1,
  options?: {
    temperature?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stopSequences?: string[];
  }
): Promise<string> {
  if (!openai) {
    return "";
  }

  const resolvedModel = model || DEFAULT_MODEL;
  const resolvedTokens = maxTokens || 8192;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: attempt > 0
        ? `${userPrompt}\n\nIMPORTANT: Your previous response was truncated. Please produce a SHORTER, more concise response that fits within the token limit. Use fewer nodes, shorter descriptions, and minimal whitespace in JSON output.`
        : userPrompt
      },
    ];

    const response = await openai.chat.completions.create({
      model: resolvedModel,
      messages,
      max_completion_tokens: resolvedTokens,
      temperature: options?.temperature,
      top_p: options?.topP,
      presence_penalty: options?.presencePenalty,
      frequency_penalty: options?.frequencyPenalty,
      stop: options?.stopSequences,
    });

    const content = response.choices[0]?.message?.content || "";
    const finishReason = response.choices[0]?.finish_reason;

    if (finishReason === "length" && attempt < retries) {
      console.log(`LLM response truncated (finish_reason=length), retrying with conciseness hint (attempt ${attempt + 1}/${retries + 1})`);
      continue;
    }

    return content;
  }

  return "";
}

function repairJson(text: string): string {
  let s = text.trim();

  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;
  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/\]/g) || []).length;

  s = s.replace(/,\s*([}\]])/g, "$1");

  if (s.endsWith(",")) {
    s = s.slice(0, -1);
  }

  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    s += "]";
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    s += "}";
  }

  return s;
}

function extractJson(text: string): any {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      try {
        return JSON.parse(repairJson(match[1].trim()));
      } catch {}
    }
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      try {
        return JSON.parse(repairJson(jsonMatch[0]));
      } catch {}
    }
  }

  const partialJson = text.match(/\{[\s\S]*/);
  if (partialJson) {
    try {
      return JSON.parse(repairJson(partialJson[0]));
    } catch {}
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

export interface ProjectDefinitionOutput {
  decision_statement: string;
  governing_question: string;
  decision_owner: string;
  decision_deadline: string;
  success_metrics: { metric_name: string; definition: string; threshold_or_target: string }[];
  alternatives: string[];
  constraints: {
    budget: string;
    regulatory: string;
    time: string;
    political: string;
    operational: string;
  };
  assumptions: string[];
  initial_hypothesis: string;
  key_uncertainties: string[];
  information_gaps: string[];
}

export async function projectDefinitionAgent(
  objective: string,
  constraints: string,
  onProgress: ProgressCallback = noopProgress
): Promise<ProjectDefinitionOutput> {
  onProgress("Starting Project Definition agent...", "status");
  if (!openai) {
    onProgress("Running in mock mode (no API key configured)", "status");
    const result: ProjectDefinitionOutput = {
      decision_statement: `Determine the optimal strategic approach to: ${objective}`,
      governing_question: `Should we pursue the proposed strategy in order to achieve ${objective}, given ${constraints || "current resource constraints"}, by the next 12-month planning cycle?`,
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
        budget: constraints?.includes("budget") ? constraints : "To be confirmed; assume moderate investment envelope",
        regulatory: "Standard industry compliance requirements apply",
        time: constraints?.includes("timeline") ? constraints : "Decision needed within current planning cycle",
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
    onProgress("Analysis complete. Generated project definition with " + result.success_metrics.length + " success metrics.", "status");
    return result;
  }

  const systemPrompt = await getAgentPrompt("project_definition");
  const { model, maxTokens, temperature, topP, presencePenalty, frequencyPenalty, stopSequences, retryCount } =
    await getAgentSettings("project_definition");

  onProgress(`Calling LLM with model ${model}...`, "llm");
  const userPrompt = `Project Objective: ${objective}\n\nConstraints & Context: ${constraints}`;
  const raw = await callLLM(systemPrompt, userPrompt, model, maxTokens, retryCount, {
    temperature,
    topP,
    presencePenalty,
    frequencyPenalty,
    stopSequences,
  });
  onProgress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  onProgress("Analysis complete. Generated project definition with " + (parsed.success_metrics?.length || 0) + " success metrics.", "status");
  return parsed;
}

const MAX_REVISIONS = 2;

export async function issuesTreeAgent(
  objective: string,
  constraints: string,
  onProgress: ProgressCallback = noopProgress
): Promise<{ issues: IssueNodeOutput[]; criticLog: { iteration: number; critic: CriticResult }[] }> {
  onProgress("Starting Issues Tree agent...", "status");
  if (!openai) {
    onProgress("Running in mock mode (no API key configured)", "status");
    const mockIssues: IssueNodeOutput[] = [
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
    const mockResult = {
      issues: mockIssues,
      criticLog: [{
        iteration: 0,
        critic: {
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
        },
      }],
    };
    onProgress("Analysis complete. Generated " + mockResult.issues.length + " issue nodes.", "status");
    return mockResult;
  }

  const generatorPrompt = await getAgentPrompt("issues_tree");
  const generatorSettings = await getAgentSettings("issues_tree");
  const criticPrompt = await getAgentPrompt("mece_critic");
  const criticSettings = await getAgentSettings("mece_critic");

  const baseUserPrompt = `Objective: ${objective}\nConstraints: ${constraints}`;
  const criticLog: { iteration: number; critic: CriticResult }[] = [];

  let currentTree: { issues: IssueNodeOutput[] };
  onProgress(`Calling LLM with model ${generatorSettings.model}...`, "llm");
  let raw = await callLLM(
    generatorPrompt,
    baseUserPrompt,
    generatorSettings.model,
    generatorSettings.maxTokens,
    generatorSettings.retryCount,
    {
      temperature: generatorSettings.temperature,
      topP: generatorSettings.topP,
      presencePenalty: generatorSettings.presencePenalty,
      frequencyPenalty: generatorSettings.frequencyPenalty,
      stopSequences: generatorSettings.stopSequences,
    }
  );
  onProgress("LLM response received, parsing output...", "llm");
  currentTree = extractJson(raw);

  for (let iteration = 0; iteration <= MAX_REVISIONS; iteration++) {
    onProgress(`Running MECE Critic evaluation (iteration ${iteration + 1})...`, "critic");
    const treeDescription = formatTreeForCritic(currentTree.issues, objective);
      const criticRaw = await callLLM(
        criticPrompt,
        treeDescription,
        criticSettings.model,
        criticSettings.maxTokens,
        criticSettings.retryCount,
        {
          temperature: criticSettings.temperature,
          topP: criticSettings.topP,
          presencePenalty: criticSettings.presencePenalty,
          frequencyPenalty: criticSettings.frequencyPenalty,
          stopSequences: criticSettings.stopSequences,
        }
      );

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
    onProgress(`Critic verdict: ${criticResult.verdict}, score: ${criticResult.overallScore}/5`, "critic");

    if (criticResult.verdict === "approved" || iteration === MAX_REVISIONS) {
      break;
    }

    onProgress("Revising tree based on critic feedback...", "critic");
    const revisionPrompt = `${baseUserPrompt}\n\n---\nPREVIOUS TREE (needs revision):\n${formatTreeForCritic(currentTree.issues, objective)}\n\n---\nMECE CRITIC FEEDBACK (iteration ${iteration + 1}):\nOverall Score: ${criticResult.overallScore}/5\nOverlap: ${criticResult.scores.overlap.score}/5 — ${criticResult.scores.overlap.details}\nCoverage: ${criticResult.scores.coverage.score}/5 — ${criticResult.scores.coverage.details}\nMixed Logics: ${criticResult.scores.mixedLogics.score}/5 — ${criticResult.scores.mixedLogics.details}\nBranch Balance: ${criticResult.scores.branchBalance.score}/5 — ${criticResult.scores.branchBalance.details}\nLabel Quality: ${criticResult.scores.labelQuality.score}/5 — ${criticResult.scores.labelQuality.details}\n\nREVISION INSTRUCTIONS:\n${criticResult.revisionInstructions}\n\nPlease produce a REVISED issues tree that addresses ALL the critic's feedback. Return the full tree in the same JSON format.`;

      raw = await callLLM(
        generatorPrompt,
        revisionPrompt,
        generatorSettings.model,
        generatorSettings.maxTokens,
        generatorSettings.retryCount,
        {
          temperature: generatorSettings.temperature,
          topP: generatorSettings.topP,
          presencePenalty: generatorSettings.presencePenalty,
          frequencyPenalty: generatorSettings.frequencyPenalty,
          stopSequences: generatorSettings.stopSequences,
        }
      );
    currentTree = extractJson(raw);
  }

  onProgress("Analysis complete. Generated " + currentTree.issues.length + " issue nodes.", "status");
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
  issues: { id: number; text: string; priority: string }[],
  onProgress: ProgressCallback = noopProgress
): Promise<{
  hypotheses: HypothesisOutput[];
  analysisPlan: AnalysisPlanOutput[];
}> {
  onProgress("Starting Hypothesis agent...", "status");
  if (!openai) {
    onProgress("Running in mock mode (no API key configured)", "status");
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

    onProgress("Analysis complete. Generated " + hyps.length + " hypotheses.", "status");
    return { hypotheses: hyps, analysisPlan: plans };
  }

  const issuesList = issues.map((i) => `- [ID:${i.id}] ${i.text} (${i.priority})`).join("\n");

  const systemPrompt = await getAgentPrompt("hypothesis");
  const settings = await getAgentSettings("hypothesis");

  onProgress(`Calling LLM with model ${settings.model}...`, "llm");
  const raw = await callLLM(
    systemPrompt,
    `Issues:\n${issuesList}`,
    settings.model,
    settings.maxTokens,
    settings.retryCount,
    {
      temperature: settings.temperature,
      topP: settings.topP,
      presencePenalty: settings.presencePenalty,
      frequencyPenalty: settings.frequencyPenalty,
      stopSequences: settings.stopSequences,
    }
  );
  onProgress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  onProgress("Analysis complete. Generated " + (parsed.hypotheses?.length || 0) + " hypotheses.", "status");
  return parsed;
}

export async function executionAgent(
  plans: { method: string; parameters: any; requiredDataset: string }[],
  onProgress: ProgressCallback = noopProgress
): Promise<{ toolName: string; inputs: ScenarioInput; outputs: ScenarioOutput }[]> {
  onProgress("Starting Execution agent...", "status");
  const results: { toolName: string; inputs: ScenarioInput; outputs: ScenarioOutput }[] = [];

  for (let idx = 0; idx < plans.length; idx++) {
    const plan = plans[idx];
    onProgress(`Running scenario ${idx + 1} of ${plans.length}...`, "status");
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

  onProgress("Analysis complete. Generated " + results.length + " scenario results.", "status");
  return results;
}

export async function summaryAgent(
  objective: string,
  constraints: string,
  hypotheses: { statement: string; metric: string }[],
  modelRuns: { inputsJson: any; outputsJson: any }[],
  onProgress: ProgressCallback = noopProgress
): Promise<{ summaryText: string }> {
  onProgress("Starting Summary agent...", "status");
  if (!openai) {
    onProgress("Running in mock mode (no API key configured)", "status");
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

    onProgress("Analysis complete. Generated executive summary.", "status");
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
  const settings = await getAgentSettings("summary");

  onProgress(`Calling LLM with model ${settings.model}...`, "llm");
  const userPrompt = `Objective: ${objective}\nConstraints: ${constraints}\n\nHypotheses & Results:\n${hypList}`;
  const summaryText = await callLLM(
    systemPrompt,
    userPrompt,
    settings.model,
    settings.maxTokens,
    settings.retryCount,
    {
      temperature: settings.temperature,
      topP: settings.topP,
      presencePenalty: settings.presencePenalty,
      frequencyPenalty: settings.frequencyPenalty,
      stopSequences: settings.stopSequences,
    }
  );
  onProgress("LLM response received, parsing output...", "llm");
  onProgress("Analysis complete. Generated executive summary.", "status");

  return { summaryText: summaryText || "Summary generation failed." };
}

export interface SlideOutput {
  slideIndex: number;
  layout: string;
  title: string;
  subtitle?: string | null;
  bodyJson: any;
  notesText?: string | null;
}

export async function presentationAgent(
  projectName: string,
  objective: string,
  summaryText: string,
  hypotheses: { statement: string; metric: string }[],
  modelRuns: { inputsJson: any; outputsJson: any }[],
  onProgress: ProgressCallback = noopProgress
): Promise<{ slides: SlideOutput[] }> {
  onProgress("Starting Presentation agent...", "status");
  if (!openai) {
    onProgress("Running in mock mode (no API key configured)", "status");
    const mockSlides: SlideOutput[] = [
      {
        slideIndex: 0,
        layout: "title_slide",
        title: projectName,
        subtitle: "Strategic Analysis & Recommendations",
        bodyJson: {},
        notesText: "Welcome and introductions",
      },
      {
        slideIndex: 1,
        layout: "section_header",
        title: "Executive Summary",
        subtitle: "Key findings from our analysis",
        bodyJson: {},
        notesText: "Transition to executive overview",
      },
      {
        slideIndex: 2,
        layout: "title_body",
        title: "Objective & Scope",
        subtitle: null,
        bodyJson: {
          bullets: [
            objective,
            "Multi-scenario financial modeling",
            "Risk-adjusted return analysis",
            "Data-driven recommendations",
          ],
        },
        notesText: "Review the project scope and analytical approach",
      },
      {
        slideIndex: 3,
        layout: "metrics",
        title: "Key Financial Metrics",
        subtitle: null,
        bodyJson: {
          metrics: (() => {
            const run = modelRuns[0]?.outputsJson?.summary;
            return [
              { label: "Expected NPV", value: run ? `$${(run.expectedValue / 1000).toFixed(0)}K` : "$850K", change: "+22%" },
              { label: "Best Case", value: run ? `$${(run.optimisticNpv / 1000).toFixed(0)}K` : "$1.2M", change: "Upside" },
              { label: "Risk-Adj Return", value: run ? `${run.riskAdjustedReturn}%` : "18%", change: "+5pp" },
            ];
          })(),
        },
        notesText: "Walk through each metric and its implications",
      },
      {
        slideIndex: 4,
        layout: "two_column",
        title: "Scenario Comparison",
        subtitle: null,
        bodyJson: {
          leftTitle: "Baseline Scenario",
          leftBullets: [
            "Conservative growth assumptions",
            "Moderate cost efficiencies",
            "Stable market conditions",
          ],
          rightTitle: "Optimistic Scenario",
          rightBullets: [
            "Accelerated market capture",
            "Full cost reduction realized",
            "Favorable competitive dynamics",
          ],
        },
        notesText: "Compare the two primary scenarios",
      },
      {
        slideIndex: 5,
        layout: "title_body",
        title: "Key Findings",
        subtitle: null,
        bodyJson: {
          bullets: hypotheses.slice(0, 4).map((h) =>
            h.statement.length > 60 ? h.statement.slice(0, 57) + "..." : h.statement
          ),
        },
        notesText: "Detail each hypothesis and supporting evidence",
      },
      {
        slideIndex: 6,
        layout: "title_body",
        title: "Recommendations",
        subtitle: null,
        bodyJson: {
          bullets: [
            "Proceed with phased implementation",
            "Prioritize highest-NPV initiatives",
            "Establish KPI tracking framework",
            "Conduct monthly progress reviews",
          ],
        },
        notesText: "Present the recommended course of action",
      },
      {
        slideIndex: 7,
        layout: "title_body",
        title: "Next Steps",
        subtitle: "30-60-90 Day Plan",
        bodyJson: {
          bullets: [
            "Days 1-30: Stakeholder alignment",
            "Days 31-60: Pilot program launch",
            "Days 61-90: Scale & optimize",
            "Ongoing: Monthly KPI review",
          ],
        },
        notesText: "Outline the implementation timeline",
      },
      {
        slideIndex: 8,
        layout: "section_header",
        title: "Thank You",
        subtitle: "Questions & Discussion",
        bodyJson: {},
        notesText: "Open floor for Q&A",
      },
    ];

    onProgress("Analysis complete. Generated " + mockSlides.length + " slides.", "status");
    return { slides: mockSlides };
  }

  const hypSummary = hypotheses
    .map((h, i) => {
      const run = modelRuns[i];
      const results = run?.outputsJson?.summary
        ? `NPV: $${run.outputsJson.summary.expectedValue?.toLocaleString()}, Risk-Adj Return: ${run.outputsJson.summary.riskAdjustedReturn}%`
        : "No results";
      return `- ${h.statement} (${h.metric}): ${results}`;
    })
    .join("\n");

  const systemPrompt = await getAgentPrompt("presentation");
  const settings = await getAgentSettings("presentation");

  onProgress(`Calling LLM with model ${settings.model}...`, "llm");
  const userPrompt = `Project: ${projectName}\nObjective: ${objective}\n\nExecutive Summary:\n${summaryText}\n\nHypotheses & Results:\n${hypSummary}`;
  const raw = await callLLM(
    systemPrompt,
    userPrompt,
    settings.model,
    settings.maxTokens,
    settings.retryCount,
    {
      temperature: settings.temperature,
      topP: settings.topP,
      presencePenalty: settings.presencePenalty,
      frequencyPenalty: settings.frequencyPenalty,
      stopSequences: settings.stopSequences,
    }
  );
  onProgress("LLM response received, parsing output...", "llm");
  const parsed = extractJson(raw);
  onProgress("Analysis complete. Generated " + (parsed.slides?.length || 0) + " slides.", "status");
  return parsed;
}

export async function refineDeliverable(
  agentKey: string,
  currentContent: any,
  userFeedback: string,
  projectContext: { objective: string; constraints: string },
  onProgress: ProgressCallback = () => {}
): Promise<any> {
  onProgress("Processing your feedback...", "progress");
  
  if (!openai) {
    onProgress("Applying feedback (mock mode)...", "progress");
    return currentContent;
  }

  const systemPrompt = await getAgentPrompt(agentKey);
  const settings = await getAgentSettings(agentKey);

  const refinementPrompt = `You previously generated the following output for this project:

Project Objective: ${projectContext.objective}
Constraints: ${projectContext.constraints}

Your previous output:
${JSON.stringify(currentContent, null, 2)}

The user has requested the following changes:
"${userFeedback}"

Please regenerate the COMPLETE output incorporating the user's feedback. Return the FULL updated output in the same JSON format as before. Do not return partial updates - return the entire revised document.`;

  onProgress(`Calling LLM with model ${settings.model} to refine output...`, "llm");
  const raw = await callLLM(
    systemPrompt,
    refinementPrompt,
    settings.model,
    settings.maxTokens,
    settings.retryCount,
    {
      temperature: settings.temperature,
      topP: settings.topP,
      presencePenalty: settings.presencePenalty,
      frequencyPenalty: settings.frequencyPenalty,
      stopSequences: settings.stopSequences,
    }
  );
  onProgress("LLM response received, parsing refined output...", "llm");
  
  const parsed = extractJson(raw);
  onProgress("Refinement complete.", "status");
  return parsed;
}

export { getModelUsed, runScenarioTool };
