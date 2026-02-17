import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import {
  MessageSquare,
  Bot,
  Briefcase,
  Database,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Chat from "./pages/Chat";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Pipeline from "./pages/Pipeline";
import SettingsPage from "./pages/Settings";
import AgentDetail from "./pages/AgentDetail";
import Datasets from "./pages/Datasets";
import Analysis from "./pages/Analysis";

const NAV_ITEMS = [
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/projects", icon: Briefcase, label: "Projects" },
  { to: "/datasets", icon: Database, label: "Datasets" },
  { to: "/analysis", icon: BarChart3, label: "Analysis" },
];

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
      <Routes>
        <Route path="/chat" element={<FullWidthLayout><Chat /></FullWidthLayout>} />
        <Route path="/agents" element={<AppLayout><Pipeline /></AppLayout>} />
        <Route path="/projects" element={<AppLayout><Projects /></AppLayout>} />
        <Route path="/datasets" element={<AppLayout><Datasets /></AppLayout>} />
        <Route path="/analysis" element={<AppLayout><Analysis /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
        <Route path="/project/:id" element={<AppLayout><ProjectDetail /></AppLayout>} />
        <Route path="/agent/:key" element={<AppLayout><AgentDetail /></AppLayout>} />
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
