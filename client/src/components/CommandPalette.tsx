import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Briefcase,
  GitBranch,
  Bot,
  Database,
  Box,
  Settings,
  MessageSquare,
  FileText,
} from "lucide-react";
import { cn } from "../lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["/api/projects"] });
  const { data: agents = [] } = useQuery<any[]>({ queryKey: ["/api/agents"] });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleCustomOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("open-command-palette", handleCustomOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const commands: CommandItem[] = [
    { id: "nav-projects", label: "All Projects", category: "Navigation", icon: <Briefcase size={16} />, action: () => navigate("/projects") },
    { id: "nav-chat", label: "Chat", category: "Navigation", icon: <MessageSquare size={16} />, action: () => navigate("/chat") },
    { id: "nav-workflows", label: "Workflow Templates", category: "Navigation", icon: <GitBranch size={16} />, action: () => navigate("/global/workflows") },
    { id: "nav-agents", label: "Agents", category: "Navigation", icon: <Bot size={16} />, action: () => navigate("/global/agents") },
    { id: "nav-datasets", label: "Datasets", category: "Navigation", icon: <Database size={16} />, action: () => navigate("/datasets") },
    { id: "nav-models", label: "Models", category: "Navigation", icon: <Box size={16} />, action: () => navigate("/models") },
    { id: "nav-settings", label: "Settings", category: "Navigation", icon: <Settings size={16} />, action: () => navigate("/settings") },
    ...projects.map((p: any) => ({
      id: `project-${p.id}`,
      label: p.name,
      description: p.objective,
      category: "Projects",
      icon: <Briefcase size={16} />,
      action: () => navigate(`/project/${p.id}`),
    })),
    ...agents.map((a: any) => ({
      id: `agent-${a.key}`,
      label: a.name,
      description: a.role,
      category: "Agents",
      icon: <Bot size={16} style={{ color: a.roleColor }} />,
      action: () => navigate(`/global/agent/${a.key}`),
    })),
  ];

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.action();
      setOpen(false);
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]" data-testid="command-palette">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-background border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Search size={16} className="text-muted-foreground" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search projects, agents, navigate..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="command-palette-input"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded border text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">No results found</div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {category}
                </div>
                {items.map((item) => {
                  const idx = flatIdx++;
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                        idx === selectedIdx && "bg-accent"
                      )}
                      onClick={() => handleSelect(item)}
                      data-testid={`command-item-${item.id}`}
                    >
                      <span className="text-muted-foreground">{item.icon}</span>
                      <span className="font-medium flex-1">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{item.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
