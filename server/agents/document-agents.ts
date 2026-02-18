import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { storage } from "../storage";
import type { Document, DocumentComment } from "@shared/schema";

function hasApiKey(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  );
}

const DEFAULT_MODEL = "gpt-5-nano";

function createLLM(): ChatOpenAI | null {
  if (!hasApiKey()) return null;
  return new ChatOpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    },
    modelName: DEFAULT_MODEL,
    maxTokens: 4096,
  });
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }
  const objMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {}
  }
  return JSON.parse(text);
}

function generateMockReviewComments(documentContent: string) {
  const len = documentContent.length;
  if (len === 0) return [];
  return [
    {
      from: 1,
      to: Math.min(20, Math.max(2, len)),
      content: "Consider strengthening the opening to better capture the reader's attention.",
      proposedText: documentContent.replace(/<[^>]*>/g, "").slice(0, 20),
    },
    {
      from: Math.max(1, Math.floor(len * 0.4)),
      to: Math.min(Math.floor(len * 0.4) + 30, Math.max(2, len)),
      content: "This section could be more concise. Consider tightening the language.",
      proposedText: documentContent.replace(/<[^>]*>/g, "").slice(Math.floor(len * 0.3), Math.floor(len * 0.3) + 20),
    },
    {
      from: Math.max(1, len - 30),
      to: Math.max(2, len),
      content: "The conclusion could be stronger. Consider ending with a clear call to action.",
      proposedText: documentContent.replace(/<[^>]*>/g, "").slice(-20),
    },
  ];
}

const ReviewState = Annotation.Root({
  documentContent: Annotation<string>,
  documentTitle: Annotation<string>,
  documentId: Annotation<number>,
  reviewComments: Annotation<Array<{ from: number; to: number; content: string; proposedText: string }>>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  savedComments: Annotation<DocumentComment[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
});

type ReviewStateType = typeof ReviewState.State;

const ActionState = Annotation.Root({
  documentContent: Annotation<string>,
  documentId: Annotation<number>,
  comment: Annotation<DocumentComment>,
  aiReply: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  proposedText: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  updatedComment: Annotation<DocumentComment | null>({ reducer: (_, b) => b, default: () => null }),
});

type ActionStateType = typeof ActionState.State;

function generateMockExecutiveReviewComments(documentContent: string) {
  const len = documentContent.length;
  if (len === 0) return [];
  const plainText = documentContent.replace(/<[^>]*>/g, "");
  return [
    {
      from: 1,
      to: Math.min(40, Math.max(2, len)),
      content: "Missing 'so what': This section jumps straight into details without framing why the reader should care. Lead with the strategic implication or business impact before explaining the how.",
      proposedText: plainText.slice(0, 30),
    },
    {
      from: Math.max(1, Math.floor(len * 0.3)),
      to: Math.min(Math.floor(len * 0.3) + 50, Math.max(2, len)),
      content: "Too technical too early: This dives into implementation specifics before establishing the strategic context. An executive reader needs to understand the decision at stake and its impact before the supporting analysis.",
      proposedText: plainText.slice(Math.floor(len * 0.25), Math.floor(len * 0.25) + 30),
    },
    {
      from: Math.max(1, Math.floor(len * 0.6)),
      to: Math.min(Math.floor(len * 0.6) + 50, Math.max(2, len)),
      content: "Weak strategic framing: This reads like a technical report rather than a strategic recommendation. Rewrite to lead with the insight and what action the reader should take, then support with evidence.",
      proposedText: plainText.slice(Math.floor(len * 0.55), Math.floor(len * 0.55) + 30),
    },
  ];
}

let _reviewGraph: any = null;
let _actionGraph: any = null;
let _executiveReviewGraph: any = null;

function getReviewGraph() {
  if (_reviewGraph) return _reviewGraph;
  _reviewGraph = new StateGraph(ReviewState)
    .addNode("analyze", async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      if (!hasApiKey()) {
        return { reviewComments: generateMockReviewComments(state.documentContent) };
      }

      const llm = createLLM()!;
      const systemPrompt = `You are a critical document reviewer. Analyze the provided text and identify areas for improvement including clarity, grammar, style, structure, and content quality.

Return a JSON array of review comments. Each comment must have:
- "from": character position where the issue starts (1-indexed, matching ProseMirror positions)
- "to": character position where the issue ends
- "content": your review note explaining the issue
- "proposedText": the suggested replacement text for that range

Return ONLY valid JSON array. Example:
[{"from": 1, "to": 15, "content": "Weak opening", "proposedText": "A stronger opening"}]

Be specific with character positions. Identify 2-5 meaningful issues.`;

      try {
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document Title: ${state.documentTitle}\n\nDocument Content:\n${state.documentContent}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        if (!content || content.trim().length === 0) {
          return { reviewComments: generateMockReviewComments(state.documentContent) };
        }

        const parsed = extractJson(content);
        const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
        const validated = comments.map((c: any) => ({
          from: Math.max(1, Math.min(c.from || 1, state.documentContent.length)),
          to: Math.max(1, Math.min(c.to || 1, state.documentContent.length)),
          content: c.content || "Review comment",
          proposedText: c.proposedText || "",
        }));
        return { reviewComments: validated.length > 0 ? validated : generateMockReviewComments(state.documentContent) };
      } catch (e) {
        console.error("LLM review error, falling back to mock:", e);
        return { reviewComments: generateMockReviewComments(state.documentContent) };
      }
    })
    .addNode("persist", async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      const saved: DocumentComment[] = [];
      for (const rc of state.reviewComments) {
        const comment = await storage.createComment({
          documentId: state.documentId,
          from: rc.from,
          to: rc.to,
          content: rc.content,
          type: "ai",
          proposedText: rc.proposedText,
        });
        saved.push(comment);
      }
      return { savedComments: saved };
    })
    .addEdge(START, "analyze")
    .addEdge("analyze", "persist")
    .addEdge("persist", END)
    .compile();
  return _reviewGraph;
}

