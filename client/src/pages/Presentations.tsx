import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Presentation as PresentationIcon, Trash2, Clock, Layers } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

interface Presentation {
  id: number;
  title: string;
  projectId: number | null;
  theme: any;
  createdAt: string;
  updatedAt: string;
}

export default function Presentations() {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/presentations")
      .then(r => r.json())
      .then(setPresentations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createNew() {
    const res = await fetch("/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Presentation" }),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
