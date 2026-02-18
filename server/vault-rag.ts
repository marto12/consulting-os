import OpenAI from "openai";
import { storage } from "./storage";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const MAX_RAG_CHUNKS = 10;

function hasApiKey(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  );
}

function getOpenAIClient(): OpenAI | null {
  if (!hasApiKey()) return null;
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

export function extractTextFromFile(buffer: Buffer, mimeType: string): string {
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return buffer.toString("utf-8");
  }

  if (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const text = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    const cleaned = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3)
      .join("\n");
    return cleaned || "[Binary document — text extraction limited]";
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel" ||
      mimeType === "text/csv") {
    return buffer.toString("utf-8");
  }

  return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim() || "[Unsupported file format for text extraction]";
}

export function chunkText(text: string): string[] {
  if (!text || text.length < 10) return [];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlap = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = overlap + "\n\n" + para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length === 0 && text.trim().length > 0) {
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunk = text.slice(i, i + CHUNK_SIZE).trim();
      if (chunk) chunks.push(chunk);
    }
  }

  return chunks;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][] | null> {
  const client = getOpenAIClient();
  if (!client || texts.length === 0) return null;

  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  } catch (err: any) {
    console.error("Embedding generation failed:", err.message);
    return null;
  }
}

export async function processVaultFile(fileId: number, buffer: Buffer): Promise<void> {
  const file = await storage.getVaultFile(fileId);
  if (!file) return;

  try {
    await storage.updateVaultFile(fileId, { embeddingStatus: "processing" });

    const extractedText = extractTextFromFile(buffer, file.mimeType);
    await storage.updateVaultFile(fileId, { extractedText });

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      await storage.updateVaultFile(fileId, {
        embeddingStatus: "completed",
        chunkCount: 0,
      });
      return;
    }

    const embeddings = await generateEmbeddings(chunks);

    const chunkRecords = chunks.map((content, idx) => ({
      fileId: file.id,
      projectId: file.projectId,
      chunkIndex: idx,
      content,
      embedding: embeddings ? embeddings[idx] : null,
      tokenCount: Math.ceil(content.length / 4),
    }));

    await storage.createVaultChunks(chunkRecords);

    await storage.updateVaultFile(fileId, {
      embeddingStatus: embeddings ? "completed" : "no_embeddings",
      chunkCount: chunks.length,
    });
  } catch (err: any) {
    console.error("Vault file processing failed:", err.message);
    await storage.updateVaultFile(fileId, { embeddingStatus: "failed" });
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export async function retrieveRelevantContext(
  projectId: number,
  query: string,
  maxChunks: number = MAX_RAG_CHUNKS
): Promise<{ content: string; fileName: string; score: number }[]> {
  const allChunks = await storage.getVaultChunksByProject(projectId);
  if (allChunks.length === 0) return [];

  const hasEmbeddings = allChunks.some((c) => c.embedding);

  if (hasEmbeddings) {
    const queryEmbedding = await generateEmbeddings([query]);
    if (queryEmbedding && queryEmbedding[0]) {
      const scored = allChunks
        .filter((c) => c.embedding)
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(queryEmbedding[0], chunk.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks);

      const fileIds = [...new Set(scored.map((s) => s.chunk.fileId))];
      const fileMap = new Map<number, string>();
      for (const fid of fileIds) {
        const f = await storage.getVaultFile(fid);
        if (f) fileMap.set(fid, f.fileName);
      }

      return scored.map((s) => ({
        content: s.chunk.content,
        fileName: fileMap.get(s.chunk.fileId) || "unknown",
        score: s.score,
      }));
    }
  }

  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter((w) => w.length > 3);

  const scored = allChunks.map((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (contentLower.includes(kw)) score += 1;
    }
    return { chunk, score };
  });

  const filtered = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  if (filtered.length === 0) {
    return allChunks.slice(0, maxChunks).map((chunk) => ({
      content: chunk.content,
      fileName: "unknown",
      score: 0,
    }));
  }

  const fileIds = [...new Set(filtered.map((s) => s.chunk.fileId))];
  const fileMap = new Map<number, string>();
  for (const fid of fileIds) {
    const f = await storage.getVaultFile(fid);
    if (f) fileMap.set(fid, f.fileName);
  }

  return filtered.map((s) => ({
    content: s.chunk.content,
    fileName: fileMap.get(s.chunk.fileId) || "unknown",
    score: s.score,
  }));
}

export function formatRAGContext(
  results: { content: string; fileName: string; score: number }[]
): string {
  if (results.length === 0) return "";

  const sections = results.map((r, i) =>
    `--- Source: ${r.fileName} (chunk ${i + 1}) ---\n${r.content}`
  );

  return `\n\n=== PROJECT VAULT CONTEXT ===\nThe following excerpts are from documents uploaded to this project's vault. Use this context to inform your analysis:\n\n${sections.join("\n\n")}\n=== END VAULT CONTEXT ===\n`;
}