function getActionGraph() {
  if (_actionGraph) return _actionGraph;
  _actionGraph = new StateGraph(ActionState)
    .addNode("plan", async (state: ActionStateType): Promise<Partial<ActionStateType>> => {
      const highlightedText = state.documentContent.slice(state.comment.from, state.comment.to);

      if (!hasApiKey()) {
        return {
          aiReply: `I've reviewed your comment: "${state.comment.content}". Here is a suggested revision for the highlighted text.`,
          proposedText: highlightedText ? `[Revised] ${highlightedText}` : "Suggested replacement text",
        };
      }

      const llm = createLLM()!;
      const systemPrompt = `You are a document editing assistant. A user has left a comment on a specific part of a document. Your job is to propose a specific text change that addresses the comment.

Return a JSON object with:
- "aiReply": A brief explanation of what you changed and why
- "proposedText": The replacement text for the highlighted range

Return ONLY valid JSON. Example:
{"aiReply": "I rephrased this for clarity.", "proposedText": "The improved text here"}`;

      try {
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document content:\n${state.documentContent}\n\nHighlighted text (positions ${state.comment.from}-${state.comment.to}):\n"${highlightedText}"\n\nUser comment: ${state.comment.content}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        if (!content || content.trim().length === 0) {
          return {
            aiReply: `I've reviewed your comment: "${state.comment.content}". Here is a suggested revision.`,
            proposedText: highlightedText ? `[Revised] ${highlightedText}` : "Suggested replacement text",
          };
        }

        const parsed = extractJson(content);
        return {
          aiReply: parsed.aiReply || "Here is my suggested revision.",
          proposedText: parsed.proposedText || highlightedText,
        };
      } catch {
        return {
          aiReply: "I've reviewed the comment and suggest a revision.",
          proposedText: highlightedText || "Suggested replacement text",
        };
      }
    })
    .addNode("persist", async (state: ActionStateType): Promise<Partial<ActionStateType>> => {
      const updated = await storage.updateComment(state.comment.id, {
        aiReply: state.aiReply,
        proposedText: state.proposedText,
      });
      return { updatedComment: updated };
    })
    .addEdge(START, "plan")
    .addEdge("plan", "persist")
    .addEdge("persist", END)
    .compile();
  return _actionGraph;
}

