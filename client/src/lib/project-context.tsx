import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface Project {
  id: number;
  name: string;
  objective: string;
  constraints: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectContextValue {
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: number | null) => void;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 10000,
  });

  const activeProject = useMemo(() => {
    if (activeId === null && projects.length > 0) return projects[0];
    return projects.find((p) => p.id === activeId) || null;
  }, [activeId, projects]);

  const value = useMemo(
    () => ({
      projects,
      activeProject,
      setActiveProjectId: setActiveId,
      isLoading,
    }),
    [projects, activeProject, isLoading]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider");
  return ctx;
}
