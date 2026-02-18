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

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'blockquote',
  'li', 'ul', 'ol', 'pre', 'section', 'article', 'header', 'footer',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);
const VOID_TAGS = new Set(['hr', 'br', 'img']);

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

interface PositionMap {
  plainText: string;
  map: number[];
}

function buildPositionMap(html: string): PositionMap {
  const plainChars: string[] = [];
  const posMap: number[] = [];
  let pmPos = 0;
  let i = 0;
  let lastWasBlock = false;

  while (i < html.length) {
    if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) break;

      const tagContent = html.substring(i + 1, tagEnd);
      const isClosing = tagContent.startsWith('/');
      const tagNameMatch = tagContent.match(/^\/?([a-zA-Z][a-zA-Z0-9]*)/);
      const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';

      if (VOID_TAGS.has(tagName)) {
        pmPos += 1;
        if (tagName === 'br' && plainChars.length > 0) {
          plainChars.push('\n');
          posMap.push(pmPos - 1);
        }
      } else if (BLOCK_TAGS.has(tagName)) {
        if (isClosing) {
          if (plainChars.length > 0) {
            plainChars.push('\n');
            posMap.push(pmPos);
          }
          pmPos += 1;
          lastWasBlock = true;
        } else {
          pmPos += 1;
          lastWasBlock = true;
        }
      }

      i = tagEnd + 1;
    } else if (html[i] === '&') {
      const entityEnd = html.indexOf(';', i);
      if (entityEnd !== -1 && entityEnd - i < 10) {
        const entity = html.substring(i, entityEnd + 1);
        const decoded = decodeEntities(entity);
        for (const ch of decoded) {
          posMap.push(pmPos);
          plainChars.push(ch);
          pmPos++;
        }
        i = entityEnd + 1;
      } else {
        posMap.push(pmPos);
        plainChars.push(html[i]);
        pmPos++;
        i++;
      }
    } else {
      lastWasBlock = false;
      posMap.push(pmPos);
      plainChars.push(html[i]);
      pmPos++;
      i++;
    }
  }

  return { plainText: plainChars.join(''), map: posMap };
}

function findQuotedTextPosition(
  quotedText: string,
  plainText: string,
  map: number[]
): { from: number; to: number } | null {
  if (!quotedText || !plainText || map.length === 0) return null;

  const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim();
  const nQuote = normalizeWs(quotedText);
  if (nQuote.length === 0) return null;

  const nPlain = normalizeWs(plainText);

  const nPlainToOriginal: number[] = [];
  let origIdx = 0;
  let nIdx = 0;
  const tempPlain = plainText;
  for (let ci = 0; ci < tempPlain.length; ci++) {
    if (/\s/.test(tempPlain[ci])) {
      if (nIdx < nPlain.length && nPlain[nIdx] === ' ') {
        nPlainToOriginal.push(ci);
        nIdx++;
      }
    } else {
      if (nIdx < nPlain.length) {
        nPlainToOriginal.push(ci);
        nIdx++;
      }
    }
  }

  let searchIdx = nPlain.toLowerCase().indexOf(nQuote.toLowerCase());
  if (searchIdx >= 0) {
    const origStart = nPlainToOriginal[searchIdx];
    const origEnd = nPlainToOriginal[searchIdx + nQuote.length - 1];
    if (origStart !== undefined && origEnd !== undefined && origStart < map.length && origEnd < map.length) {
      return { from: map[origStart], to: map[origEnd] + 1 };
    }
  }

  const words = nQuote.split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 2) {
    const firstWord = words[0].toLowerCase();
    const lastWord = words[words.length - 1].toLowerCase();
    const nPlainLower = nPlain.toLowerCase();

    const firstIdx = nPlainLower.indexOf(firstWord);
    if (firstIdx >= 0) {
      const searchFrom = firstIdx + firstWord.length;
      const lastIdx = nPlainLower.indexOf(lastWord, searchFrom);
      if (lastIdx >= 0) {
        const origStart = nPlainToOriginal[firstIdx];
        const origEnd = nPlainToOriginal[lastIdx + lastWord.length - 1];
        if (origStart !== undefined && origEnd !== undefined && origStart < map.length && origEnd < map.length) {
          return { from: map[origStart], to: map[origEnd] + 1 };
        }
      }

      const origStart = nPlainToOriginal[firstIdx];
      const origEnd = nPlainToOriginal[firstIdx + firstWord.length - 1];
      if (origStart !== undefined && origEnd !== undefined && origStart < map.length && origEnd < map.length) {
        return { from: map[origStart], to: map[origEnd] + 1 };
      }
    }
  }

  return null;
}

