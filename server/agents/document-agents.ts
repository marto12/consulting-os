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

export async function reviewDocument(doc: Document): Promise<DocumentComment[]> {
  try {
    const graph = new StateGraph(ReviewState)
      .addNode("analyze", async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
        if (!hasApiKey()) {
          const len = state.documentContent.length;
          const mockComments = [
            {
              from: 0,
              to: Math.min(20, len),
              content: "Consider strengthening the opening to better capture the reader's attention.",
              proposedText: state.documentContent.slice(0, Math.min(20, len)),
            },
            {
              from: Math.floor(len * 0.4),
              to: Math.min(Math.floor(len * 0.4) + 30, len),
              content: "This section could be more concise. Consider tightening the language.",
              proposedText: state.documentContent.slice(Math.floor(len * 0.4), Math.min(Math.floor(len * 0.4) + 30, len)),
            },
            {
              from: Math.max(0, len - 30),
              to: len,
              content: "The conclusion could be stronger. Consider ending with a clear call to action.",
              proposedText: state.documentContent.slice(Math.max(0, len - 30), len),
            },
          ];
          return { reviewComments: len > 0 ? mockComments : mockComments.slice(0, 2) };
        }

        const llm = createLLM()!;
        const systemPrompt = `You are a critical document reviewer. Analyze the provided text and identify areas for improvement including clarity, grammar, style, structure, and content quality.

Return a JSON array of review comments. Each comment must have:
- "from": character position where the issue starts (0-indexed)
- "to": character position where the issue ends
- "content": your review note explaining the issue
- "proposedText": the suggested replacement text for that range

Return ONLY valid JSON array. Example:
[{"from": 0, "to": 15, "content": "Weak opening", "proposedText": "A stronger opening"}]

Be specific with character positions. Identify 2-5 meaningful issues.`;

        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document Title: ${state.documentTitle}\n\nDocument Content:\n${state.documentContent}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        try {
          const parsed = extractJson(content);
          const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
          const validated = comments.map((c: any) => ({
            from: Math.max(0, Math.min(c.from || 0, state.documentContent.length)),
            to: Math.max(0, Math.min(c.to || 0, state.documentContent.length)),
            content: c.content || "Review comment",
            proposedText: c.proposedText || "",
          }));
          return { reviewComments: validated };
        } catch {
          return { reviewComments: [] };
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
    const graph = new StateGraph(ActionState)
      .addNode("plan", async (state: ActionStateType): Promise<Partial<ActionStateType>> => {
        if (!hasApiKey()) {
          const highlightedText = state.documentContent.slice(state.comment.from, state.comment.to);
          return {
            aiReply: `I've reviewed your comment: "${state.comment.content}". Here is a suggested revision for the highlighted text.`,
            proposedText: highlightedText ? `[Revised] ${highlightedText}` : "Suggested replacement text",
          };
        }

        const llm = createLLM()!;
        const highlightedText = state.documentContent.slice(state.comment.from, state.comment.to);
        const systemPrompt = `You are a document editing assistant. A user has left a comment on a specific part of a document. Your job is to propose a specific text change that addresses the comment.

Return a JSON object with:
- "aiReply": A brief explanation of what you changed and why
- "proposedText": The replacement text for the highlighted range

Return ONLY valid JSON. Example:
{"aiReply": "I rephrased this for clarity.", "proposedText": "The improved text here"}`;

        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document content:\n${state.documentContent}\n\nHighlighted text (positions ${state.comment.from}-${state.comment.to}):\n"${highlightedText}"\n\nUser comment: ${state.comment.content}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        try {
          const parsed = extractJson(content);
          return {
            aiReply: parsed.aiReply || "Here is my suggested revision.",
            proposedText: parsed.proposedText || highlightedText,
          };
        } catch {
          return {
            aiReply: "I've reviewed the comment and suggest a revision.",
            proposedText: highlightedText,
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
