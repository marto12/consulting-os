import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Database, ChevronLeft, Table } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/skeleton";
import { useUserContext } from "../lib/user-context";

interface Dataset {
  id: number;
  projectId: number | null;
  lastEditedByUserId?: number | null;
  name: string;
  description: string;
  owner: string;
  accessLevel: string;
  sourceType: string;
  sourceUrl: string | null;
  schemaJson: Array<{ name: string; type: string }> | null;
  metadata: any;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DatasetRow {
  id: number;
  datasetId: number;
  rowIndex: number;
  data: Record<string, string>;
}

export default function DatasetDetail() {
  const { id, datasetId } = useParams<{ id?: string; datasetId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGlobal = location.pathname.startsWith("/global/");
  const numericId = datasetId ? Number(datasetId) : Number.NaN;
  const projectId = !isGlobal && id ? Number(id) : undefined;
  const backPath = isGlobal ? "/global/datasets" : projectId ? `/project/${projectId}/datasets` : "/datasets";
  const { users } = useUserContext();
  const userLookup = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const datasetQuery = useQuery<Dataset>({
    queryKey: ["/api/data/datasets", numericId],
    queryFn: async () => {
      const res = await fetch(`/api/data/datasets/${numericId}`);
      if (!res.ok) throw new Error("Failed to load dataset");
      return res.json();
    },
    enabled: Number.isFinite(numericId),
  });

  const rowsQuery = useQuery<{ rows: DatasetRow[]; total: number }>({
    queryKey: ["/api/data/datasets", numericId, "rows", page],
    queryFn: async () => {
      const res = await fetch(`/api/data/datasets/${numericId}/rows?limit=${pageSize}&offset=${page * pageSize}`);
      if (!res.ok) throw new Error("Failed to load dataset rows");
      return res.json();
    },
    enabled: !!datasetQuery.data,
  });

  if (!Number.isFinite(numericId)) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">Invalid dataset id.</div>
      </Card>
    );
  }

  if (datasetQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (datasetQuery.isError || !datasetQuery.data) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">Dataset not found.</div>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(backPath)}>
          <ChevronLeft size={14} className="mr-1" />
          Back to datasets
        </Button>
      </Card>
    );
  }

  const dataset = datasetQuery.data;
  const editedBy = dataset.lastEditedByUserId ? userLookup.get(dataset.lastEditedByUserId) : null;
  const schema = Array.isArray(dataset.schemaJson) ? dataset.schemaJson : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="size-4" />
            Dataset
          </div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{dataset.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dataset.description || "No description"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(backPath)}>
          <ChevronLeft size={14} className="mr-1" />
          Back to datasets
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Details</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize">{dataset.accessLevel}</Badge>
              <Badge variant="secondary" className="text-[10px] capitalize">{dataset.sourceType}</Badge>
            </div>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Owner</span>
              <span className="text-foreground">{dataset.owner || "System"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Rows</span>
              <span className="text-foreground">{dataset.rowCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Columns</span>
              <span className="text-foreground">{schema.length}</span>
            </div>
            {editedBy && (
              <div className="flex items-center justify-between">
                <span>Last edited by</span>
                <span className="text-foreground">{editedBy}</span>
              </div>
            )}
            {dataset.sourceUrl && (
              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0">Source URL</span>
                <span className="text-foreground truncate">{dataset.sourceUrl}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">Schema</div>
          {schema.length === 0 ? (
            <div className="text-xs text-muted-foreground">No schema defined.</div>
          ) : (
            <div className="grid gap-2">
              {schema.map((col) => (
                <div key={col.name} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate">{col.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{col.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table size={16} />
            <div className="text-sm font-semibold">Data Preview</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {dataset.rowCount.toLocaleString()} rows
          </div>
        </div>
        {rowsQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading rows...</div>
        ) : rowsQuery.data && rowsQuery.data.rows.length > 0 ? (
          <div className="flex flex-col gap-3">
            <ScrollArea className="h-[50vh]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium sticky top-0 bg-background">#</th>
                      {schema.map((col) => (
                        <th key={col.name} className="px-3 py-2 text-left text-muted-foreground font-medium sticky top-0 bg-background whitespace-nowrap">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsQuery.data.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-1.5 text-muted-foreground">{row.rowIndex + 1}</td>
                        {schema.map((col) => (
                          <td key={col.name} className="px-3 py-1.5 max-w-[200px] truncate">
                            {(row.data as Record<string, string>)[col.name] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, dataset.rowCount)} of {dataset.rowCount.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={(page + 1) * pageSize >= dataset.rowCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronLeft size={14} className="rotate-180" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No data to preview.</div>
        )}
      </Card>
    </div>
  );
}
