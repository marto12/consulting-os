export type DeliverableRefs = {
  datasetIds?: number[];
  chartIds?: number[];
  modelIds?: number[];
  documentIds?: number[];
};

export type DeliverableEnvelope = {
  type: string;
  version: number;
  payload: any;
  refs?: DeliverableRefs;
  summary?: string;
  metadata?: {
    agentKey?: string;
    stepId?: number;
    deliverableTitle?: string;
  };
};

export function isDeliverableEnvelope(value: any): value is DeliverableEnvelope {
  if (!value || typeof value !== "object") return false;
  if (typeof value.type !== "string") return false;
  if (typeof value.version !== "number") return false;
  return Object.prototype.hasOwnProperty.call(value, "payload");
}

function normalizeIds(value: any): number[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  }
  const single = Number(value);
  return Number.isFinite(single) ? [single] : [];
}

function extractRefs(payload: any): DeliverableRefs | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const datasetIds = new Set<number>();
  normalizeIds(payload.datasetId).forEach((id) => datasetIds.add(id));
  normalizeIds(payload.datasetIds).forEach((id) => datasetIds.add(id));
  normalizeIds(payload.spreadsheetId).forEach((id) => datasetIds.add(id));

  const chartIds = new Set<number>();
  normalizeIds(payload.chartId).forEach((id) => chartIds.add(id));
  normalizeIds(payload.chartIds).forEach((id) => chartIds.add(id));

  const modelIds = new Set<number>();
  normalizeIds(payload.modelId).forEach((id) => modelIds.add(id));
  normalizeIds(payload.modelIds).forEach((id) => modelIds.add(id));

  const documentIds = new Set<number>();
  normalizeIds(payload.documentId).forEach((id) => documentIds.add(id));
  normalizeIds(payload.documentIds).forEach((id) => documentIds.add(id));

  const refs: DeliverableRefs = {};
  if (datasetIds.size) refs.datasetIds = Array.from(datasetIds);
  if (chartIds.size) refs.chartIds = Array.from(chartIds);
  if (modelIds.size) refs.modelIds = Array.from(modelIds);
  if (documentIds.size) refs.documentIds = Array.from(documentIds);

  return Object.keys(refs).length ? refs : undefined;
}

function extractSummary(payload: any): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  if (typeof payload.summaryText === "string") return payload.summaryText;
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.headline === "string") return payload.headline;
  return undefined;
}

function inferType(agentKey?: string): string {
  if (!agentKey) return "generic";
  if (agentKey === "project_definition") return "project_definition";
  if (agentKey === "issues_tree") return "issues_tree";
  if (agentKey === "hypothesis") return "hypotheses";
  if (agentKey === "execution") return "execution_results";
  if (agentKey === "summary") return "summary";
  if (agentKey === "presentation") return "presentation";
  if (agentKey === "model_runner") return "model_run";
  if (agentKey.startsWith("des_")) return "document";
  return agentKey;
}

export function wrapDeliverableContent(input: {
  payload: any;
  agentKey?: string;
  stepId?: number;
  deliverableTitle?: string;
  refs?: DeliverableRefs;
  summary?: string;
}): DeliverableEnvelope {
  if (isDeliverableEnvelope(input.payload)) {
    return input.payload;
  }

  const refs = input.refs ?? extractRefs(input.payload);
  const summary = input.summary ?? extractSummary(input.payload);

  return {
    type: inferType(input.agentKey),
    version: 1,
    payload: input.payload,
    refs,
    summary,
    metadata: {
      agentKey: input.agentKey,
      stepId: input.stepId,
      deliverableTitle: input.deliverableTitle,
    },
  };
}

export function unwrapDeliverableContent(value: any): { envelope?: DeliverableEnvelope; payload: any } {
  if (isDeliverableEnvelope(value)) {
    return { envelope: value, payload: value.payload };
  }
  return { payload: value };
}

export function updateDeliverableEnvelope(
  existing: any,
  input: {
    payload: any;
    agentKey?: string;
    stepId?: number;
    deliverableTitle?: string;
  }
): DeliverableEnvelope {
  if (isDeliverableEnvelope(existing)) {
    return {
      ...existing,
      payload: input.payload,
      refs: extractRefs(input.payload),
      summary: extractSummary(input.payload),
    };
  }

  return wrapDeliverableContent({
    payload: input.payload,
    agentKey: input.agentKey,
    stepId: input.stepId,
    deliverableTitle: input.deliverableTitle,
  });
}
