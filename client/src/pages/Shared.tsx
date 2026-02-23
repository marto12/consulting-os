import { useNavigate } from "react-router-dom";
import { Bot, Database, Box, FileText, GitBranch, Share2, ChevronRight, Users, Package, Activity } from "lucide-react";
import { Card } from "../components/ui/card";

const SHARED_TOOLS = [
  {
    label: "Workforce",
    description: "Human contributors and AI agents available in your workspace.",
    examples: ["Delivery leads", "Analysts", "Agent roster"],
    path: "/global/workforce",
    icon: Users,
  },
  {
    label: "Assets",
    description: "Shared workflows, datasets, and models across projects.",
    examples: ["Workflow library", "Datasets", "Models"],
    path: "/global/assets",
    icon: Package,
  },
  {
    label: "Workflows",
    description: "Reusable agent pipelines shared across projects.",
    examples: ["Consulting Analysis", "Desktop Exec Summary", "Research Sprint"],
    path: "/global/workflows",
    icon: GitBranch,
  },
  {
    label: "Agents",
    description: "Configure prompts, models, and roles for agents.",
    examples: ["Project Definition", "MECE Critic", "Executive Review"],
    path: "/global/agents",
    icon: Bot,
  },
  {
    label: "Datasets",
    description: "Organization-wide datasets available to all projects.",
    examples: ["Market sizing", "Customer survey", "Pricing benchmarks"],
    path: "/global/datasets",
    icon: Database,
  },
  {
    label: "Models",
    description: "Shared model definitions and API configurations.",
    examples: ["Churn model", "Growth scenario", "LTV forecast"],
    path: "/global/models",
    icon: Box,
  },
  {
    label: "CGE Model Runner",
    description: "Run a computable general equilibrium demo workflow.",
    examples: ["Baseline shock", "Scenario run", "Impact report"],
    path: "/shared/cge-model",
    icon: Activity,
  },
  {
    label: "Exec Summary Template",
    description: "Standardize executive summary outputs.",
    examples: ["Board memo", "Decision brief", "Weekly exec update"],
    path: "/exec-summary-template",
    icon: FileText,
  },
];

export default function Shared() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
          <Share2 size={14} />
          <span>Shared resources for all projects</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Shared</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage global tools, templates, and datasets used across your workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SHARED_TOOLS.map((tool) => (
          <Card
            key={tool.path}
            className="p-5 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all group"
            onClick={() => navigate(tool.path)}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <tool.icon size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{tool.label}</h3>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0 group-hover:text-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Examples:</span>{" "}
                  <span>{tool.examples.join(" / ")}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
