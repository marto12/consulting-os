import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Target,
  HelpCircle,
  Shield,
  Lightbulb,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  FileText,
} from "lucide-react";
import { cn } from "../lib/utils";
import IssuesGraph from "./IssuesGraph";

interface DeliverablePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentKey: string;
  content: any;
  title?: string;
}

const AGENT_COLORS: Record<string, string> = {
  project_definition: "#6B7280",
  issues_tree: "#6B7280",
  mece_critic: "#9CA3AF",
  hypothesis: "#6B7280",
  execution: "#6B7280",
  summary: "#9CA3AF",
  presentation: "#6B7280",
};

function ProjectDefinitionPreview({ content }: { content: any }) {
  return (
    <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
      {content.decision_statement && (
        <Card className="p-4 border-l-4 border-l-border">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Decision Statement</h3>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{content.decision_statement}</p>
        </Card>
      )}

      {content.governing_question && (
        <Card className="p-4 border-l-4 border-l-border">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Governing Question</h3>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{content.governing_question}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {content.decision_owner && (
          <Card className="p-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Decision Owner</span>
            <p className="text-sm font-medium mt-1">{content.decision_owner}</p>
          </Card>
        )}
        {content.decision_deadline && (
          <Card className="p-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Deadline</span>
            <p className="text-sm font-medium mt-1">{content.decision_deadline}</p>
          </Card>
        )}
      </div>

      {content.success_metrics?.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Success Metrics</h3>
          </div>
          <div className="space-y-2">
            {content.success_metrics.map((m: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                <Badge variant="default" className="mt-0.5 shrink-0">{i + 1}</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.metric_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.definition}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Target: {m.threshold_or_target}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {content.constraints && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Constraints</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(content.constraints).map(([key, val]) =>
              val ? (
                <div key={key} className="p-2 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  <p className="text-sm mt-0.5">{String(val)}</p>
                </div>
              ) : null
            )}
          </div>
        </Card>
      )}

      {content.initial_hypothesis && (
        <Card className="p-4 border-l-4 border-l-border">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Initial Hypothesis</h3>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{content.initial_hypothesis}</p>
        </Card>
      )}

      {content.key_uncertainties?.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">Key Uncertainties</h3>
          </div>
          <ul className="space-y-1.5">
            {content.key_uncertainties.map((u: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground mt-1 shrink-0">-</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {content.alternatives?.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Alternatives</h3>
          <ul className="space-y-1.5">
            {content.alternatives.map((a: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge variant="default" className="shrink-0 mt-0.5">{i + 1}</Badge>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function IssuesTreePreview({ content }: { content: any }) {
  const issues = content.issues || [];
  if (issues.length === 0) {
    return <p className="text-muted-foreground text-sm">No issues to display.</p>;
  }

  const idMap = new Map<string | number, number>();
  issues.forEach((n: any, idx: number) => {
    idMap.set(n.id, idx + 1);
  });

  const mappedIssues = issues.map((n: any, idx: number) => ({
    id: idx + 1,
    parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
    text: n.text || n.label || "",
    priority: n.priority || "medium",
  }));

  return (
    <div className="h-[70vh]">
      <IssuesGraph issues={mappedIssues} />
    </div>
  );
}

function HypothesisPreview({ content }: { content: any }) {
  const hypotheses = content.hypotheses || [];
  const plan = content.analysisPlan || [];

  return (
    <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
      {hypotheses.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Lightbulb size={16} className="text-muted-foreground" />
            Hypotheses ({hypotheses.length})
          </h3>
          <div className="space-y-3">
            {hypotheses.map((h: any, i: number) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default">H{i + 1}</Badge>
                  <p className="text-sm font-medium flex-1">{h.statement}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Metric</span>
                    <p className="text-xs font-medium mt-0.5">{h.metric}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Data Source</span>
                    <p className="text-xs font-medium mt-0.5">{h.dataSource}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Method</span>
                    <p className="text-xs font-medium mt-0.5">{h.method}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {plan.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3">Analysis Plan ({plan.length} analyses)</h3>
          <div className="space-y-2">
            {plan.map((p: any, i: number) => (
              <Card key={i} className="p-3 flex items-center gap-3">
                <Badge variant="default" className="shrink-0">{i + 1}</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.method}</p>
                  {p.requiredDataset && (
                    <p className="text-xs text-muted-foreground mt-0.5">Dataset: {p.requiredDataset}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionPreview({ content }: { content: any }) {
  const results = Array.isArray(content) ? content : [];

  return (
    <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {results.map((r: any, i: number) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-muted-foreground" />
              <h3 className="font-semibold text-sm">Scenario {i + 1}</h3>
            </div>
            {r.outputs?.summary && (
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground">Expected NPV</span>
                  <span className="text-sm font-bold text-foreground">
                    ${r.outputs.summary.expectedValue?.toLocaleString() || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground">Best Case</span>
                  <span className="text-sm font-medium text-foreground">
                    ${r.outputs.summary.optimisticNpv?.toLocaleString() || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground">Worst Case</span>
                  <span className="text-sm font-medium text-muted-foreground">
                    ${r.outputs.summary.pessimisticNpv?.toLocaleString() || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground">Risk-Adjusted Return</span>
                  <span className="text-sm font-medium">{r.outputs.summary.riskAdjustedReturn || "N/A"}%</span>
                </div>
              </div>
            )}
            {r.inputs && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Baseline Revenue</span>
                  <span>${r.inputs.baselineRevenue?.toLocaleString() || "N/A"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Growth Rate</span>
                  <span>{((r.inputs.growthRate || 0) * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryPreview({ content }: { content: any }) {
  const text = content.summaryText || (typeof content === "string" ? content : JSON.stringify(content, null, 2));
  const paragraphs = text.split("\n\n").filter(Boolean);

  return (
    <div className="overflow-y-auto max-h-[70vh] pr-2">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-muted-foreground" />
          <h3 className="font-semibold">Executive Summary</h3>
        </div>
        <div className="prose prose-sm prose-invert max-w-none">
          {paragraphs.map((p: string, i: number) => (
            <p key={i} className="text-sm leading-relaxed text-foreground mb-3">{p}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PresentationPreview({ content }: { content: any }) {
  const slides = content.slides || [];
  const [current, setCurrent] = useState(0);

  if (slides.length === 0) {
    return <p className="text-muted-foreground text-sm">No slides to display.</p>;
  }

  const slide = slides[current];

  const LAYOUT_STYLES: Record<string, string> = {
    title_only: "from-slate-900 to-slate-800",
    title_body: "from-slate-900 to-slate-800",
    title_subtitle: "from-slate-900 to-slate-800",
    two_column: "from-slate-900 to-slate-800",
    metrics: "from-slate-900 to-slate-800",
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl p-8 sm:p-12 min-h-[400px] flex flex-col justify-center bg-gradient-to-br",
          LAYOUT_STYLES[slide.layout] || "from-slate-900 to-slate-800"
        )}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{slide.title}</h2>
        {slide.subtitle && (
          <p className="text-lg text-white/70 mb-6">{slide.subtitle}</p>
        )}
        {slide.bodyJson?.bullets && (
          <ul className="space-y-2 mt-4">
            {slide.bodyJson.bullets.map((b: string, i: number) => (
              <li key={i} className="flex items-start gap-3 text-white/90">
                <span className="w-1.5 h-1.5 rounded-full bg-white/50 mt-2 shrink-0" />
                <span className="text-sm sm:text-base">{b}</span>
              </li>
            ))}
          </ul>
        )}
        {slide.bodyJson?.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            {slide.bodyJson.metrics.map((m: any, i: number) => (
              <div key={i} className="bg-white/10 rounded-lg p-3">
                <p className="text-xs text-white/60">{m.label}</p>
                <p className="text-lg font-bold text-white">{m.value}</p>
                {m.change && <p className="text-xs text-white/70">{m.change}</p>}
              </div>
            ))}
          </div>
        )}
        {slide.notesText && (
          <p className="text-xs text-white/40 mt-6 italic">{slide.notesText}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}
        >
          <ChevronLeft size={16} /> Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          {current + 1} / {slides.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))}
          disabled={current === slides.length - 1}
        >
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function GenericPreview({ content }: { content: any }) {
  return (
    <div className="overflow-y-auto max-h-[70vh]">
      <pre className="text-xs font-mono bg-muted rounded-lg p-4 whitespace-pre-wrap break-words">
        {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}

const PREVIEW_LABELS: Record<string, string> = {
  project_definition: "Project Definition",
  issues_tree: "Issues Tree",
  mece_critic: "MECE Analysis",
  hypothesis: "Hypotheses & Analysis Plan",
  execution: "Scenario Analysis",
  summary: "Executive Summary",
  presentation: "Presentation Deck",
};

export default function DeliverablePreview({ open, onOpenChange, agentKey, content, title }: DeliverablePreviewProps) {
  const color = AGENT_COLORS[agentKey] || "#6B7280";
  const label = title || PREVIEW_LABELS[agentKey] || "Preview";

  const renderers: Record<string, (c: any) => React.ReactNode> = {
    project_definition: (c) => <ProjectDefinitionPreview content={c} />,
    issues_tree: (c) => <IssuesTreePreview content={c} />,
    hypothesis: (c) => <HypothesisPreview content={c} />,
    execution: (c) => <ExecutionPreview content={c} />,
    summary: (c) => <SummaryPreview content={c} />,
    presentation: (c) => <PresentationPreview content={c} />,
  };

  const renderPreview = renderers[agentKey] || ((c: any) => <GenericPreview content={c} />);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-4xl p-0 overflow-hidden",
          agentKey === "issues_tree" && "max-w-6xl"
        )}
      >
        <div className="p-4 sm:p-6 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-4 sm:p-6">
          {renderPreview(content)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
