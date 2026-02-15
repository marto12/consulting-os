import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Plus, ChevronRight, Briefcase } from "lucide-react";
import "./Projects.css";

const STAGE_LABELS: Record<string, string> = {
  created: "New",
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

function getStageColor(stage: string) {
  if (stage === "complete") return "var(--color-success)";
  if (stage.includes("approved")) return "var(--color-success)";
  if (stage.includes("draft") || stage === "execution_done") return "var(--color-warning)";
  return "var(--color-accent)";
}

function getStageProgress(stage: string): number {
  const stages = [
    "created", "issues_draft", "issues_approved", "hypotheses_draft",
    "hypotheses_approved", "execution_done", "execution_approved",
    "summary_draft", "complete",
  ];
  const idx = stages.indexOf(stage);
  if (idx === -1) return 0;
  return (idx / (stages.length - 1)) * 100;
}

export default function Projects() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [constraints, setConstraints] = useState("");

  const { data: projects, isLoading } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/projects", { name, objective, constraints });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCreate(false);
      setName("");
      setObjective("");
      setConstraints("");
    },
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">AI-Powered Strategy Workflow</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)} data-testid="create-project-btn">
          <Plus size={18} />
          New Project
        </button>
      </div>

      {isLoading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : !projects || projects.length === 0 ? (
        <div className="empty-state">
          <Briefcase size={48} strokeWidth={1.5} />
          <h3>No projects yet</h3>
          <p>Create your first project to start the AI consulting workflow</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((item: any) => {
            const stageColor = getStageColor(item.stage);
            const progress = getStageProgress(item.stage);
            const isPending = item.stage.includes("draft") || item.stage === "execution_done";
            return (
              <div
                key={item.id}
                className="card card-clickable project-card"
                onClick={() => navigate(`/project/${item.id}`)}
                data-testid={`project-card-${item.id}`}
              >
                <div className="project-card-header">
                  <div style={{ flex: 1 }}>
                    <h3 className="project-card-title">{item.name}</h3>
                    <p className="project-card-objective">{item.objective}</p>
                  </div>
                  <ChevronRight size={20} color="var(--color-text-muted)" />
                </div>
                <div className="project-card-footer">
                  <div className="stage-badge">
                    <span className="stage-dot" style={{ background: stageColor }} />
                    <span className="stage-text" style={{ color: stageColor }}>
                      {STAGE_LABELS[item.stage] || item.stage}
                    </span>
                    {isPending && (
                      <span className="pending-badge">Needs Review</span>
                    )}
                  </div>
                  <div className="progress-container">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%`, background: stageColor }} />
                    </div>
                    <span className="progress-text">{Math.round(progress)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Project</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="input-label">Project Name</label>
                <input
                  className="input-field"
                  placeholder="e.g., Market Entry Strategy"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  data-testid="project-name-input"
                />
              </div>
              <div>
                <label className="input-label">Objective</label>
                <textarea
                  className="input-field"
                  placeholder="What should this project achieve?"
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  rows={3}
                  data-testid="project-objective-input"
                />
              </div>
              <div>
                <label className="input-label">Constraints</label>
                <textarea
                  className="input-field"
                  placeholder="Budget limits, timeline, resources..."
                  value={constraints}
                  onChange={e => setConstraints(e.target.value)}
                  rows={3}
                  data-testid="project-constraints-input"
                />
              </div>
              <button
                className="btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "14px" }}
                onClick={() => createMutation.mutate()}
                disabled={!name || !objective || !constraints || createMutation.isPending}
                data-testid="submit-project-btn"
              >
                {createMutation.isPending ? <div className="spinner spinner-sm spinner-white" /> : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
