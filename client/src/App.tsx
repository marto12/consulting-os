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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
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
      <div className="flex justify-center mb-2 relative" title={activeProject?.name || "No project"}>
        <button
          className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-sidebar-foreground flex items-center justify-center hover:bg-sidebar-hover hover:text-sidebar-active transition-colors"
          onClick={() => setOpen(!open)}
        >
          <FolderOpen size={16} />
        </button>
        {open && (
          <div className="absolute left-12 top-0 w-[200px] bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in-0 zoom-in-95" ref={ref}>
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground">Projects</div>
            {projects.map((p) => (
              <button
                key={p.id}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors text-left",
                  activeProject?.id === p.id && "bg-blue-500/15 text-white"
                )}
                onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
              >
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <div className="p-3 text-center text-xs text-sidebar-foreground">No projects yet</div>
            )}
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-blue-400 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5 text-left"
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
    <div className="px-2 mb-2 relative" ref={ref}>
      <button
        className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-white/10 bg-white/5 text-sidebar-active text-[13px] font-medium hover:bg-sidebar-hover hover:border-white/15 transition-colors text-left"
        onClick={() => setOpen(!open)}
        data-testid="project-selector"
      >
        <FolderOpen size={14} className="shrink-0 text-blue-400" />
        <span className="flex-1 truncate">
          {activeProject ? activeProject.name : "Select Project"}
        </span>
        <ChevronDown size={13} className={cn("shrink-0 text-sidebar-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-2 right-2 top-[calc(100%+4px)] bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground">Switch Project</div>
          {projects.map((p) => (
            <button
              key={p.id}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors text-left",
                activeProject?.id === p.id && "bg-blue-500/15 text-white"
              )}
              onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
              data-testid={`project-option-${p.id}`}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeProject?.id === p.id ? "bg-blue-500" : "bg-white/30")} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="p-3 text-center text-xs text-sidebar-foreground">No projects yet</div>
          )}
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-blue-400 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5 text-left"
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
    <aside className={cn(
      "flex flex-col shrink-0 bg-sidebar overflow-hidden transition-[width] duration-200",
      collapsed ? "w-[60px]" : "w-[240px]"
    )}>
      <div className="flex items-center justify-between px-4 min-h-[56px]">
        <div className="flex items-center gap-2 overflow-hidden">
          {!collapsed && <span className="text-[15px] font-bold text-white whitespace-nowrap">Consulting OS</span>}
          {collapsed && (
            <span className="w-7 h-7 rounded-md bg-blue-500 text-white flex items-center justify-center text-sm font-bold">C</span>
          )}
        </div>
        <button
          className="text-sidebar-foreground p-1 rounded-md hover:bg-sidebar-hover shrink-0 transition-colors"
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <ProjectSelector collapsed={collapsed} />

      <nav className="flex-1 flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to === "/projects" && location.pathname.startsWith("/project/")) ||
            (item.to === "/agents" && location.pathname.startsWith("/agent/"));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active transition-colors whitespace-nowrap overflow-hidden",
                isActive && "bg-sidebar-active-bg text-sidebar-active",
                collapsed && "justify-center px-2.5"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/5">
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active transition-colors",
            isActive && "bg-sidebar-active-bg text-sidebar-active",
            collapsed && "justify-center px-2.5"
          )}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-y-auto bg-background p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

function FullWidthLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-hidden flex flex-col bg-background">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
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
      </TooltipProvider>
    </BrowserRouter>
  );
}