function resolvePositions(
  comments: Array<{ quotedText?: string; from?: number; to?: number; content: string; proposedText?: string }>,
  html: string
): Array<{ from: number; to: number; content: string; proposedText: string }> {
  const { plainText, map } = buildPositionMap(html);
  const docSize = map.length > 0 ? map[map.length - 1] + 1 : 1;

  return comments.map(c => {
    if (c.quotedText) {
      const pos = findQuotedTextPosition(c.quotedText, plainText, map);
      if (pos) {
        return { from: pos.from, to: pos.to, content: c.content, proposedText: c.proposedText || "" };
      }
    }
    return {
      from: Math.max(1, Math.min(c.from || 1, docSize)),
      to: Math.max(2, Math.min(c.to || 2, docSize)),
      content: c.content,
      proposedText: c.proposedText || "",
    };
  });
}

function getPlainText(html: string): string {
  return buildPositionMap(html).plainText.replace(/\n+/g, '\n').trim();
}

function generateMockReviewComments(html: string) {
  const { plainText, map } = buildPositionMap(html);
  if (plainText.length === 0 || map.length === 0) return [];

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const results: Array<{ from: number; to: number; content: string; proposedText: string }> = [];

  if (sentences.length > 0) {
    const pos = findQuotedTextPosition(sentences[0], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Consider strengthening the opening to better capture the reader's attention.",
        proposedText: sentences[0],
      });
    }
  }

  if (sentences.length > 2) {
    const mid = Math.floor(sentences.length / 2);
    const pos = findQuotedTextPosition(sentences[mid], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "This section could be more concise. Consider tightening the language.",
        proposedText: sentences[mid],
      });
    }
  }

  if (sentences.length > 1) {
    const last = sentences[sentences.length - 1];
    const pos = findQuotedTextPosition(last, plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "The conclusion could be stronger. Consider ending with a clear call to action.",
        proposedText: last,
      });
    }
  }

  return results.length > 0 ? results : [{
    from: map[0],
    to: map[Math.min(map.length - 1, 20)] + 1,
    content: "Consider revising this opening section.",
    proposedText: plainText.slice(0, 20),
  }];
}

function generateMockExecutiveReviewComments(html: string) {
  const { plainText, map } = buildPositionMap(html);
  if (plainText.length === 0 || map.length === 0) return [];

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const results: Array<{ from: number; to: number; content: string; proposedText: string }> = [];

  if (sentences.length > 0) {
    const pos = findQuotedTextPosition(sentences[0], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Missing 'so what': This section jumps straight into details without framing why the reader should care. Lead with the strategic implication or business impact before explaining the how.",
        proposedText: sentences[0],
      });
    }
  }

  if (sentences.length > 2) {
    const mid = Math.floor(sentences.length / 3);
    const pos = findQuotedTextPosition(sentences[mid], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Too technical too early: This dives into implementation specifics before establishing the strategic context. An executive reader needs to understand the decision at stake and its impact before the supporting analysis.",
        proposedText: sentences[mid],
      });
    }
  }

  if (sentences.length > 3) {
    const mid2 = Math.floor(sentences.length * 2 / 3);
    const pos = findQuotedTextPosition(sentences[mid2], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Weak strategic framing: This reads like a technical report rather than a strategic recommendation. Rewrite to lead with the insight and what action the reader should take, then support with evidence.",
        proposedText: sentences[mid2],
      });
    }
  }

  return results.length > 0 ? results : [{
    from: map[0],
    to: map[Math.min(map.length - 1, 30)] + 1,
    content: "Missing 'so what': This opening needs strategic framing.",
    proposedText: plainText.slice(0, 30),
  }];
}

