import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Clock, Layers } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useProjectContext } from "../lib/project-context";
import { useUserContext } from "../lib/user-context";

interface Presentation {
  id: number;
  lastEditedByUserId?: number | null;
  title: string;
  projectId: number | null;
  theme: any;
  createdAt: string;
  updatedAt: string;
}

export default function Presentations() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { activeProject } = useProjectContext();
  const { activeUser, users } = useUserContext();
  const projectId = id ? Number(id) : activeProject?.id;
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setPresentations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/presentations?projectId=${projectId}`)
      .then(r => r.json())
      .then(setPresentations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function createNew() {
    if (!projectId) return;
    const res = await fetch("/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Presentation", projectId, lastEditedByUserId: activeUser?.id || null }),
    });
    const pres = await res.json();
    navigate(`/slides/${pres.id}`);
  }

  async function deletePres(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await fetch(`/api/presentations/${id}`, { method: "DELETE" });
    setPresentations(prev => prev.filter(p => p.id !== id));
  }

  function timeAgo(date: string) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={`presentation-skeleton-${idx}`} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-7 w-10 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3 mt-2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Presentations</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage slide decks</p>
        </div>
        <Button onClick={createNew}>
          <Plus size={16} className="mr-1" />
          New Presentation
        </Button>
      </div>

      {presentations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Layers size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium">No presentations yet</p>
          <p className="text-sm mt-1">Create your first slide deck to get started</p>
          <Button variant="outline" className="mt-4" onClick={createNew}>
            <Plus size={14} className="mr-1" />
            Create Presentation
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presentations.map(pres => (
            <Card
              key={pres.id}
              className="cursor-pointer hover:border-primary/40 transition-colors group"
              onClick={() => navigate(`/slides/${pres.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-10 h-7 rounded border flex items-center justify-center shrink-0"
                      style={{ backgroundColor: pres.theme?.bgColor || "#fff" }}
                    >
                      <Layers size={14} style={{ color: pres.theme?.accentColor || "#3b82f6" }} />
                    </div>
                    <CardTitle className="text-sm truncate">{pres.title}</CardTitle>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
                    onClick={(e) => deletePres(e, pres.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock size={11} />
                  {timeAgo(pres.updatedAt)}
                  {pres.lastEditedByUserId && userLookup.get(pres.lastEditedByUserId) && (
                    <span className="ml-2">• {userLookup.get(pres.lastEditedByUserId)}</span>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
