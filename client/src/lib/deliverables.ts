export type DeliverableEnvelope = {
  type: string;
  version: number;
  payload: any;
  refs?: Record<string, unknown>;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export function isDeliverableEnvelope(value: any): value is DeliverableEnvelope {
  if (!value || typeof value !== "object") return false;
  if (typeof value.type !== "string") return false;
  if (typeof value.version !== "number") return false;
  return Object.prototype.hasOwnProperty.call(value, "payload");
}

export function parseDeliverableContent(content: any): { payload: any; envelope?: DeliverableEnvelope } {
  let parsed = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = content;
    }
  }

  if (isDeliverableEnvelope(parsed)) {
    return { payload: parsed.payload, envelope: parsed };
  }

  return { payload: parsed };
}