function generateMockFactCheckCandidates(html: string) {
  const { plainText, map } = buildPositionMap(html);
  if (plainText.length === 0 || map.length === 0) return [];

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const results: Array<{ from: number; to: number; content: string }> = [];

  if (sentences.length > 0) {
    const pos = findQuotedTextPosition(sentences[0], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Potential unsubstantiated claim: This statement makes an assertion that may need a source or supporting evidence to verify its accuracy.",
      });
    }
  }

  if (sentences.length > 2) {
    const mid = Math.floor(sentences.length / 2);
    const pos = findQuotedTextPosition(sentences[mid], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Contains a specific figure or statistic: This number should be verified against the original data source to confirm accuracy.",
      });
    }
  }

  if (sentences.length > 3) {
    const late = Math.floor(sentences.length * 0.7);
    const pos = findQuotedTextPosition(sentences[late], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Broad generalization: This claim is stated as fact but may be opinion or an oversimplification that requires qualification.",
      });
    }
  }

  return results.length > 0 ? results : [{
    from: map[0],
    to: map[Math.min(map.length - 1, 30)] + 1,
    content: "Potential unsubstantiated claim: This statement needs verification.",
  }];
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

const FactCheckState = Annotation.Root({
  documentContent: Annotation<string>,
  documentTitle: Annotation<string>,
  documentId: Annotation<number>,
  candidates: Annotation<Array<{ from: number; to: number; content: string }>>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  savedComments: Annotation<DocumentComment[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
});

type FactCheckStateType = typeof FactCheckState.State;

const FactCheckRunState = Annotation.Root({
  documentContent: Annotation<string>,
  documentId: Annotation<number>,
  acceptedCandidates: Annotation<DocumentComment[]>,
  results: Annotation<DocumentComment[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
});

type FactCheckRunStateType = typeof FactCheckRunState.State;

function generateMockNarrativeComments(html: string) {
  const { plainText, map } = buildPositionMap(html);
  if (plainText.length === 0 || map.length === 0) return [];

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const results: Array<{ from: number; to: number; content: string; proposedText: string }> = [];

  if (sentences.length > 0) {
    const pos = findQuotedTextPosition(sentences[0], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Key narrative: This is a core claim that anchors the document's argument. Consider elevating it as an executive takeaway: what decision does it drive?",
        proposedText: `Key point: ${sentences[0]}`,
      });
    }
  }

  if (sentences.length > 2) {
    const mid = Math.floor(sentences.length / 2);
    const pos = findQuotedTextPosition(sentences[mid], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Supporting evidence: This section contains important data that backs the main argument. Distill the insight into one executive-level sentence.",
        proposedText: `Supporting insight: ${sentences[mid]}`,
      });
    }
  }

  if (sentences.length > 3) {
    const late = Math.floor(sentences.length * 0.75);
    const pos = findQuotedTextPosition(sentences[late], plainText, map);
    if (pos) {
      results.push({
        ...pos,
        content: "Action driver: This statement implies a decision or next step. Make the recommended action explicit for the reader.",
        proposedText: `Recommended action: ${sentences[late]}`,
      });
    }
  }

  return results.length > 0 ? results : [{
    from: map[0],
    to: map[Math.min(map.length - 1, 30)] + 1,
    content: "Key narrative: Extract the main executive takeaway from this section.",
    proposedText: plainText.slice(0, 30),
  }];
}

let _reviewGraph: any = null;
let _actionGraph: any = null;
let _executiveReviewGraph: any = null;
let _factCheckCandidateGraph: any = null;
let _factCheckRunGraph: any = null;
let _narrativeGraph: any = null;

