import { Fragment, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate, Link, useParams } from "react-router-dom";
import {
  Briefcase,
  Database,
  Box,
  GitBranch,
  Bot,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Plus,
  Command,
  ChevronsUpDown,
  Sparkles,
  BadgeCheck,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Home,
  ListChecks,
  Users,
  FileText,
  BarChart3,
  Presentation,
  BookOpen,
  Table,
} from "lucide-react";
import { cn } from "./lib/utils";
import { getAvatarGradient, getInitials } from "./lib/avatar-utils";
import { Button } from "./components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from "./components/ui/sidebar";
import { Separator } from "./components/ui/separator";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import Chat from "./pages/Chat";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import WorkflowStepWorkspace from "./pages/WorkflowStepWorkspace";
import Workflows from "./pages/Workflows";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
import Datasets from "./pages/Datasets";
import DatasetDetail from "./pages/DatasetDetail";
import Models from "./pages/Models";
import ModelDetail from "./pages/ModelDetail";
import ExecSummaryTemplate from "./pages/ExecSummaryTemplate";
import DocumentEditor from "./pages/DocumentEditor";
import Documents from "./pages/Documents";
import WorkflowEditor from "./pages/WorkflowEditor";
import Charts from "./pages/Charts";
import ChartDetail from "./pages/ChartDetail";
import Presentations from "./pages/Presentations";
import SlideEditor from "./pages/SlideEditor";
import Spreadsheets from "./pages/Spreadsheets";
import SpreadsheetEditor from "./pages/SpreadsheetEditor";
import HomePage from "./pages/Home";
import ProjectManagement from "./pages/ProjectManagement";
import Shared from "./pages/Shared";
import CGEModel from "./pages/CGEModel";
import TaskDetail from "./pages/TaskDetail";
import Workforce from "./pages/Workforce";
import Assets from "./pages/Assets";
import WorkerDetail from "./pages/WorkerDetail";
import SettingsPage from "./pages/Settings";
import CommandPalette from "./components/CommandPalette";
import { ProjectProvider, useProjectContext } from "./lib/project-context";
import { UserProvider, useUserContext } from "./lib/user-context";
import { NotificationsProvider } from "./components/notifications/NotificationsProvider";
import NotificationsBell from "./components/notifications/NotificationsBell";

type NavItem = {
  path: string;
  icon: React.ComponentType<any>;
  label: string;
  projectScoped?: boolean;
  shared?: boolean;
};


const APP_NAV_ITEMS: NavItem[] = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/projects", icon: Briefcase, label: "Projects" },
  { path: "/global/workforce", icon: Users, label: "Team" },
  { path: "/global/agents", icon: Bot, label: "Agents" },
  { path: "/global/workflows", icon: GitBranch, label: "Workflows" },
  { path: "/global/models", icon: Box, label: "Models" },
  { path: "/global/datasets", icon: Database, label: "Datasets" },
];

const HOME_STORAGE_KEY = "consulting-os:home-seen";