function getExecutiveReviewGraph() {
  if (_executiveReviewGraph) return _executiveReviewGraph;
  _executiveReviewGraph = new StateGraph(ReviewState)
    .addNode("analyze", async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      if (!hasApiKey()) {
        return { reviewComments: generateMockExecutiveReviewComments(state.documentContent) };
      }

      const llm = createLLM()!;
      const systemPrompt = `You are a senior consulting partner reviewing a document through an executive lens. Your job is to identify sections that fail the "so what" test — places where the writing dives into technical details, methodology, or implementation specifics without first establishing WHY the reader should care.

Your review criteria:
1. **Missing "So What"**: Flag sections that present findings or data without stating the strategic implication. Every paragraph should answer "why does this matter to the decision-maker?"
2. **Technical Too Early**: Identify where the document leads with methodology, technical architecture, data pipelines, algorithms, or implementation details before establishing the business context or strategic framing.
3. **Buried Insight**: Call out when the key insight or recommendation is buried at the end of a dense paragraph instead of leading with it.
4. **No Action Orientation**: Flag sections that describe what was done or found but fail to state what the reader should DO with this information.
5. **Audience Mismatch**: Identify language, jargon, or detail level that assumes a technical audience when the document should be written for executives or decision-makers.

For each issue, propose a rewritten version that:
- Leads with the strategic implication or business impact
- States the "so what" upfront
- Moves technical details to supporting evidence rather than the lead
- Ends with a clear recommendation or next step

Return a JSON array of review comments. Each comment must have:
- "from": character position where the issue starts (1-indexed, matching ProseMirror positions)
- "to": character position where the issue ends
- "content": your executive review note — start with a category label like "Missing 'so what':", "Too technical too early:", "Buried insight:", "No action orientation:", or "Audience mismatch:"
- "proposedText": the suggested rewrite that leads with strategic framing

Return ONLY valid JSON array. Identify 2-5 meaningful issues.`;

      try {
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document Title: ${state.documentTitle}\n\nDocument Content:\n${state.documentContent}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        if (!content || content.trim().length === 0) {
          return { reviewComments: generateMockExecutiveReviewComments(state.documentContent) };
        }

        const parsed = extractJson(content);
        const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
        const validated = comments.map((c: any) => ({
          from: Math.max(1, Math.min(c.from || 1, state.documentContent.length)),
          to: Math.max(1, Math.min(c.to || 1, state.documentContent.length)),
          content: c.content || "Executive review comment",
          proposedText: c.proposedText || "",
        }));
        return { reviewComments: validated.length > 0 ? validated : generateMockExecutiveReviewComments(state.documentContent) };
      } catch (e) {
        console.error("LLM executive review error, falling back to mock:", e);
        return { reviewComments: generateMockExecutiveReviewComments(state.documentContent) };
      }
    })
    .addNode("persist", async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      const saved: DocumentComment[] = [];
      for (const rc of state.reviewComments) {
        const comment = await storage.createComment({
          documentId: state.documentId,
          from: rc.from,
          to: rc.to,
          content: rc.content,
          type: "executive",
          proposedText: rc.proposedText,
        });
        saved.push(comment);
      }
      return { savedComments: saved };
    })
    .addEdge(START, "analyze")
    .addEdge("analyze", "persist")
    .addEdge("persist", END)
    .compile();
  return _executiveReviewGraph;
}

export async function executiveReviewDocument(doc: Document): Promise<DocumentComment[]> {
  try {
    const graph = getExecutiveReviewGraph();

    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentTitle: doc.title || "",
      documentId: doc.id,
    });

    return result.savedComments;
  } catch (error) {
    console.error("executiveReviewDocument error:", error);
    return [];
  }
}

export async function reviewDocument(doc: Document): Promise<DocumentComment[]> {
  try {
    const graph = getReviewGraph();

    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentTitle: doc.title || "",
      documentId: doc.id,
    });

    return result.savedComments;
  } catch (error) {
    console.error("reviewDocument error:", error);
    return [];
  }
}

export async function actionComment(doc: Document, comment: DocumentComment): Promise<DocumentComment> {
  try {
    const graph = getActionGraph();

    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentId: doc.id,
      comment,
    });

    return result.updatedComment || comment;
  } catch (error) {
    console.error("actionComment error:", error);
    return comment;
  }
}