function getReviewGraph() {
  if (_reviewGraph) return _reviewGraph;
  _reviewGraph = new StateGraph(ReviewState)
    .addNode("analyze", async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      if (!hasApiKey()) {
        return { reviewComments: generateMockReviewComments(state.documentContent) };
      }

      const plainText = getPlainText(state.documentContent);
      const llm = createLLM()!;
      const systemPrompt = `You are a critical document reviewer. Analyze the provided text and identify areas for improvement including clarity, grammar, style, structure, and content quality.

Return a JSON array of review comments. Each comment must have:
- "quotedText": the EXACT text from the document that you are commenting on (copy it verbatim — this is used to locate the comment in the document)
- "content": your review note explaining the issue
- "proposedText": the suggested replacement text for that section

Return ONLY valid JSON array. Example:
[{"quotedText": "the quick brown fox jumps", "content": "Weak opening", "proposedText": "A stronger opening sentence here"}]

IMPORTANT: The "quotedText" must be an exact substring from the document text. Copy it character-for-character. Do NOT paraphrase or abbreviate it. Include enough words to be unique (at least 5-10 words).

Identify 2-5 meaningful issues.`;

      try {
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document Title: ${state.documentTitle}\n\nDocument Content:\n${plainText}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        if (!content || content.trim().length === 0) {
          return { reviewComments: generateMockReviewComments(state.documentContent) };
        }

        const parsed = extractJson(content);
        const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
        const resolved = resolvePositions(comments, state.documentContent);
        return { reviewComments: resolved.length > 0 ? resolved : generateMockReviewComments(state.documentContent) };
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
      const { plainText, map } = buildPositionMap(state.documentContent);
      const from = state.comment.from;
      const to = state.comment.to;

      let highlightedText = "";
      for (let i = 0; i < map.length; i++) {
        if (map[i] >= from && map[i] < to) {
          highlightedText += plainText[i];
        }
      }
      highlightedText = highlightedText.trim();

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
        const fullPlainText = getPlainText(state.documentContent);
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document content:\n${fullPlainText}\n\nHighlighted text:\n"${highlightedText}"\n\nUser comment: ${state.comment.content}`),
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

      const plainText = getPlainText(state.documentContent);
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
- "quotedText": the EXACT text from the document that you are commenting on (copy it verbatim — this is used to locate the comment in the document)
- "content": your executive review note — start with a category label like "Missing 'so what':", "Too technical too early:", "Buried insight:", "No action orientation:", or "Audience mismatch:"
- "proposedText": the suggested rewrite that leads with strategic framing

IMPORTANT: The "quotedText" must be an exact substring from the document text. Copy it character-for-character. Do NOT paraphrase or abbreviate it. Include enough words to be unique (at least 5-10 words).

Return ONLY valid JSON array. Identify 2-5 meaningful issues.`;

      try {
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document Title: ${state.documentTitle}\n\nDocument Content:\n${plainText}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        if (!content || content.trim().length === 0) {
          return { reviewComments: generateMockExecutiveReviewComments(state.documentContent) };
        }

        const parsed = extractJson(content);
        const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
        const resolved = resolvePositions(comments, state.documentContent);
        return { reviewComments: resolved.length > 0 ? resolved : generateMockExecutiveReviewComments(state.documentContent) };
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

function getFactCheckCandidateGraph() {
  if (_factCheckCandidateGraph) return _factCheckCandidateGraph;
  _factCheckCandidateGraph = new StateGraph(FactCheckState)
    .addNode("spot", async (state: FactCheckStateType): Promise<Partial<FactCheckStateType>> => {
      if (!hasApiKey()) {
        return { candidates: generateMockFactCheckCandidates(state.documentContent) };
      }

      const plainText = getPlainText(state.documentContent);
      const llm = createLLM()!;
      const systemPrompt = `You are a fact-checking analyst. Your job is to scan a document and identify statements, claims, statistics, or assertions that should be fact-checked. Look for:

1. **Specific statistics or numbers** — e.g. "revenue grew 40%", "47 microservices", "120ms latency"
2. **Unsubstantiated claims** — assertions stated as fact without citing a source
3. **Bold or sweeping generalizations** — e.g. "the best in the industry", "always leads to"
4. **Historical or factual claims** — dates, events, attributions that could be wrong
5. **Causal claims** — statements implying cause and effect without evidence

Do NOT flag opinions clearly marked as opinions, or obvious rhetorical devices.

Return a JSON array of candidate items. Each must have:
- "quotedText": the EXACT text from the document that contains the claim (copy it verbatim — this is used to locate the claim in the document)
- "content": a brief note explaining WHY this should be fact-checked (start with a category like "Statistic:", "Unsubstantiated claim:", "Generalization:", "Causal claim:", or "Historical claim:")

IMPORTANT: The "quotedText" must be an exact substring from the document text. Copy it character-for-character. Do NOT paraphrase or abbreviate it. Include enough words to be unique (at least 5-10 words).

Return ONLY valid JSON array. Identify 2-6 candidates.`;

      try {
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document Title: ${state.documentTitle}\n\nDocument Content:\n${plainText}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        if (!content || content.trim().length === 0) {
          return { candidates: generateMockFactCheckCandidates(state.documentContent) };
        }

        const parsed = extractJson(content);
        const items = Array.isArray(parsed) ? parsed : parsed.candidates || parsed.comments || [];
        const resolved = resolvePositions(items, state.documentContent).map(r => ({
          from: r.from, to: r.to, content: r.content,
        }));
        return { candidates: resolved.length > 0 ? resolved : generateMockFactCheckCandidates(state.documentContent) };
      } catch (e) {
        console.error("LLM factcheck candidate error, falling back to mock:", e);
        return { candidates: generateMockFactCheckCandidates(state.documentContent) };
      }
    })
    .addNode("persist", async (state: FactCheckStateType): Promise<Partial<FactCheckStateType>> => {
      const saved: DocumentComment[] = [];
      for (const c of state.candidates) {
        const comment = await storage.createComment({
          documentId: state.documentId,
          from: c.from,
          to: c.to,
          content: c.content,
          type: "factcheck",
          proposedText: "",
        });
        saved.push(comment);
      }
      return { savedComments: saved };
    })
    .addEdge(START, "spot")
    .addEdge("spot", "persist")
    .addEdge("persist", END)
    .compile();
  return _factCheckCandidateGraph;
}

function getFactCheckRunGraph() {
  if (_factCheckRunGraph) return _factCheckRunGraph;
  _factCheckRunGraph = new StateGraph(FactCheckRunState)
    .addNode("check", async (state: FactCheckRunStateType): Promise<Partial<FactCheckRunStateType>> => {
      const updatedComments: DocumentComment[] = [];
      const { plainText, map } = buildPositionMap(state.documentContent);
      const fullPlainText = getPlainText(state.documentContent);

      for (const candidate of state.acceptedCandidates) {
        let highlightedText = "";
        for (let i = 0; i < map.length; i++) {
          if (map[i] >= candidate.from && map[i] < candidate.to) {
            highlightedText += plainText[i];
          }
        }
        highlightedText = highlightedText.trim();

        let verdict = "";

        if (!hasApiKey()) {
          verdict = `Fact check result: The claim "${highlightedText.slice(0, 50)}${highlightedText.length > 50 ? '...' : ''}" appears to be a reasonable assertion but could not be independently verified. Recommend adding a source citation to strengthen credibility.`;
        } else {
          const llm = createLLM()!;
          const systemPrompt = `You are a rigorous fact-checker. You are given a specific claim or statement from a document. Your job is to assess its accuracy.

Evaluate the claim and return a JSON object with:
- "verdict": One of "Verified", "Likely Accurate", "Unverifiable", "Misleading", or "Inaccurate"
- "explanation": A clear 2-3 sentence explanation of your assessment. Include what you found, why you reached this conclusion, and any caveats.
- "recommendation": A brief suggestion (e.g. "Add source citation", "Rephrase to qualify the claim", "Remove or correct this figure")

Return ONLY valid JSON.`;

          try {
            const response = await llm.invoke([
              new SystemMessage(systemPrompt),
              new HumanMessage(`Claim to fact-check: "${highlightedText}"\n\nOriginal reviewer note: ${candidate.content}\n\nFull document context:\n${fullPlainText}`),
            ]);

            const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

            if (content && content.trim().length > 0) {
              try {
                const parsed = extractJson(content);
                verdict = `[${parsed.verdict || "Reviewed"}] ${parsed.explanation || "Review complete."} Recommendation: ${parsed.recommendation || "No specific recommendation."}`;
              } catch {
                verdict = content.trim().slice(0, 500);
              }
            } else {
              verdict = `Fact check result: The claim "${highlightedText.slice(0, 50)}${highlightedText.length > 50 ? '...' : ''}" could not be independently verified at this time. Consider adding a source citation.`;
            }
          } catch (e) {
            console.error("LLM fact check error for candidate:", candidate.id, e);
            verdict = `Fact check result: Unable to verify this claim at this time. Manual verification recommended.`;
          }
        }

        const updated = await storage.updateComment(candidate.id, {
          aiReply: verdict,
          status: "accepted",
        });
        updatedComments.push(updated);
      }

      return { results: updatedComments };
    })
    .addEdge(START, "check")
    .addEdge("check", END)
    .compile();
  return _factCheckRunGraph;
}

function getNarrativeGraph() {
  if (_narrativeGraph) return _narrativeGraph;
  _narrativeGraph = new StateGraph(ReviewState)
    .addNode("analyze", async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      if (!hasApiKey()) {
        return { reviewComments: generateMockNarrativeComments(state.documentContent) };
      }

      const plainText = getPlainText(state.documentContent);
      const llm = createLLM()!;
      const systemPrompt = `You are a senior strategy consultant who distills complex, technical prose into executive-level key points. Your job is to read the document and identify the core narrative threads — the key messages an executive needs to take away.

For each section of the document that contains dense or technical content, you must:
1. **Extract the key point** — What is the one sentence an executive needs to remember from this section? Strip away jargon, methodology, and implementation detail. Surface the strategic insight, the business implication, or the decision it supports.
2. **Identify the narrative role** — Label each key point with its role in the overall argument:
   - "Core thesis": The central claim or recommendation the document makes
   - "Supporting evidence": Data or analysis that backs the core thesis
   - "Risk / caveat": An important qualification, risk, or trade-off the executive should know
   - "Action driver": A finding that directly implies a decision or next step
   - "Context setter": Background that frames why this matters now
3. **Propose an executive-ready rewrite** — Rewrite the technical section as a crisp, action-oriented executive summary sentence. Lead with impact, not method.

Return a JSON array. Each item must have:
- "quotedText": the EXACT text from the document you are commenting on (copy it verbatim — this is used to locate it in the document)
- "content": your comment — start with the narrative role label (e.g. "Core thesis:", "Supporting evidence:", "Risk / caveat:", "Action driver:", "Context setter:") followed by a brief explanation of what the key point is and why it matters
- "proposedText": the executive-ready rewrite of that section — one or two crisp sentences maximum

IMPORTANT: The "quotedText" must be an exact substring from the document text. Copy it character-for-character. Do NOT paraphrase or abbreviate it. Include enough words to be unique (at least 5-10 words).

Return ONLY valid JSON array. Identify 3-6 key narrative points.`;

      try {
        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(`Document Title: ${state.documentTitle}\n\nDocument Content:\n${plainText}`),
        ]);

        const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

        if (!content || content.trim().length === 0) {
          return { reviewComments: generateMockNarrativeComments(state.documentContent) };
        }

        const parsed = extractJson(content);
        const comments = Array.isArray(parsed) ? parsed : parsed.comments || parsed.reviewComments || [];
        const resolved = resolvePositions(comments, state.documentContent);
        return { reviewComments: resolved.length > 0 ? resolved : generateMockNarrativeComments(state.documentContent) };
      } catch (e) {
        console.error("LLM narrative review error, falling back to mock:", e);
        return { reviewComments: generateMockNarrativeComments(state.documentContent) };
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
          type: "narrative",
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
  return _narrativeGraph;
}

export async function narrativeReviewDocument(doc: Document): Promise<DocumentComment[]> {
  try {
    const graph = getNarrativeGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentTitle: doc.title || "",
      documentId: doc.id,
    });
    return result.savedComments;
  } catch (error) {
    console.error("narrativeReviewDocument error:", error);
    return [];
  }
}

export async function spotFactCheckCandidates(doc: Document): Promise<DocumentComment[]> {
  try {
    const graph = getFactCheckCandidateGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentTitle: doc.title || "",
      documentId: doc.id,
    });
    return result.savedComments;
  } catch (error) {
    console.error("spotFactCheckCandidates error:", error);
    return [];
  }
}

export async function runFactCheck(doc: Document, acceptedCandidates: DocumentComment[]): Promise<DocumentComment[]> {
  try {
    const graph = getFactCheckRunGraph();
    const result = await graph.invoke({
      documentContent: doc.content || "",
      documentId: doc.id,
      acceptedCandidates,
    });
    return result.results;
  } catch (error) {
    console.error("runFactCheck error:", error);
    return [];
  }
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