const PROJECT_NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Execution",
    items: [
      { path: "/management", icon: Briefcase, label: "Project management", projectScoped: true },
      { path: "/global/workflows", icon: GitBranch, label: "Workflows" },
    ],
  },
  {
    label: "Apps",
    items: [
      { path: "/documents", icon: FileText, label: "Documents", projectScoped: true },
      { path: "/spreadsheets", icon: Table, label: "Spreadsheets", projectScoped: true },
      { path: "/presentations", icon: Presentation, label: "Slides", projectScoped: true },
    ],
  },
  {
    label: "Analysis",
    items: [
      { path: "/models", icon: Box, label: "Models", projectScoped: true },
      { path: "/datasets", icon: Database, label: "Datasets", projectScoped: true },
      { path: "/charts", icon: BarChart3, label: "Charts", projectScoped: true },
    ],
  },
];

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, activeProject, setActiveProjectId } = useProjectContext();
  const { users, activeUser, setActiveUserId, isLoading } = useUserContext();
  const projectPrefix = activeProject ? `/project/${activeProject.id}` : "";
  const resolvePath = (path: string, projectScoped?: boolean) => {
    if (projectScoped && activeProject) return `${projectPrefix}${path}`;
    if (projectScoped && !activeProject) return "/projects";
    return path;
  };

  const isItemActive = (item: NavItem, to: string) =>
    location.pathname === to ||
    (item.path === "/projects" && location.pathname.startsWith("/project/")) ||
    (item.path === "/global/agents" &&
      (location.pathname.startsWith("/global/agent/") || location.pathname.startsWith("/agent/"))) ||
    (item.path === "/global/workflows" &&
      (location.pathname.startsWith("/global/workflow/") || location.pathname.startsWith("/workflow/"))) ||
    (item.path === "/global/workforce" && location.pathname.startsWith("/global/workforce")) ||
    (item.path === "/global/datasets" && location.pathname.startsWith("/global/datasets")) ||
    (item.path === "/global/models" && location.pathname.startsWith("/global/models")) ||
    (item.path === "/documents" && location.pathname.includes("/documents")) ||
    (item.path === "/spreadsheets" && location.pathname.includes("/spreadsheets")) ||
    (item.path === "/spreadsheets" && location.pathname.startsWith("/sheet")) ||
    (item.path === "/presentations" && location.pathname.includes("/presentations")) ||
    (item.path === "/presentations" && location.pathname.startsWith("/slides")) ||
    (item.path === "/charts" && location.pathname.includes("/charts")) ||
    (item.path === "/datasets" && location.pathname.includes("/datasets") && !location.pathname.startsWith("/global/")) ||
    (item.path === "/models" && location.pathname.includes("/models") && !location.pathname.startsWith("/global/"));

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className=""
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Consulting OS" asChild>
              <div className="cursor-default">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Briefcase className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-sidebar-accent-foreground">Consulting OS</span>
                  <span className="truncate text-xs text-sidebar-foreground">AI-native consulting</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>APP</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {APP_NAV_ITEMS.map((item) => {
                const to = resolvePath(item.path, item.projectScoped);
                const isActive = isItemActive(item, to);

                return (
                  <SidebarMenuItem key={`${item.label}-${item.path}`}>
                    <SidebarMenuButton tooltip={item.label} isActive={isActive} asChild>
                      <NavLink to={to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel>Current Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      variant="outline"
                      tooltip={activeProject ? activeProject.name : "Select Project"}
                      className="h-10 justify-between group-data-[collapsible=icon]:justify-center"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                          <FolderOpen className="size-4" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                          <span className="truncate font-semibold">
                            {activeProject ? activeProject.name : "Select Project"}
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Switch Project
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <DropdownMenuItem
                          key={project.id}
                          className={cn(
                            "flex items-center gap-2 text-sm",
                            activeProject?.id === project.id && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => {
                            setActiveProjectId(project.id);
                            navigate(`/project/${project.id}`);
                          }}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              activeProject?.id === project.id ? "bg-primary" : "bg-foreground/20"
                            )}
                          />
                          <span className="truncate">{project.name}</span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-muted-foreground">No projects yet</div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="flex items-center gap-2 text-sm text-primary" onClick={() => navigate("/projects")}>
                      <Plus size={12} />
                      <span>New Project</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>

            {activeProject ? (
              <div className="mt-2 group-data-[collapsible=icon]:mt-0">
                <SidebarMenu>
                  {PROJECT_NAV_SECTIONS.map((section) => (
                    <Fragment key={section.label}>
                      <div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden flex items-center gap-1">
                        <ChevronDown size={10} className="text-muted-foreground" />
                        {section.label}
                      </div>
                      {section.items.map((item) => {
                        const to = resolvePath(item.path, item.projectScoped);
                        const isActive = isItemActive(item, to);

                        return (
                          <SidebarMenuItem key={`${section.label}-${item.label}-${item.path}`}>
                            <SidebarMenuButton
                              isActive={isActive}
                              className="pl-6 text-muted-foreground hover:text-foreground"
                              asChild
                            >
                              <NavLink to={to}>
                                <item.icon />
                                <span>{item.label}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </Fragment>
                  ))}
                </SidebarMenu>
              </div>
            ) : (
              <div className="mx-2 mt-3 rounded-md border border-dashed border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Select a project to access documents, slides, charts, datasets, and models.
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback
                      className="rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundImage: getAvatarGradient(activeUser?.name) }}
                    >
                      {getInitials(activeUser?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{activeUser?.name ?? "Select User"}</span>
                    <span className="truncate text-xs text-muted-foreground">{activeUser?.email ?? "No user selected"}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Active User
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isLoading ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">Loading users...</div>
                ) : users.length > 0 ? (
                  users.map((u) => (
                    <DropdownMenuItem
                      key={u.id}
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        activeUser?.id === u.id && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => setActiveUserId(u.id)}
                    >
                      <Avatar className={cn("h-6 w-6 rounded-lg", activeUser?.id === u.id && "ring-2 ring-primary/40")}
                      >
                        <AvatarFallback
                          className="rounded-lg text-[10px] font-semibold text-white"
                          style={{ backgroundImage: getAvatarGradient(u.name) }}
                        >
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{u.name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{u.email}</span>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {u.role}
                      </span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-muted-foreground">No users yet</div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Sparkles />
                    Upgrade to Pro
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <BadgeCheck />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCard />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bell />
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function ProjectTopBar() {
  const { projects, activeProject, setActiveProjectId } = useProjectContext();
  const navigate = useNavigate();

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/60 px-4 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <FolderOpen size={14} />
            <span className="max-w-[220px] truncate text-xs font-medium">
              {activeProject ? activeProject.name : "Select Project"}
            </span>
            <ChevronDown size={12} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Switch Project
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.length > 0 ? (
            projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  activeProject?.id === p.id && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  setActiveProjectId(p.id);
                  navigate(`/project/${p.id}`);
                }}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", activeProject?.id === p.id ? "bg-primary" : "bg-foreground/20")} />
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-muted-foreground">No projects yet</div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-sm text-primary"
            onClick={() => navigate("/projects")}
          >
            <Plus size={12} />
            <span>New Project</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" asChild>
        <Link to="/projects">All Projects</Link>
      </Button>
    </header>
  );
}

function Breadcrumbs() {
  const location = useLocation();
  const { activeProject } = useProjectContext();

  const crumbs = useMemo(() => {
    const path = location.pathname;
    const parts: { label: string; to?: string }[] = [];

    if (path === "/projects" || path.startsWith("/project/")) {
      parts.push({ label: "Projects", to: "/projects" });
      if (path.startsWith("/project/")) {
        const projectName = activeProject?.name || "Project";
        const projectPath = activeProject?.id ? `/project/${activeProject.id}` : undefined;
        parts.push({ label: projectName, to: projectPath });
        if (path.includes("/management")) parts.push({ label: "Management" });
        if (path.includes("/workflow/")) parts.push({ label: "Workflow Step" });
        if (path.includes("/documents")) {
          parts.push({ label: "Workspace" });
          parts.push({ label: "Documents" });
        }
        if (path.includes("/spreadsheets")) {
          parts.push({ label: "Workspace" });
          parts.push({ label: "Spreadsheets" });
        }
        if (path.includes("/presentations")) {
          parts.push({ label: "Workspace" });
          parts.push({ label: "Slides" });
        }
        if (path.includes("/charts")) {
          parts.push({ label: "Artefacts" });
          parts.push({ label: "Charts" });
          if (path.includes("/charts/") && !path.endsWith("/charts")) parts.push({ label: "Detail" });
        }
        if (path.includes("/datasets")) {
          parts.push({ label: "Artefacts" });
          parts.push({ label: "Datasets" });
          if (path.includes("/datasets/") && !path.endsWith("/datasets")) parts.push({ label: "Detail" });
        }
        if (path.includes("/models")) {
          parts.push({ label: "Artefacts" });
          parts.push({ label: "Models" });
          if (path.includes("/models/") && !path.endsWith("/models")) parts.push({ label: "Detail" });
        }
      }
    } else if (path === "/chat") {
      parts.push({ label: "Chat" });
    } else if (path === "/home") {
      parts.push({ label: "Home" });
    } else if (path === "/shared") {
      parts.push({ label: "Library" });
    } else if (path === "/documents" || path.startsWith("/editor")) {
      parts.push({ label: "Workspace" });
      parts.push({ label: "Documents", to: "/documents" });
      if (path.startsWith("/editor")) parts.push({ label: "Editor" });
    } else if (path === "/spreadsheets" || path.startsWith("/sheet")) {
      parts.push({ label: "Workspace" });
      parts.push({ label: "Spreadsheets", to: "/spreadsheets" });
      if (path.startsWith("/sheet")) parts.push({ label: "Editor" });
    } else if (path === "/presentations" || path.startsWith("/slides")) {
      parts.push({ label: "Workspace" });
      parts.push({ label: "Slides", to: "/presentations" });
      if (path.startsWith("/slides")) parts.push({ label: "Editor" });
    } else if (path === "/charts" || path.startsWith("/charts/")) {
      parts.push({ label: "Artefacts" });
      parts.push({ label: "Charts", to: "/charts" });
      if (path.startsWith("/charts/") && path !== "/charts") parts.push({ label: "Detail" });
    } else if (path === "/datasets") {
      parts.push({ label: "Artefacts" });
      parts.push({ label: "Datasets" });
    } else if (path === "/models") {
      parts.push({ label: "Artefacts" });
      parts.push({ label: "Models" });
    } else if (path.startsWith("/global/")) {
      parts.push({ label: "Library", to: "/shared" });
      if (path === "/global/workforce") {
        parts.push({ label: "Workforce" });
      } else if (path.startsWith("/global/workforce/")) {
        parts.push({ label: "Workforce", to: "/global/workforce" });
        parts.push({ label: "Worker" });
      } else if (path === "/global/assets") {
        parts.push({ label: "Assets" });
      } else if (path === "/global/workflows" || path.startsWith("/global/workflow/")) {
        parts.push({ label: "Workflows", to: "/global/workflows" });
        if (path.startsWith("/global/workflow/")) parts.push({ label: "Editor" });
      } else if (path === "/global/agents" || path.startsWith("/global/agent/")) {
        parts.push({ label: "Agents", to: "/global/agents" });
        if (path.startsWith("/global/agent/")) parts.push({ label: "Detail" });
      } else if (path === "/global/datasets") {
        parts.push({ label: "Datasets" });
      } else if (path.startsWith("/global/datasets/")) {
        parts.push({ label: "Datasets", to: "/global/datasets" });
        parts.push({ label: "Detail" });
      } else if (path === "/global/models") {
        parts.push({ label: "Models" });
      } else if (path.startsWith("/global/models/")) {
        parts.push({ label: "Models", to: "/global/models" });
        parts.push({ label: "Detail" });
      }
    }

    return parts;
  }, [location.pathname, activeProject]);

  if (crumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm min-w-0 overflow-hidden">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && <ChevronRight size={12} className="text-muted-foreground/50 shrink-0" />}
          {crumb.to && i < crumbs.length - 1 ? (
            <Link to={crumb.to} className="text-muted-foreground hover:text-foreground transition-colors truncate">
              {crumb.label}
            </Link>
          ) : (
            <span className={cn("truncate", i === crumbs.length - 1 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function TopBar() {
  const { setActiveProjectId } = useProjectContext();
  const location = useLocation();
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();

  useEffect(() => {
    if (!location.pathname.startsWith("/project/")) return;
    const routeProjectId = projectId || id;
    if (routeProjectId) {
      const numericId = Number(routeProjectId);
      if (!Number.isNaN(numericId)) {
        setActiveProjectId(numericId);
      }
    }
  }, [id, projectId, location.pathname, setActiveProjectId]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4 sticky top-0 z-20">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumbs />
      <div className="flex-1" />
      <NotificationsBell />
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 border rounded-md transition-colors"
        onClick={() => document.dispatchEvent(new CustomEvent("open-command-palette"))}
      >
        <Command size={12} />
        <span>K</span>
      </button>
    </header>
  );
}

function HomeRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hasSeen = localStorage.getItem(HOME_STORAGE_KEY) === "true";
    if (!hasSeen) {
      localStorage.setItem(HOME_STORAGE_KEY, "true");
      if (location.pathname !== "/home") {
        navigate("/home", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="bg-muted/10 p-0 sm:p-4 md:p-6">
      <AppSidebar />
      <SidebarInset className="bg-card">
        <TopBar />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-full min-w-0">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function FullWidthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="bg-muted/10 p-0 sm:p-4 md:p-6">
      <AppSidebar />
      <SidebarInset className="bg-card">
        <TopBar />
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ProjectScopedRedirect({ path }: { path: string }) {
  const { activeProject } = useProjectContext();
  if (activeProject) {
    return <Navigate to={`/project/${activeProject.id}${path}`} replace />;
  }
  return <Navigate to="/projects" replace />;
}

function RedirectToGlobalWorkflow() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/global/workflows" replace />;
  return <Navigate to={`/global/workflow/${id}`} replace />;
}

function RedirectToGlobalAgent() {
  const { key } = useParams<{ key: string }>();
  if (!key) return <Navigate to="/global/agents" replace />;
  return <Navigate to={`/global/agent/${key}`} replace />;
}

function RedirectToProjectManagement() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/projects" replace />;
  return <Navigate to={`/project/${id}/management`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <ProjectProvider>
          <NotificationsProvider>
            <HomeRedirect />
            <CommandPalette />
            <Routes>
              <Route path="/chat" element={<FullWidthLayout><Chat /></FullWidthLayout>} />
              <Route path="/home" element={<AppLayout><HomePage /></AppLayout>} />
              <Route path="/tour" element={<Navigate to="/home" replace />} />
              <Route path="/projects" element={<AppLayout><Projects /></AppLayout>} />
              <Route path="/shared" element={<AppLayout><Shared /></AppLayout>} />
              <Route path="/shared/cge-model" element={<AppLayout><CGEModel /></AppLayout>} />
              <Route path="/global/workforce" element={<AppLayout><Workforce /></AppLayout>} />
              <Route path="/global/workforce/:id" element={<AppLayout><WorkerDetail /></AppLayout>} />
              <Route path="/global/assets" element={<AppLayout><Assets /></AppLayout>} />
              <Route path="/project/:id" element={<RedirectToProjectManagement />} />
              <Route path="/project/:id/management" element={<AppLayout><ProjectManagement /></AppLayout>} />
              <Route path="/project/:id/documents" element={<AppLayout><Documents /></AppLayout>} />
              <Route path="/project/:id/spreadsheets" element={<AppLayout><Spreadsheets /></AppLayout>} />
              <Route path="/project/:id/presentations" element={<AppLayout><Presentations /></AppLayout>} />
              <Route path="/project/:id/charts" element={<AppLayout><Charts /></AppLayout>} />
              <Route path="/project/:projectId/charts/:id" element={<FullWidthLayout><ChartDetail /></FullWidthLayout>} />
              <Route path="/project/:id/datasets" element={<AppLayout><Datasets /></AppLayout>} />
              <Route path="/project/:id/datasets/:datasetId" element={<AppLayout><DatasetDetail /></AppLayout>} />
              <Route path="/project/:id/models" element={<AppLayout><Models /></AppLayout>} />
              <Route path="/project/:id/models/:modelId" element={<AppLayout><ModelDetail /></AppLayout>} />
              <Route path="/project/:id/workflow/:stepId" element={<FullWidthLayout><WorkflowStepWorkspace /></FullWidthLayout>} />
              <Route path="/project/:id/management/task/:taskId" element={<AppLayout><TaskDetail /></AppLayout>} />
              <Route path="/global/workflows" element={<AppLayout><Workflows /></AppLayout>} />
              <Route path="/global/workflow/new" element={<FullWidthLayout><WorkflowEditor /></FullWidthLayout>} />
              <Route path="/global/workflow/:id" element={<FullWidthLayout><WorkflowEditor /></FullWidthLayout>} />
              <Route path="/global/agents" element={<AppLayout><Agents /></AppLayout>} />
              <Route path="/global/agent/:key" element={<AppLayout><AgentDetail /></AppLayout>} />
              <Route path="/global/datasets" element={<AppLayout><Datasets /></AppLayout>} />
              <Route path="/global/datasets/:datasetId" element={<AppLayout><DatasetDetail /></AppLayout>} />
              <Route path="/global/models" element={<AppLayout><Models /></AppLayout>} />
              <Route path="/global/models/:modelId" element={<AppLayout><ModelDetail /></AppLayout>} />
              <Route path="/workflows" element={<Navigate to="/global/workflows" replace />} />
              <Route path="/workflow/new" element={<Navigate to="/global/workflow/new" replace />} />
              <Route path="/workflow/:id" element={<RedirectToGlobalWorkflow />} />
              <Route path="/agents" element={<Navigate to="/global/agents" replace />} />
              <Route path="/agent/:key" element={<RedirectToGlobalAgent />} />
              <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
              <Route path="/datasets" element={<ProjectScopedRedirect path="/datasets" />} />
              <Route path="/models" element={<ProjectScopedRedirect path="/models" />} />
              <Route path="/data" element={<ProjectScopedRedirect path="/datasets" />} />
              <Route path="/charts" element={<ProjectScopedRedirect path="/charts" />} />
              <Route path="/charts/:id" element={<FullWidthLayout><ChartDetail /></FullWidthLayout>} />
              <Route path="/exec-summary-template" element={<AppLayout><ExecSummaryTemplate /></AppLayout>} />
              <Route path="/documents" element={<ProjectScopedRedirect path="/documents" />} />
              <Route path="/spreadsheets" element={<ProjectScopedRedirect path="/spreadsheets" />} />
              <Route path="/editor" element={<FullWidthLayout><DocumentEditor /></FullWidthLayout>} />
              <Route path="/editor/:id" element={<FullWidthLayout><DocumentEditor /></FullWidthLayout>} />
              <Route path="/presentations" element={<ProjectScopedRedirect path="/presentations" />} />
              <Route path="/sheet/:id" element={<FullWidthLayout><SpreadsheetEditor /></FullWidthLayout>} />
              <Route path="/slides/:id" element={<FullWidthLayout><SlideEditor /></FullWidthLayout>} />
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </NotificationsProvider>
        </ProjectProvider>
      </UserProvider>
    </BrowserRouter>
  );
}
