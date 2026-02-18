import { useRef, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Bot,
  Briefcase,
  Database,
  GitBranch,
  Settings,
  ChevronDown,
  FolderOpen,
  Plus,
  Search,
  Command,
  ChevronsUpDown,
  Sparkles,
  BadgeCheck,
  CreditCard,
  Bell,
  LogOut,
  FileText,
} from "lucide-react";
import { cn } from "./lib/utils";
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
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "./components/ui/sidebar";
import { Separator } from "./components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
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
import DataModels from "./pages/DataModels";
import SettingsPage from "./pages/Settings";
import DocumentEditor from "./pages/DocumentEditor";
import Documents from "./pages/Documents";
import CommandPalette from "./components/CommandPalette";
import { ProjectProvider, useProjectContext } from "./lib/project-context";

const NAV_SECTIONS = [
  {
    label: "Projects",
    items: [
      { to: "/projects", icon: Briefcase, label: "All Projects" },
      { to: "/chat", icon: MessageSquare, label: "Chat" },
    ],
  },
  {
    label: "Workflows",
    items: [
      { to: "/workflows", icon: GitBranch, label: "Templates" },
    ],
  },
  {
    label: "Agents",
    items: [
      { to: "/agents", icon: Bot, label: "All Agents" },
    ],
  },
  {
    label: "Documents",
    items: [
      { to: "/documents", icon: FileText, label: "Word Processor" },
    ],
  },
  {
    label: "Data & Models",
    items: [
      { to: "/data", icon: Database, label: "Datasets & Models" },
    ],
  },
];

function ProjectSelector() {
  const { projects, activeProject, setActiveProjectId } = useProjectContext();
  const { state } = useSidebar();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative px-2" ref={ref}>
      <SidebarMenuButton
        tooltip="Projects"
        onClick={() => setOpen(!open)}
        className="w-full"
        data-testid="project-selector"
      >
        <FolderOpen className="text-sidebar-primary" />
        <span className="flex-1 truncate text-sidebar-accent-foreground text-[13px] font-medium">
          {activeProject ? activeProject.name : "Select Project"}
        </span>
        <ChevronDown size={13} className={cn("shrink-0 text-sidebar-foreground transition-transform", open && "rotate-180")} />
      </SidebarMenuButton>
      {open && (
        <div className={cn(
          "absolute z-[100] bg-popover border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95",
          isCollapsed ? "left-[calc(var(--sidebar-width-icon)+8px)] top-0 w-[200px]" : "left-2 right-2 top-[calc(100%+4px)]"
        )}>
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {isCollapsed ? "Projects" : "Switch Project"}
          </div>
          {projects.map((p) => (
            <button
              key={p.id}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-accent hover:text-accent-foreground transition-colors text-left",
                activeProject?.id === p.id && "bg-accent text-accent-foreground"
              )}
              onClick={() => {
                setActiveProjectId(p.id);
                setOpen(false);
                navigate(`/project/${p.id}`);
              }}
              data-testid={`project-option-${p.id}`}
            >
              {!isCollapsed && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeProject?.id === p.id ? "bg-primary" : "bg-foreground/20")} />}
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">No projects yet</div>
          )}
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-primary hover:bg-accent hover:text-accent-foreground transition-colors border-t border-border text-left"
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

function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
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
                  <span className="truncate text-xs text-sidebar-foreground">AI Workflow</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <ProjectSelector />
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to === "/projects" && location.pathname.startsWith("/project/")) ||
                    (item.to === "/agents" && location.pathname.startsWith("/agent/")) ||
                    (item.to === "/workflows" && location.pathname.startsWith("/workflow/")) ||
                    (item.to === "/documents" && location.pathname.startsWith("/editor"));

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton tooltip={item.label} isActive={isActive} asChild>
                        <NavLink to={item.to}>
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
        ))}
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
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Consultant</span>
                    <span className="truncate text-xs text-muted-foreground">user@example.com</span>
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
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">CN</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Consultant</span>
                      <span className="truncate text-xs text-muted-foreground">user@example.com</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
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

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1" />
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 border rounded-md transition-colors"
            onClick={() => document.dispatchEvent(new CustomEvent("open-command-palette"))}
          >
            <Command size={12} />
            <span>K</span>
          </button>
        </header>
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <CommandPalette />
        <Routes>
          <Route path="/chat" element={<FullWidthLayout><Chat /></FullWidthLayout>} />
          <Route path="/projects" element={<AppLayout><Projects /></AppLayout>} />
          <Route path="/project/:id" element={<AppLayout><ProjectDetail /></AppLayout>} />
          <Route path="/project/:id/workflow/:stepId" element={<FullWidthLayout><WorkflowStepWorkspace /></FullWidthLayout>} />
          <Route path="/workflows" element={<AppLayout><Workflows /></AppLayout>} />
          <Route path="/agents" element={<AppLayout><Agents /></AppLayout>} />
          <Route path="/agent/:key" element={<AppLayout><AgentDetail /></AppLayout>} />
          <Route path="/data" element={<AppLayout><DataModels /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          <Route path="/documents" element={<AppLayout><Documents /></AppLayout>} />
          <Route path="/editor" element={<FullWidthLayout><DocumentEditor /></FullWidthLayout>} />
          <Route path="/editor/:id" element={<FullWidthLayout><DocumentEditor /></FullWidthLayout>} />
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
