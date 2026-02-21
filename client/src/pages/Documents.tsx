import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, FileText, Trash2, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { useProjectContext } from "../lib/project-context";
import { useUserContext } from "../lib/user-context";

interface Document {
  id: number;
  projectId: number | null;
  lastEditedByUserId?: number | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function Documents() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { activeProject } = useProjectContext();
  const { activeUser, users } = useUserContext();
  const projectId = id ? Number(id) : activeProject?.id;
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/documents?projectId=${projectId}`)
      .then(r => r.json())
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function createNew() {
    if (!projectId) return;
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Document", projectId, lastEditedByUserId: activeUser?.id || null }),
    });
    const doc = await res.json();
    navigate(`/editor/${doc.id}`);
  }

  async function deleteDoc(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  function preview(content: string) {
    const text = content.replace(/<[^>]*>/g, "").trim();
    return text.length > 120 ? text.slice(0, 120) + "..." : text || "Empty document";
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered word processor with critical review and action comments
          </p>
        </div>
        <Button onClick={createNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Document
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No documents yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first document to get started with AI-powered editing</p>
          <Button onClick={createNew}>
            <Plus className="mr-2 h-4 w-4" />
            Create Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => (
            <Card
              key={doc.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors group"
              onClick={() => navigate(`/editor/${doc.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <CardTitle className="text-sm font-medium truncate">{doc.title}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => deleteDoc(e, doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <CardDescription className="text-xs line-clamp-2 mt-1">
                  {preview(doc.content)}
                </CardDescription>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  {timeAgo(doc.updatedAt)}
                  {doc.lastEditedByUserId && userLookup.get(doc.lastEditedByUserId) && (
                    <span className="ml-2">• {userLookup.get(doc.lastEditedByUserId)}</span>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
