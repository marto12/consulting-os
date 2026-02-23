import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, ChevronUp, ArrowUpDown, Bot } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { getAvatarGradient, getInitials } from "../lib/avatar-utils";

interface Agent {
  id: number;
  key: string;
  name: string;
  description: string;
  role: string;
  roleColor: string;
  model: string;
}

const getAvailability = (agent: Agent) => {
  if (agent.key.startsWith("doc_")) {
    return ["Documents", "Spreadsheets", "Slides"];
  }

  return ["Workflows", "Documents", "Spreadsheets", "Slides"];
};

export default function Agents() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "role" | "model" | "description">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const collator = useMemo(
    () =>
      new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    []
  );

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    const query = filter.trim().toLowerCase();
    if (!query) return agents;

    return agents.filter((agent) => {
      const availability = getAvailability(agent).join(" ");
      const searchable = `${agent.name} ${agent.role} ${agent.model} ${agent.description} ${availability}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [agents, filter]);

  const sortedAgents = useMemo(() => {
    const sorted = [...filteredAgents].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      return collator.compare(left, right);
    });

    if (sortDir === "desc") {
      sorted.reverse();
    }

    return sorted;
  }, [filteredAgents, sortKey, sortDir, collator]);

  const handleSort = (key: "name" | "role" | "model" | "description") => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  };

  const renderSortIcon = (key: "name" | "role" | "model" | "description") => {
    if (key !== sortKey) {
      return <ArrowUpDown size={14} className="text-muted-foreground" />;
    }

    return sortDir === "asc" ? (
      <ChevronUp size={14} className="text-foreground" />
    ) : (
      <ChevronDown size={14} className="text-foreground" />
    );
  };

  if (isLoading) {
    const skeletonRows = Array.from({ length: 6 });
    return (
      <div className="space-y-3">
        <div className="sm:hidden space-y-3">
          {skeletonRows.map((_, idx) => (
            <Card key={`agent-skeleton-mobile-${idx}`} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6 mt-2" />
            </Card>
          ))}
        </div>
        <Card className="hidden sm:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Available In</th>
              </tr>
            </thead>
              <tbody>
                {skeletonRows.map((_, idx) => (
                  <tr key={`agent-skeleton-${idx}`} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-3 w-full" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">AI agents that power your consulting workflow</p>
        </div>
        <div className="w-full sm:max-w-xs">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter agents"
            aria-label="Filter agents"
          />
        </div>
      </div>

      {!agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Bot size={48} strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-foreground">No agents configured</h3>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="sm:hidden space-y-3">
            {sortedAgents.map((agent) => (
              <Card
                key={agent.id}
                className="cursor-pointer hover:shadow-md transition-shadow p-4"
                onClick={() => navigate(`/global/agent/${agent.key}`)}
                data-testid={`agent-card-${agent.key}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback
                      className="rounded-lg text-white"
                      style={{ backgroundImage: getAvatarGradient(agent.name) }}
                    >
                      <Bot className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{agent.model}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: agent.roleColor + "20", color: agent.roleColor }}
                  >
                    {agent.role}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">{agent.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getAvailability(agent).map((location) => (
                    <Badge key={location} variant="secondary" className="text-[11px]">
                      {location}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <Card className="hidden sm:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr className="text-muted-foreground">
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleSort("name")}
                      >
                        Agent
                        {renderSortIcon("name")}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleSort("role")}
                      >
                        Role
                        {renderSortIcon("role")}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleSort("model")}
                      >
                        Model
                        {renderSortIcon("model")}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2"
                        onClick={() => handleSort("description")}
                      >
                        Description
                        {renderSortIcon("description")}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">Available In</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-t cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/global/agent/${agent.key}`)}
                      data-testid={`agent-card-${agent.key}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarFallback
                              className="rounded-lg text-white"
                              style={{ backgroundImage: getAvatarGradient(agent.name) }}
                            >
                              <Bot className="size-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground truncate">{agent.name}</span>
                              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: agent.roleColor + "20", color: agent.roleColor }}
                        >
                          {agent.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{agent.model}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{agent.description}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {getAvailability(agent).map((location) => (
                            <Badge key={location} variant="secondary" className="text-[11px]">
                              {location}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
