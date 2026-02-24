import { storage } from "../storage";
import { isDeliverableEnvelope, wrapDeliverableContent } from "../lib/deliverables";

async function backfillDeliverables() {
  const projects = await storage.listProjects();
  let scanned = 0;
  let updated = 0;

  for (const project of projects) {
    const deliverables = await storage.getDeliverables(project.id);
    for (const deliverable of deliverables) {
      scanned += 1;
      if (isDeliverableEnvelope(deliverable.contentJson)) continue;

      let agentKey: string | undefined;
      try {
        const step = await storage.getWorkflowInstanceStep(deliverable.stepId);
        agentKey = step?.agentKey;
      } catch {
        agentKey = undefined;
      }

      const wrapped = wrapDeliverableContent({
        payload: deliverable.contentJson,
        agentKey,
        stepId: deliverable.stepId,
        deliverableTitle: deliverable.title,
      });

      await storage.updateDeliverable(deliverable.id, { contentJson: wrapped });
      updated += 1;
    }
  }

  console.log(`Deliverables scanned: ${scanned}`);
  console.log(`Deliverables updated: ${updated}`);
}

backfillDeliverables()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
