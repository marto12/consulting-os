import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Table, Trash2, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { useProjectContext } from "../lib/project-context";
import { useUserContext } from "../lib/user-context";

interface Spreadsheet {
  id: number;
  projectId: number | null;
  lastEditedByUserId?: number | null;
  name: string;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
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

export default function Spreadsheets() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { activeProject } = useProjectContext();
  const { activeUser, users } = useUserContext();
  const projectId = id ? Number(id) : activeProject?.id;
  const [sheets, setSheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setSheets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/spreadsheets?projectId=${projectId}`)
      .then((r) => r.json())
      .then(setSheets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  async function createNew() {
    if (!projectId) return;
    const columns = ["A", "B", "C", "D", "E"];
    const rows = Array.from({ length: 12 }, () => columns.map(() => ""));
    const res = await fetch("/api/spreadsheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Untitled Spreadsheet",
        projectId,
        lastEditedByUserId: activeUser?.id || null,
        columns,
        rows,
      }),
    });
    const sheet = await res.json();
    navigate(`/sheet/${sheet.id}`);
  }

  async function deleteSheet(e: React.MouseEvent, sheetId: number) {
    e.stopPropagation();
    if (!confirm("Delete this spreadsheet? This cannot be undone.")) return;
    await fetch(`/api/spreadsheets/${sheetId}`, { method: "DELETE" });
    setSheets((prev) => prev.filter((s) => s.id !== sheetId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spreadsheets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lightweight spreadsheet workbooks for structured analysis
          </p>
        </div>
        <Button onClick={createNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Spreadsheet
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : sheets.length === 0 ? (
        <div className="text-center py-20">
          <Table className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No spreadsheets yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first spreadsheet to organize inputs and calculations</p>
          <Button onClick={createNew}>
            <Plus className="mr-2 h-4 w-4" />
            Create Spreadsheet
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sheets.map((sheet) => (
            <Card
              key={sheet.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors group"
              onClick={() => navigate(`/sheet/${sheet.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Table className="h-4 w-4 text-primary shrink-0" />
                    <CardTitle className="text-sm font-medium truncate">{sheet.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => deleteSheet(e, sheet.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <CardDescription className="text-xs mt-1">
                  {sheet.rowCount.toLocaleString()} rows
                </CardDescription>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  {timeAgo(sheet.updatedAt)}
                  {sheet.lastEditedByUserId && userLookup.get(sheet.lastEditedByUserId) && (
                    <span className="ml-2">• {userLookup.get(sheet.lastEditedByUserId)}</span>
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
