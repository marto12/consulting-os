import { useState, useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Bot,
  Briefcase,
  Database,
  BarChart3,
  GitBranch,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Plus,
} from "lucide-react";
import Chat from "./pages/Chat";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Pipeline from "./pages/Pipeline";
import Pipelines from "./pages/Pipelines";
import SettingsPage from "./pages/Settings";
import AgentDetail from "./pages/AgentDetail";
import Datasets from "./pages/Datasets";
import Analysis from "./pages/Analysis";
import { ProjectProvider, useProjectContext } from "./lib/project-context";

const NAV_ITEMS = [
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/projects", icon: Briefcase, label: "Projects" },
  { to: "/datasets", icon: Database, label: "Datasets" },
  { to: "/analysis", icon: BarChart3, label: "Analysis" },
  { to: "/pipelines", icon: GitBranch, label: "Pipelines" },
];

function ProjectSelector({ collapsed }: { collapsed: boolean }) {
  const { projects, activeProject, setActiveProjectId } = useProjectContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (collapsed) {
    return (
      <div className="project-selector-collapsed" title={activeProject?.name || "No project"}>
        <button
          className="project-selector-icon-btn"
          onClick={() => setOpen(!open)}
        >
          <FolderOpen size={16} />
        </button>
        {open && (
          <div className="project-selector-dropdown project-selector-dropdown-collapsed" ref={ref}>
            <div className="project-selector-dropdown-header">Projects</div>
            {projects.map((p) => (
              <button
                key={p.id}
                className={`project-selector-option${activeProject?.id === p.id ? " active" : ""}`}
                onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
              >
                <span className="project-selector-option-name">{p.name}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <div className="project-selector-empty">No projects yet</div>
            )}
            <button
              className="project-selector-option project-selector-new"
              onClick={() => { navigate("/projects"); setOpen(false); }}
            >
              <Plus size={12} />
              <span>New Project</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="project-selector" ref={ref}>
      <button
        className="project-selector-trigger"
        onClick={() => setOpen(!open)}
        data-testid="project-selector"
      >
        <FolderOpen size={14} />
        <span className="project-selector-name">
          {activeProject ? activeProject.name : "Select Project"}
        </span>
        <ChevronDown size={13} className={`project-selector-chevron${open ? " open" : ""}`} />
      </button>
      {open && (
        <div className="project-selector-dropdown">
          <div className="project-selector-dropdown-header">Switch Project</div>
          {projects.map((p) => (
            <button
              key={p.id}
              className={`project-selector-option${activeProject?.id === p.id ? " active" : ""}`}
              onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
              data-testid={`project-option-${p.id}`}
            >
              <span className="project-selector-dot" />
              <span className="project-selector-option-name">{p.name}</span>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="project-selector-empty">No projects yet</div>
          )}
          <button
            className="project-selector-option project-selector-new"
            onClick={() => { navigate("/projects"); setOpen(false); }}
            data-testid="project-selector-new"
          >
            <Plus size={12} />
            <span>New Project</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-top">
        <div className="sidebar-logo">
          {!collapsed && <span className="sidebar-logo-text">Consulting OS</span>}
          {collapsed && <span className="sidebar-logo-icon">C</span>}
        </div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <ProjectSelector collapsed={collapsed} />

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to === "/projects" && location.pathname.startsWith("/project/")) ||
            (item.to === "/agents" && location.pathname.startsWith("/agent/"));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sidebar-link${isActive ? " active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}

function FullWidthLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="app-main app-main-full">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route path="/chat" element={<FullWidthLayout><Chat /></FullWidthLayout>} />
          <Route path="/agents" element={<AppLayout><Pipeline /></AppLayout>} />
          <Route path="/projects" element={<AppLayout><Projects /></AppLayout>} />
          <Route path="/datasets" element={<AppLayout><Datasets /></AppLayout>} />
          <Route path="/analysis" element={<AppLayout><Analysis /></AppLayout>} />
          <Route path="/pipelines" element={<AppLayout><Pipelines /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          <Route path="/project/:id" element={<AppLayout><ProjectDetail /></AppLayout>} />
          <Route path="/agent/:key" element={<AppLayout><AgentDetail /></AppLayout>} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
