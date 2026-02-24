import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch, Bot, Plus, Pencil, Trash2, Copy } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

const GOVERNANCE_DETAILS: Record<number, string> = {
  1: "Experimental (unlocked prompts, no logging/evals)",
  2: "Controlled pilot (versioning, basic logging, enforced human review gate)",
  3: "Operationally governed (locked prompts, audit log, named owner, sign-off gate, eval scoring)",
  4: "Enterprise-grade (prompt registry, SSO access control, model version tracking, automated evals/monitoring, change control)",
};

const DEPLOYMENT_LABELS: Record<string, string> = {
  sandbox: "Sandbox",
  pilot: "Pilot-ready",
  pilot_ready: "Pilot-ready",
  production: "Production-ready",
  production_ready: "Production-ready",
  awaiting_it: "Awaiting IT",
  coming_soon: "Coming soon",
  planned: "Planned",
};

const DEPLOYMENT_BADGE_CLASSES: Record<string, string> = {
  sandbox: "border-amber-200 bg-amber-50 text-amber-700",
  pilot: "border-sky-200 bg-sky-50 text-sky-700",
  pilot_ready: "border-sky-200 bg-sky-50 text-sky-700",
  production: "border-emerald-200 bg-emerald-50 text-emerald-700",
  production_ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  awaiting_it: "border-slate-200 bg-slate-50 text-slate-700",
  coming_soon: "border-cyan-200 bg-cyan-50 text-cyan-700",
  planned: "border-cyan-200 bg-cyan-50 text-cyan-700",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  version: number;
  practiceCoverage?: string[] | null;
  timesUsed?: number | null;
  deploymentStatus?: string | null;
  governanceMaturity?: number | null;
  baselineCost?: number | null;
  aiCost?: number | null;
  lifecycleStatus?: "active" | "coming_soon" | string | null;
  comingSoonEta?: string | null;
  steps: { id: number; stepOrder: number; name: string; agentKey: string }[];
}

