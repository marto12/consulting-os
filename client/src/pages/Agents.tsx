import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bot, ChevronRight } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";

interface Agent {
  id: number;
  key: string;
  name: string;
  description: string;
  role: string;
  roleColor: string;
  model: string;
}

export default function Agents() {
  const navigate = useNavigate();
  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  if (isLoading) {
    const skeletonCards = Array.from({ length: 6 });
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {skeletonCards.map((_, idx) => (
          <Card key={`agent-skeleton-${idx}`} className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6 mt-2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">AI agents that power your consulting workflow</p>
      </div>

      {!agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Bot size={48} strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-foreground">No agents configured</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all p-4"
              onClick={() => navigate(`/global/agent/${agent.key}`)}
              data-testid={`agent-card-${agent.key}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: agent.roleColor + "20" }}
                >
                  <Bot size={20} style={{ color: agent.roleColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: agent.roleColor + "20", color: agent.roleColor }}
                    >
                      {agent.role}
                    </span>
                    <span className="text-xs text-muted-foreground">{agent.model}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
