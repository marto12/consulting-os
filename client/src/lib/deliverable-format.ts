export function formatDeliverableText(agentKey: string, content: any): string {
  if (!content) return "No content generated.";

  const summarizeValue = (value: any): string => {
    if (value == null) return "N/A";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `${value.length} items`;
    if (typeof value === "object") return "Object";
    return String(value);
  };

  const formatGenericObject = (obj: Record<string, any>): string => {
    const lines: string[] = ["**Summary**"]; 
    const entries = Object.entries(obj);
    if (entries.length === 0) return "No content generated.";

    entries.forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`- ${key}: 0 items`);
        } else if (typeof value[0] === "object" && value[0] !== null) {
          const keys = Object.keys(value[0]).slice(0, 4).join(", ");
          lines.push(`- ${key}: ${value.length} items (${keys}${Object.keys(value[0]).length > 4 ? ", ..." : ""})`);
        } else {
          const preview = value.slice(0, 3).map((v) => summarizeValue(v)).join(", ");
          lines.push(`- ${key}: ${value.length} items (${preview}${value.length > 3 ? ", ..." : ""})`);
        }
      } else if (value && typeof value === "object") {
        const keys = Object.keys(value);
        lines.push(`- ${key}: ${keys.length} fields (${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ", ..." : ""})`);
      } else {
        lines.push(`- ${key}: ${summarizeValue(value)}`);
      }
    });

    return lines.join("\n");
  };

  try {
    if (agentKey === "project_definition") {
      const lines: string[] = [];
      if (content.decision_statement) lines.push(`**Decision Statement**\n${content.decision_statement}`);
      if (content.governing_question) lines.push(`**Governing Question**\n${content.governing_question}`);
      if (content.decision_owner) lines.push(`**Decision Owner:** ${content.decision_owner}`);
      if (content.decision_deadline) lines.push(`**Decision Deadline:** ${content.decision_deadline}`);
      if (content.success_metrics?.length) {
        lines.push(`**Success Metrics**`);
        content.success_metrics.forEach((m: any) => {
          lines.push(`  - ${m.metric_name}: ${m.definition} (Target: ${m.threshold_or_target})`);
        });
      }
      if (content.alternatives?.length) {
        lines.push(`**Alternatives**`);
        content.alternatives.forEach((a: string) => lines.push(`  - ${a}`));
      }
      if (content.constraints) {
        lines.push(`**Constraints**`);
        Object.entries(content.constraints).forEach(([k, v]) => {
          if (v) lines.push(`  - ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
        });
      }
      if (content.assumptions?.length) {
        lines.push(`**Assumptions**`);
        content.assumptions.forEach((a: string) => lines.push(`  - ${a}`));
      }
      if (content.initial_hypothesis) lines.push(`**Initial Hypothesis**\n${content.initial_hypothesis}`);
      if (content.key_uncertainties?.length) {
        lines.push(`**Key Uncertainties**`);
        content.key_uncertainties.forEach((u: string) => lines.push(`  - ${u}`));
      }
      if (content.information_gaps?.length) {
        lines.push(`**Information Gaps**`);
        content.information_gaps.forEach((g: string) => lines.push(`  - ${g}`));
      }
      return lines.join("\n\n");
    }

    if (agentKey === "issues_tree") {
      const issues = content.issues || [];
      const criticLog = content.criticLog || [];
      const roots = issues.filter((n: any) => !n.parentId);

      function renderBranch(parentId: string | null, indent: number): string {
        const children = issues.filter((n: any) => n.parentId === parentId);
        return children
          .map((c: any) => {
            const prefix = "  ".repeat(indent) + "- ";
            const priority = c.priority ? ` [${c.priority}]` : "";
            const line = `${prefix}${c.text}${priority}`;
            const sub = renderBranch(c.id, indent + 1);
            return sub ? `${line}\n${sub}` : line;
          })
          .join("\n");
      }

      const lines: string[] = [];
      lines.push(`**Issues Tree** (${issues.length} nodes, ${roots.length} root branches)`);
      lines.push(renderBranch(null, 0));

      if (criticLog.length > 0) {
        const lastCritic = criticLog[criticLog.length - 1]?.critic;
        if (lastCritic) {
          lines.push(
            `\n**MECE Quality Score:** ${lastCritic.overallScore}/5 - ${lastCritic.verdict === "approved" ? "Approved" : "Needs revision"}`
          );
        }
      }
      return lines.join("\n\n");
    }

    if (agentKey === "hypothesis") {
      const lines: string[] = [];
      if (content.hypotheses?.length) {
        lines.push(`**Hypotheses** (${content.hypotheses.length} generated)`);
        content.hypotheses.forEach((h: any, i: number) => {
          lines.push(`${i + 1}. ${h.statement}`);
          lines.push(`   Metric: ${h.metric} | Data Source: ${h.dataSource} | Method: ${h.method}`);
        });
      }
      if (content.analysisPlan?.length) {
        lines.push(`\n**Analysis Plan** (${content.analysisPlan.length} analyses)`);
        content.analysisPlan.forEach((p: any, i: number) => {
          lines.push(`${i + 1}. Method: ${p.method}`);
          if (p.requiredDataset) lines.push(`   Required Dataset: ${p.requiredDataset}`);
        });
      }
      return lines.join("\n");
    }

    if (agentKey === "execution") {
      if (Array.isArray(content)) {
        const lines: string[] = [`**Scenario Analysis Results** (${content.length} scenarios)`];
        content.forEach((r: any, i: number) => {
          lines.push(`\nScenario ${i + 1}: ${r.toolName || "Analysis"}`);
          if (r.outputs?.summary) {
            const s = r.outputs.summary;
            lines.push(`  Expected NPV: $${s.expectedValue?.toLocaleString() || "N/A"}`);
            lines.push(`  Best Case: $${s.optimisticNpv?.toLocaleString() || "N/A"}`);
            lines.push(`  Worst Case: $${s.pessimisticNpv?.toLocaleString() || "N/A"}`);
            lines.push(`  Risk-Adjusted Return: ${s.riskAdjustedReturn || "N/A"}%`);
          }
          if (r.inputs) {
            lines.push(`  Baseline Revenue: $${r.inputs.baselineRevenue?.toLocaleString() || "N/A"}`);
            lines.push(`  Growth Rate: ${((r.inputs.growthRate || 0) * 100).toFixed(1)}%`);
          }
        });
        return lines.join("\n");
      }
    }

    if (agentKey === "summary") {
      if (content.summaryText) {
        return content.summaryText;
      }
    }

    if (agentKey === "outcomes_report" || content.reportText || content.keyFindings) {
      const lines: string[] = [];
      if (content.reportTitle) {
        lines.push(`**Report Title**\n${content.reportTitle}`);
      }
      if (content.reportText) {
        lines.push(`**Report**\n${content.reportText}`);
      }
      if (content.keyFindings?.length) {
        lines.push(`**Key Findings**`);
        content.keyFindings.forEach((item: string) => lines.push(`  - ${item}`));
      }
      if (content.chartHighlights?.length) {
        lines.push(`**Chart Highlights**`);
        content.chartHighlights.forEach((c: any) => {
          const title = c.title || c.chartTitle || "Chart";
          const insight = c.insight || c.note || "";
          lines.push(`  - ${title}${insight ? `: ${insight}` : ""}`);
        });
      }
      if (content.dataNotes?.length) {
        lines.push(`**Data Notes**`);
        content.dataNotes.forEach((note: string) => lines.push(`  - ${note}`));
      }
      if (content.nextSteps?.length) {
        lines.push(`**Next Steps**`);
        content.nextSteps.forEach((step: string) => lines.push(`  - ${step}`));
      }
      if (lines.length > 0) return lines.join("\n\n");
    }

    if (agentKey === "presentation") {
      if (content.slides?.length) {
        const lines: string[] = [`**Presentation Deck** (${content.slides.length} slides)`];
        content.slides.forEach((s: any) => {
          const slideNum = (s.slideIndex ?? 0) + 1;
          lines.push(`\nSlide ${slideNum}: ${s.title}`);
          if (s.subtitle) lines.push(`  ${s.subtitle}`);
          if (s.layout) lines.push(`  Layout: ${s.layout}`);
          if (s.bodyJson?.bullets) {
            s.bodyJson.bullets.forEach((b: string) => lines.push(`  - ${b}`));
          }
          if (s.bodyJson?.metrics) {
            s.bodyJson.metrics.forEach((m: any) => lines.push(`  - ${m.label}: ${m.value} (${m.change})`));
          }
        });
        return lines.join("\n");
      }
    }

    if (typeof content === "string") return content;
    if (typeof content === "object") {
      if (Array.isArray(content)) {
        return `**Items** (${content.length})`;
      }
      return formatGenericObject(content);
    }
    return summarizeValue(content);
  } catch {
    return typeof content === "string" ? content : "Unable to format content.";
  }
}