export default function Workflows() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("operations");

  const { data: workflows, isLoading } = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/workflows"],
  });

  useEffect(() => {
    const stored = localStorage.getItem("workflows-view-mode");
    if (stored === "operations" || stored === "impact") {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("workflows-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "impact" && (sortBy === "cost-reduction" || sortBy === "total-savings")) {
      setSortBy("default");
    }
  }, [viewMode, sortBy]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (wf: WorkflowTemplate) => {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${wf.name} (Copy)`,
          description: wf.description,
          practiceCoverage: Array.isArray(wf.practiceCoverage) ? wf.practiceCoverage : [],
          timesUsed: 0,
          deploymentStatus: wf.deploymentStatus || "sandbox",
          governanceMaturity: wf.governanceMaturity ?? 1,
          baselineCost: wf.baselineCost ?? null,
          aiCost: wf.aiCost ?? null,
          lifecycleStatus: "active",
          comingSoonEta: null,
          steps: wf.steps.map((s) => ({
            stepOrder: s.stepOrder,
            name: s.name,
            agentKey: s.agentKey,
            description: "",
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
  });

  const normalizedWorkflows = useMemo(() => {
    if (!workflows) return [];
    return workflows.map((wf) => {
      const practiceCoverage = Array.isArray(wf.practiceCoverage)
        ? wf.practiceCoverage
        : typeof wf.practiceCoverage === "string"
          ? [wf.practiceCoverage]
          : [];
      const lifecycleStatus = wf.lifecycleStatus ?? "active";
      const deploymentStatus =
        wf.deploymentStatus === "coming_soon" && lifecycleStatus === "coming_soon"
          ? "planned"
          : wf.deploymentStatus ?? (lifecycleStatus === "coming_soon" ? "planned" : "sandbox");
      const governanceMaturity = typeof wf.governanceMaturity === "number" ? wf.governanceMaturity : 1;
      const timesUsed = typeof wf.timesUsed === "number" ? wf.timesUsed : 0;

      return {
        ...wf,
        practiceCoverage,
        lifecycleStatus,
        deploymentStatus,
        governanceMaturity,
        timesUsed,
      };
    });
  }, [workflows]);

  const getCostReduction = (wf: WorkflowTemplate) => {
    if (wf.baselineCost == null || wf.aiCost == null || wf.baselineCost === 0) return null;
    return (wf.baselineCost - wf.aiCost) / wf.baselineCost;
  };

  const getTotalSavings = (wf: WorkflowTemplate) => {
    if (wf.baselineCost == null || wf.aiCost == null) return null;
    return (wf.baselineCost - wf.aiCost) * (wf.timesUsed ?? 0);
  };

  const formatCurrency = (value: number | null | undefined) =>
    value == null ? "" : currencyFormatter.format(value);
  const formatNumber = (value: number | null | undefined) =>
    value == null ? "" : numberFormatter.format(value);
  const formatPercent = (value: number | null | undefined) =>
    value == null ? "" : percentFormatter.format(value);

  const searchedWorkflows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return normalizedWorkflows;
    return normalizedWorkflows.filter((wf) => {
      const deploymentKey = (wf.deploymentStatus || "sandbox")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/-+/g, "_");
      const deploymentLabel = DEPLOYMENT_LABELS[deploymentKey] || wf.deploymentStatus || "";
      const haystack = [
        wf.name,
        wf.description,
        wf.practiceCoverage?.join(" "),
        wf.deploymentStatus,
        deploymentLabel,
        wf.lifecycleStatus,
        wf.comingSoonEta,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [normalizedWorkflows, search]);

  const sortWorkflows = (items: WorkflowTemplate[]) => {
    const sorted = [...items];
    if (sortBy === "default") {
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === "name-asc") {
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === "name-desc") {
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    }
    if (sortBy === "times-used") {
      return sorted.sort((a, b) => (b.timesUsed ?? 0) - (a.timesUsed ?? 0));
    }
    if (sortBy === "cost-reduction") {
      return sorted.sort((a, b) => {
        const aValue = getCostReduction(a);
        const bValue = getCostReduction(b);
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        return bValue - aValue;
      });
    }
    if (sortBy === "total-savings") {
      return sorted.sort((a, b) => {
        const aValue = getTotalSavings(a);
        const bValue = getTotalSavings(b);
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        return bValue - aValue;
      });
    }
    return sorted;
  };

  const activeWorkflows = useMemo(() => {
    const filtered = searchedWorkflows.filter((wf) => wf.lifecycleStatus !== "coming_soon");
    return sortWorkflows(filtered);
  }, [searchedWorkflows, sortBy]);

  const comingSoonWorkflows = useMemo(() => {
    const filtered = searchedWorkflows.filter((wf) => wf.lifecycleStatus === "coming_soon");
    return sortWorkflows(filtered);
  }, [searchedWorkflows, sortBy]);

  const totalFilteredCount = activeWorkflows.length + comingSoonWorkflows.length;
  const totalCount = workflows?.length ?? 0;
  const showCombinedAll = viewFilter === "all" && sortBy !== "default";
  const visibleCount =
    viewFilter === "active"
      ? activeWorkflows.length
      : viewFilter === "coming_soon"
        ? comingSoonWorkflows.length
        : totalFilteredCount;

  const showFinancials = viewMode === "impact";

  if (isLoading) {
    const skeletonRows = Array.from({ length: 5 });
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-[2fr_1.4fr_0.7fr_1fr_1fr_0.8fr] gap-4 px-4 py-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
          {skeletonRows.map((_, idx) => (
            <div
              key={`workflow-row-skeleton-${idx}`}
              className="grid grid-cols-[2fr_1.4fr_0.7fr_1fr_1fr_0.8fr] gap-4 px-4 py-4 border-t border-border"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-10 ml-auto" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderTable = (items: WorkflowTemplate[], title?: string, showCount?: boolean) => {
    const gridCols = showFinancials
      ? "md:grid-cols-[2.2fr_1.6fr_0.9fr_1.1fr_1.1fr_1fr_1fr_1fr_1.2fr_0.8fr]"
      : "md:grid-cols-[2.2fr_1.6fr_0.9fr_1.1fr_1.1fr_0.8fr]";

    return (
      <div className="space-y-3">
        {title && (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {showCount && (
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            )}
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground border border-dashed border-border rounded-lg">
            <Bot size={36} strokeWidth={1.5} />
            <div className="text-center">
              <h3 className="text-base font-semibold text-foreground">No workflows found</h3>
              <p className="text-sm">Try adjusting the filters.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <div
              className={`hidden md:grid ${gridCols} gap-4 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left`}
            >
              <div>Workflow</div>
              <div>Practice coverage</div>
              <div className="text-right">Times used (firm-wide)</div>
              <div>Deployment status</div>
              <div>Governance maturity</div>
              {showFinancials && (
                <>
                  <div className="text-right">Baseline delivery cost</div>
                  <div className="text-right">AI-enabled cost</div>
                  <div className="text-right">Cost reduction</div>
                  <div className="text-right">Total savings to date</div>
                </>
              )}
              <div>Actions</div>
            </div>
            {items.map((wf) => {
              const isComingSoon = wf.lifecycleStatus === "coming_soon";
              const deploymentKey = (wf.deploymentStatus || "sandbox")
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/-+/g, "_");
              const deploymentLabel = DEPLOYMENT_LABELS[deploymentKey] || wf.deploymentStatus || "";
              const deploymentClass = DEPLOYMENT_BADGE_CLASSES[deploymentKey] || "";
              const costReduction = getCostReduction(wf);
              const totalSavings = getTotalSavings(wf);

              return (
                <div
                  key={wf.id}
                  className={`flex flex-col gap-3 px-4 py-4 border-t border-border md:grid ${gridCols} md:gap-4 md:items-center hover:bg-muted/40 transition-colors`}
                >
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => navigate(`/global/workflow/${wf.id}`)}
                  >
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mt-0.5">
                      <GitBranch size={18} className="text-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{wf.name}</h3>
                        {isComingSoon && (
                          <Badge variant="secondary" className="text-xs">
                            Coming soon
                          </Badge>
                        )}
                      </div>
                      {wf.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{wf.description}</p>
                      )}
                      {isComingSoon && wf.comingSoonEta && (
                        <p className="text-xs text-muted-foreground">ETA {wf.comingSoonEta}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wf.practiceCoverage && wf.practiceCoverage.length > 0 ? (
                      wf.practiceCoverage.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No tags</span>
                    )}
                  </div>
                  <div className="text-right text-sm text-foreground tabular-nums">
                    {formatNumber(wf.timesUsed)}
                  </div>
                  <div>
                    {deploymentLabel ? (
                      <Badge variant="outline" className={`text-xs ${deploymentClass}`}>
                        {deploymentLabel}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">&nbsp;</span>
                    )}
                  </div>
                  <div>
                    {wf.governanceMaturity ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs">
                            Level {wf.governanceMaturity}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {GOVERNANCE_DETAILS[wf.governanceMaturity] || "Not yet assessed"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-sm text-muted-foreground">&nbsp;</span>
                    )}
                  </div>
                  {showFinancials && (
                    <>
                      <div className="text-right text-sm text-foreground tabular-nums">
                        {formatCurrency(wf.baselineCost)}
                      </div>
                      <div className="text-right text-sm text-foreground tabular-nums">
                        {formatCurrency(wf.aiCost)}
                      </div>
                      <div className="text-right text-sm text-foreground tabular-nums">
                        {formatPercent(costReduction)}
                      </div>
                      <div className="text-right text-sm text-foreground tabular-nums">
                        {formatCurrency(totalSavings)}
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-start gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => navigate(`/global/workflow/${wf.id}`)}
                          aria-label="Edit workflow"
                        >
                          <Pencil size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => duplicateMutation.mutate(wf)}
                          disabled={duplicateMutation.isPending}
                          aria-label="Duplicate workflow"
                        >
                          <Copy size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicate</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this workflow template? This cannot be undone.")) {
                              deleteMutation.mutate(wf.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete workflow"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Portfolio view of reusable workflow templates
          </p>
        </div>
        <Button onClick={() => navigate("/global/workflow/new")} size="sm">
          <Plus size={14} className="mr-1" />
          New Workflow
        </Button>
      </div>

      {!workflows || workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <GitBranch size={48} strokeWidth={1.5} />
          <h3 className="text-base font-semibold text-foreground">No workflows</h3>
          <p>Create your first workflow template</p>
          <Button onClick={() => navigate("/global/workflow/new")} size="sm">
            <Plus size={14} className="mr-1" />
            Create Workflow
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <Input
                placeholder="Search workflows, practices, or status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="w-[180px]">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger>
                  <SelectValue placeholder="View" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="impact">Impact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Select value={viewFilter} onValueChange={setViewFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All workflows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="coming_soon">Coming soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="times-used">Times used</SelectItem>
                  {viewMode === "impact" && (
                    <>
                      <SelectItem value="cost-reduction">Cost reduction</SelectItem>
                      <SelectItem value="total-savings">Total savings</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {visibleCount} of {totalCount} workflows
            </div>
          </div>

          {visibleCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-lg">
              <Bot size={40} strokeWidth={1.5} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">No matching workflows</h3>
                <p className="text-sm">Try a different search or filter.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setViewFilter("all");
                  setSortBy("default");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <TooltipProvider>
              {showCombinedAll ? (
                renderTable(sortWorkflows(searchedWorkflows))
              ) : (
                <div className="space-y-6">
                  {viewFilter !== "coming_soon" && renderTable(activeWorkflows)}
                  {viewFilter !== "active" &&
                    renderTable(comingSoonWorkflows, "Pipeline workflows (coming soon)", true)}
                </div>
              )}
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}
