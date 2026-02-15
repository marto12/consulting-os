import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { Briefcase, GitFork, Settings } from "lucide-react";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Pipeline from "./pages/Pipeline";
import SettingsPage from "./pages/Settings";
import AgentDetail from "./pages/AgentDetail";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <header className="layout-header">
        <div className="logo">Consulting OS</div>
        <nav className="tab-nav">
          <NavLink to="/" end className={({ isActive }) => `tab-link${isActive ? " active" : ""}`}>
            <Briefcase size={16} />
            Projects
          </NavLink>
          <NavLink to="/pipeline" className={({ isActive }) => `tab-link${isActive ? " active" : ""}`}>
            <GitFork size={16} />
            Pipeline
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `tab-link${isActive ? " active" : ""}`}>
            <Settings size={16} />
            Settings
          </NavLink>
        </nav>
      </header>
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Projects /></Layout>} />
        <Route path="/pipeline" element={<Layout><Pipeline /></Layout>} />
        <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/agent/:key" element={<AgentDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
