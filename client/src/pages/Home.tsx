import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Briefcase,
  MessageSquare,
  FileText,
  Table,
  Presentation,
  BarChart3,
  Database,
  Box,
  GitBranch,
  Bot,
  Settings,
  ArrowUpRight,
  Clock,
  User,
  Bot as BotIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useUserContext } from "../lib/user-context";

type Project = {
  id: number;
  name: string;
  objective: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
};

type Document = {
  id: number;
  projectId: number | null;
  title: string;
  lastEditedByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
};

type Chart = {
  id: number;
  projectId: number | null;
  name: string;
  createdAt: string;
};

type Model = {
  id: number;
  projectId: number | null;
  name: string;
  createdAt: string;
};

type Presentation = {
  id: number;
  projectId: number | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type RunLog = {
  id: number;
  projectId: number;
  stage: string;
  modelUsed: string;
  status: string;
  createdAt: string;
};

const STAGE_LABELS: Record<string, string> = {
  created: "New",
  definition_draft: "Definition Draft",
  definition_approved: "Definition Approved",
  issues_draft: "Issues Draft",
  issues_approved: "Issues Approved",
  hypotheses_draft: "Hypotheses Draft",
  hypotheses_approved: "Hypotheses Approved",
  execution_done: "Execution Done",
  execution_approved: "Execution Approved",
  summary_draft: "Summary Draft",
  summary_approved: "Summary Approved",
  presentation_draft: "Presentation Draft",
  complete: "Complete",
};

function getStageVariant(stage: string): "success" | "warning" | "default" {
  if (stage === "complete") return "success";
  if (stage.includes("approved")) return "success";
  if (stage.includes("draft") || stage === "execution_done") return "warning";
  return "default";
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}


const DESTINATIONS = [
  {
    title: "Projects",
    description: "Create or open a client engagement.",
    to: "/projects",
    icon: Briefcase,
  },
  {
    title: "Chat",
    description: "Ask questions and iterate with the assistant.",
    to: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Documents",
    description: "Draft narratives, briefs, and working notes.",
    to: "/documents",
    icon: FileText,
  },
  {
    title: "Spreadsheets",
    description: "Track structured inputs and quick calculations.",
    to: "/spreadsheets",
    icon: Table,
  },
  {
    title: "Slides",
    description: "Build presentations with structured content blocks.",
    to: "/presentations",
    icon: Presentation,
  },
  {
    title: "Charts",
    description: "Design and review visuals for stakeholder decks.",
    to: "/charts",
    icon: BarChart3,
  },
  {
    title: "Datasets",
    description: "Upload, curate, and reuse data tables.",
    to: "/datasets",
    icon: Database,
  },
  {
    title: "Models",
    description: "Track financial or strategic models by project.",
    to: "/models",
    icon: Box,
  },
  {
    title: "Workflows",
    description: "Manage reusable workflows and templates.",
    to: "/global/workflows",
    icon: GitBranch,
  },
  {
    title: "Agents",
    description: "Organize AI agents for repeatable analysis.",
    to: "/global/agents",
    icon: Bot,
  },
  {
    title: "Settings",
    description: "Adjust preferences and account details.",
    to: "/settings",
    icon: Settings,
  },
];

export default function HomePage() {
  const { users } = useUserContext();
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 10000,
  });
  const { data: documents = [], isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    refetchInterval: 10000,
  });
  const { data: charts = [], isLoading: chartsLoading } = useQuery<Chart[]>({
    queryKey: ["/api/charts"],
    refetchInterval: 10000,
  });
  const { data: models = [], isLoading: modelsLoading } = useQuery<Model[]>({
    queryKey: ["/api/data/models"],
    refetchInterval: 10000,
  });
  const { data: presentations = [], isLoading: presentationsLoading } = useQuery<Presentation[]>({
    queryKey: ["/api/presentations"],
    refetchInterval: 10000,
  });
  const { data: runLogs = [], isLoading: logsLoading } = useQuery<RunLog[]>({
    queryKey: ["/api/run-logs"],
    refetchInterval: 10000,
  });

  const projectLookup = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((project) => map.set(project.id, project));
    return map;
  }, [projects]);

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const activityItems = useMemo(() => {
    const docItems = documents
      .filter((doc) => doc.projectId)
      .map((doc) => ({
        id: `doc-${doc.id}`,
        projectId: doc.projectId as number,
        title: `Document updated: ${doc.title}`,
        actorType: "user" as const,
        actorName: doc.lastEditedByUserId ? userLookup.get(doc.lastEditedByUserId) ?? "Unknown user" : "Unknown user",
        timestamp: doc.updatedAt,
      }));

    const logItems = runLogs.map((log) => ({
      id: `run-${log.id}`,
      projectId: log.projectId,
      title: `Agent run: ${STAGE_LABELS[log.stage] ?? log.stage}`,
      actorType: "agent" as const,
      actorName: log.modelUsed,
      timestamp: log.createdAt,
    }));

    return [...docItems, ...logItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [documents, runLogs, userLookup]);

  const continueItems = useMemo(() => {
    const items = [
      ...documents.map((doc) => ({
        id: `doc-${doc.id}`,
        title: doc.title,
        type: "Document",
        projectId: doc.projectId,
        updatedAt: doc.updatedAt || doc.createdAt,
        to: `/editor/${doc.id}`,
        icon: FileText,
      })),
      ...presentations.map((pres) => ({
        id: `pres-${pres.id}`,
        title: pres.title,
        type: "Slides",
        projectId: pres.projectId,
        updatedAt: pres.updatedAt || pres.createdAt,
        to: `/slides/${pres.id}`,
        icon: Presentation,
      })),
      ...charts.map((chart) => ({
        id: `chart-${chart.id}`,
        title: chart.name,
        type: "Chart",
        projectId: chart.projectId,
        updatedAt: chart.createdAt,
        to: chart.projectId ? `/project/${chart.projectId}/charts/${chart.id}` : `/charts/${chart.id}`,
        icon: BarChart3,
      })),
      ...models.map((model) => ({
        id: `model-${model.id}`,
        title: model.name,
        type: "Model",
        projectId: model.projectId,
        updatedAt: model.createdAt,
        to: model.projectId ? `/project/${model.projectId}/models` : "/global/models",
        icon: Box,
      })),
    ];

    return items
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [documents, presentations, charts, models]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-transparent p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm font-semibold text-primary">
          <Home className="size-4" />
          Home
        </div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold text-foreground">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep an eye on active engagements, recent updates, and your next moves.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/projects">View Projects</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/chat">Open Chat</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recent project changes</h2>
          <p className="text-sm text-muted-foreground">Latest updates across your active engagements.</p>
        </div>
        {isLoading || docsLoading || logsLoading ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Loading recent activity...
          </div>
        ) : activityItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No project activity yet. Create a project to start tracking updates.
          </div>
        ) : (
          <div className="grid gap-3">
            {activityItems.map((item) => {
              const project = projectLookup.get(item.projectId);
              if (!project) return null;
              return (
                <Card key={item.id} className="p-4">
                  <Link to={`/project/${project.id}`} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{project.name}</span>
                        <Badge variant={getStageVariant(project.stage)}>
                          {STAGE_LABELS[project.stage] ?? project.stage}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                          {item.actorType === "agent" ? <BotIcon className="size-3" /> : <User className="size-3" />}
                          {item.actorType === "agent" ? "Agent" : "User"}
                        </span>
                        <span className="truncate">{item.actorName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {timeAgo(item.timestamp)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary">
                        View
                        <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Continue</h2>
          <p className="text-sm text-muted-foreground">Pick up where you left off across recent work.</p>
        </div>
        {docsLoading || chartsLoading || modelsLoading || presentationsLoading ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Loading recent work...
          </div>
        ) : continueItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No recent work yet. Start a document, chart, model, or slide deck to see it here.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {continueItems.map((item) => (
              <Card key={item.id} className="p-4 transition hover:border-primary/40">
                <Link to={item.to} className="flex items-start gap-3">
                  <div className="mt-1 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <item.icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{item.type}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {timeAgo(item.updatedAt)}
                      </span>
                      {item.projectId && projectLookup.get(item.projectId) && (
                        <span className="truncate">• {projectLookup.get(item.projectId)?.name}</span>
                      )}
                    </div>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Jump to a section</h2>
          <p className="text-sm text-muted-foreground">Quick links to the core areas of the platform.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DESTINATIONS.map((item) => (
            <Card key={item.title} className="p-4 transition hover:border-primary/40">
              <Link to={item.to} className="flex items-start gap-3">
                <div className="mt-1 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                  <item.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
