import { useState, useRef, useCallback, useMemo, type MouseEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Database,
  Plus,
  Loader2,
  Upload,
  Link,
  Trash2,
  Pencil,
  FileSpreadsheet,
  Table,
  Eye,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
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

export default function Datasets() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGlobal = location.pathname.startsWith("/global/");
  const projectId = !isGlobal && id ? Number(id) : undefined;
  const { activeUser, users } = useUserContext();
  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [showEditDataset, setShowEditDataset] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showApiLink, setShowApiLink] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const [dsName, setDsName] = useState("");
  const [dsDesc, setDsDesc] = useState("");
  const [dsSourceType, setDsSourceType] = useState("manual");
  const [dsSourceUrl, setDsSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const pageSize = 50;

  const { data: datasets, isLoading: loadingDs } = useQuery<Dataset[]>({
    queryKey: ["/api/projects", projectId, "datasets"],
    queryFn: () => fetch(`/api/projects/${projectId}/datasets`).then(r => r.json()),
    enabled: !!projectId,
  });

  const { data: globalDatasets = [], isLoading: loadingGlobal } = useQuery<Dataset[]>({
    queryKey: ["/api/data/datasets", "shared"],
    queryFn: async () => {
      const res = await fetch("/api/data/datasets");
      const items = await res.json();
      return items.filter((ds: Dataset) => !ds.projectId);
    },
    enabled: isGlobal,
  });

  const { data: sharedDatasets = [], isLoading: loadingShared } = useQuery<Dataset[]>({
    queryKey: ["/api/projects", projectId, "datasets", "shared"],
    queryFn: () => fetch(`/api/projects/${projectId}/datasets/shared`).then(r => r.json()),
    enabled: !!projectId,
  });

  const previewQuery = useQuery<{ rows: DatasetRow[]; total: number }>({
    queryKey: ["/api/data/datasets", selectedDataset?.id, "rows", previewPage],
    queryFn: async () => {
      const res = await fetch(`/api/data/datasets/${selectedDataset!.id}/rows?limit=${pageSize}&offset=${previewPage * pageSize}`);
      return res.json();
    },
    enabled: showPreview && !!selectedDataset,
  });

  const createDataset = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data/datasets", {
        projectId,
        lastEditedByUserId: activeUser?.id || null,
        name: dsName,
        description: dsDesc,
        sourceType: dsSourceType,
        sourceUrl: dsSourceType === "api" ? dsSourceUrl : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets", "shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets", "shared"] });
      setShowCreateDataset(false);
      resetForm();
    },
  });

  const updateDataset = useMutation({
    mutationFn: async () => {
      if (!selectedDataset) return;
      const res = await apiRequest("PUT", `/api/data/datasets/${selectedDataset.id}`, {
        name: dsName,
        description: dsDesc,
        sourceType: dsSourceType,
        sourceUrl: dsSourceType === "api" ? dsSourceUrl : undefined,
        lastEditedByUserId: activeUser?.id || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets", "shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets", "shared"] });
      setShowEditDataset(false);
      resetForm();
    },
  });

  const deleteDataset = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/data/datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets", "shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets", "shared"] });
    },
  });

  const linkDataset = useMutation({
    mutationFn: async (datasetId: number) => {
      await apiRequest("POST", `/api/projects/${projectId}/datasets/link`, { datasetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets", "shared"] });
    },
  });

  const unlinkDataset = useMutation({
    mutationFn: async (datasetId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/datasets/link/${datasetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets", "shared"] });
    },
  });

  const resetForm = () => {
    setDsName("");
    setDsDesc("");
    setDsSourceType("manual");
    setDsSourceUrl("");
    setSelectedDataset(null);
  };

  const openEdit = (ds: Dataset) => {
    setSelectedDataset(ds);
    setDsName(ds.name);
    setDsDesc(ds.description);
    setDsSourceType(ds.sourceType);
    setDsSourceUrl(ds.sourceUrl || "");
    setShowEditDataset(true);
  };

  const openUpload = (ds: Dataset) => {
    setSelectedDataset(ds);
    setUploadResult(null);
    setShowUpload(true);
  };

  const openApiLink = (ds: Dataset) => {
    setSelectedDataset(ds);
    setDsSourceUrl(ds.sourceUrl || "");
    setShowApiLink(true);
  };

  const openPreview = (ds: Dataset) => {
    setSelectedDataset(ds);
    setPreviewPage(0);
    setShowPreview(true);
  };

  const handleCardClick = (ds: Dataset) => {
    if (isGlobal) {
      navigate(`/global/datasets/${ds.id}`);
      return;
    }
    if (projectId) {
      navigate(`/project/${projectId}/datasets/${ds.id}`);
    }
  };

  const stopPropagation = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const handleCSVUpload = useCallback(async (file: File) => {
    if (!selectedDataset) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (activeUser?.id) {
        formData.append("lastEditedByUserId", String(activeUser.id));
      }
      const res = await fetch(`/api/data/datasets/${selectedDataset.id}/upload-csv`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadResult(`Uploaded ${data.rowCount} rows with ${data.columns.length} columns`);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets", "shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets", "shared"] });
    } catch (err: any) {
      setUploadResult(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, [selectedDataset, projectId, activeUser]);

  const handleApiSave = async () => {
    if (!selectedDataset) return;
    await apiRequest("PUT", `/api/data/datasets/${selectedDataset.id}`, {
      sourceType: "api",
      sourceUrl: dsSourceUrl,
      lastEditedByUserId: activeUser?.id || null,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "datasets", "shared"] });
    queryClient.invalidateQueries({ queryKey: ["/api/data/datasets", "shared"] });
    setShowApiLink(false);
  };

  const sourceIcon = (type: string) => {
    switch (type) {
      case "csv":
        return <FileSpreadsheet size={14} className="text-muted-foreground" />;
      case "api":
        return <Globe size={14} className="text-muted-foreground" />;
      default:
        return <Database size={14} className="text-muted-foreground" />;
    }
  };

  const sourceBadge = (type: string) => {
    switch (type) {
      case "csv":
        return <Badge className="bg-muted text-muted-foreground border-0 text-xs">CSV</Badge>;
      case "api":
        return <Badge className="bg-muted text-muted-foreground border-0 text-xs">API</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Manual</Badge>;
    }
  };

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const skeletonCards = Array.from({ length: 6 });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Datasets</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage datasets and data sources</p>
      </div>

      {!projectId && !isGlobal && (
        <Card className="p-10 text-center">
          <Database size={40} strokeWidth={1.5} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a project to view datasets.</p>
        </Card>
      )}

      {isGlobal ? (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => { resetForm(); setShowCreateDataset(true); }}>
              <Plus size={16} />
              Add Dataset
            </Button>
          </div>
          {loadingGlobal ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {skeletonCards.map((_, idx) => (
                <Card key={`ds-skeleton-${idx}`} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex items-center gap-3 mt-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-7 w-16" />
                    <div className="ml-auto flex gap-1">
                      <Skeleton className="h-7 w-7" />
                      <Skeleton className="h-7 w-7" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : globalDatasets.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No shared datasets available.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shared Datasets</h2>
                <Badge variant="secondary" className="text-[10px]">{globalDatasets.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {globalDatasets.map((ds) => (
                  <Card key={ds.id} className="p-4 group hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      {sourceIcon(ds.sourceType)}
                      <h3 className="font-semibold text-sm truncate">{ds.name}</h3>
                      {sourceBadge(ds.sourceType)}
                      <Badge variant="outline" className="text-[10px]">Shared</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{ds.description || "No description"}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span>{ds.rowCount.toLocaleString()} rows</span>
                      {ds.schemaJson && Array.isArray(ds.schemaJson) && (
                        <span>{ds.schemaJson.length} columns</span>
                      )}
                      {ds.lastEditedByUserId && userLookup.get(ds.lastEditedByUserId) && (
                        <span>• {userLookup.get(ds.lastEditedByUserId)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openUpload(ds)}>
                        <Upload size={13} className="mr-1" />
                        CSV
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openApiLink(ds)}>
                        <Link size={13} className="mr-1" />
                        API
                      </Button>
                      {ds.rowCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openPreview(ds)}>
                          <Eye size={13} className="mr-1" />
                          Preview
                        </Button>
                      )}
                      <div className="ml-auto flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(ds)}>
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${ds.name}"? This will remove all data.`)) {
                              deleteDataset.mutate(ds.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : projectId ? (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => { resetForm(); setShowCreateDataset(true); }}>
              <Plus size={16} />
              Add Dataset
            </Button>
          </div>
          {loadingDs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {skeletonCards.map((_, idx) => (
                <Card key={`ds-skeleton-${idx}`} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex items-center gap-3 mt-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-7 w-16" />
                    <div className="ml-auto flex gap-1">
                      <Skeleton className="h-7 w-7" />
                      <Skeleton className="h-7 w-7" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Project Datasets</h2>
                  <Badge variant="secondary" className="text-[10px]">{datasets?.length || 0}</Badge>
                </div>
                {!datasets || datasets.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                    <Database size={40} strokeWidth={1.5} />
                    <p className="text-sm">No datasets yet</p>
                  </div>
                ) : (
                  <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr className="text-left text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Dataset</th>
                            <th className="px-4 py-3 font-medium">Source</th>
                            <th className="px-4 py-3 font-medium">Rows</th>
                            <th className="px-4 py-3 font-medium">Columns</th>
                            <th className="px-4 py-3 font-medium">Owner</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {datasets.map((ds) => {
                            const isShared = !ds.projectId;
                            const allowEdit = !isShared;
                            const editorName = ds.lastEditedByUserId ? userLookup.get(ds.lastEditedByUserId) : null;
                            return (
                              <tr
                                key={ds.id}
                                className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                                onClick={() => handleCardClick(ds)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {sourceIcon(ds.sourceType)}
                                    <div className="min-w-0">
                                      <div className="font-semibold text-foreground truncate">{ds.name}</div>
                                      <div className="text-[11px] text-muted-foreground truncate">{ds.description || "No description"}</div>
                                    </div>
                                    {sourceBadge(ds.sourceType)}
                                    {isShared && <Badge variant="outline" className="text-[10px]">Shared</Badge>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground capitalize">{ds.sourceType}</td>
                                <td className="px-4 py-3 text-muted-foreground">{ds.rowCount.toLocaleString()}</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {ds.schemaJson && Array.isArray(ds.schemaJson) ? ds.schemaJson.length : 0}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {editorName || ds.owner || "System"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    {allowEdit && (
                                      <>
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { stopPropagation(e); openUpload(ds); }}>
                                          <Upload size={13} className="mr-1" />
                                          CSV
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { stopPropagation(e); openApiLink(ds); }}>
                                          <Link size={13} className="mr-1" />
                                          API
                                        </Button>
                                      </>
                                    )}
                                    {ds.rowCount > 0 && (
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { stopPropagation(e); openPreview(ds); }}>
                                        <Eye size={13} className="mr-1" />
                                        Preview
                                      </Button>
                                    )}
                                    {allowEdit && (
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { stopPropagation(e); openEdit(ds); }}>
                                        <Pencil size={13} />
                                      </Button>
                                    )}
                                    {isShared ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                        onClick={(e) => { stopPropagation(e); unlinkDataset.mutate(ds.id); }}
                                      >
                                        Unlink
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          stopPropagation(e);
                                          if (confirm(`Delete "${ds.name}"? This will remove all data.`)) {
                                            deleteDataset.mutate(ds.id);
                                          }
                                        }}
                                      >
                                        <Trash2 size={13} />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shared Datasets</h2>
                  <Badge variant="secondary" className="text-[10px]">{sharedDatasets.length}</Badge>
                </div>
                {loadingShared ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : sharedDatasets.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">No shared datasets available.</p>
                  </Card>
                ) : (
                  <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr className="text-left text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Dataset</th>
                            <th className="px-4 py-3 font-medium">Source</th>
                            <th className="px-4 py-3 font-medium">Rows</th>
                            <th className="px-4 py-3 font-medium">Columns</th>
                            <th className="px-4 py-3 font-medium">Owner</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sharedDatasets.map((ds) => {
                            const editorName = ds.lastEditedByUserId ? userLookup.get(ds.lastEditedByUserId) : null;
                            return (
                              <tr
                                key={ds.id}
                                className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                                onClick={() => handleCardClick(ds)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {sourceIcon(ds.sourceType)}
                                    <div className="min-w-0">
                                      <div className="font-semibold text-foreground truncate">{ds.name}</div>
                                      <div className="text-[11px] text-muted-foreground truncate">{ds.description || "No description"}</div>
                                    </div>
                                    {sourceBadge(ds.sourceType)}
                                    <Badge variant="outline" className="text-[10px]">Shared</Badge>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground capitalize">{ds.sourceType}</td>
                                <td className="px-4 py-3 text-muted-foreground">{ds.rowCount.toLocaleString()}</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {ds.schemaJson && Array.isArray(ds.schemaJson) ? ds.schemaJson.length : 0}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {editorName || ds.owner || "System"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    {ds.rowCount > 0 && (
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { stopPropagation(e); openPreview(ds); }}>
                                        <Eye size={13} className="mr-1" />
                                        Preview
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => { stopPropagation(e); linkDataset.mutate(ds.id); }}
                                    >
                                      Use in project
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}

      <Dialog open={showCreateDataset} onOpenChange={setShowCreateDataset}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Dataset</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Dataset name" value={dsName} onChange={(e) => setDsName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What does this dataset contain?" value={dsDesc} onChange={(e) => setDsDesc(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Source Type</Label>
              <div className="flex gap-2">
                {["manual", "csv", "api"].map((t) => (
                  <Button key={t} variant={dsSourceType === t ? "default" : "outline"} size="sm" onClick={() => setDsSourceType(t)} className="capitalize">
                    {t === "csv" ? "CSV Upload" : t === "api" ? "API Link" : "Manual"}
                  </Button>
                ))}
              </div>
            </div>
            {dsSourceType === "api" && (
              <div className="space-y-2">
                <Label>API URL</Label>
                <Input placeholder="https://api.example.com/data" value={dsSourceUrl} onChange={(e) => setDsSourceUrl(e.target.value)} />
              </div>
            )}
            <Button onClick={() => createDataset.mutate()} disabled={!dsName || createDataset.isPending}>
              {createDataset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Dataset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDataset} onOpenChange={(open) => { setShowEditDataset(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Dataset</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Dataset name" value={dsName} onChange={(e) => setDsName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What does this dataset contain?" value={dsDesc} onChange={(e) => setDsDesc(e.target.value)} rows={3} />
            </div>
            <Button onClick={() => updateDataset.mutate()} disabled={!dsName || updateDataset.isPending}>
              {updateDataset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpload} onOpenChange={(open) => { setShowUpload(open); if (!open) setUploadResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload CSV to {selectedDataset?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCSVUpload(file);
              }}
            />
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith(".csv")) handleCSVUpload(file);
              }}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processing CSV...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Click or drag a CSV file here</p>
                  <p className="text-xs text-muted-foreground">First row should be column headers</p>
                </div>
              )}
            </div>
            {uploadResult && (
              <div className={`text-sm p-3 rounded-lg ${uploadResult.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
                {uploadResult}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showApiLink} onOpenChange={setShowApiLink}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link API to {selectedDataset?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>API Endpoint URL</Label>
              <Input placeholder="https://api.example.com/data" value={dsSourceUrl} onChange={(e) => setDsSourceUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground">The API should return JSON data. You can configure authentication and parameters later.</p>
            </div>
            <Button onClick={handleApiSave} disabled={!dsSourceUrl}>
              Save API Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table size={18} />
              {selectedDataset?.name} - Data Preview
              {selectedDataset && (
                <Badge variant="outline" className="ml-2 text-xs">{selectedDataset.rowCount.toLocaleString()} rows</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : previewQuery.data && previewQuery.data.rows.length > 0 ? (
            <div className="flex flex-col gap-3">
              <ScrollArea className="h-[50vh]">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left text-muted-foreground font-medium sticky top-0 bg-background">#</th>
                        {selectedDataset?.schemaJson && Array.isArray(selectedDataset.schemaJson) && selectedDataset.schemaJson.map((col) => (
                          <th key={col.name} className="px-3 py-2 text-left text-muted-foreground font-medium sticky top-0 bg-background whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewQuery.data.rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-muted-foreground">{row.rowIndex + 1}</td>
                          {selectedDataset?.schemaJson && Array.isArray(selectedDataset.schemaJson) && selectedDataset.schemaJson.map((col) => (
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
                  Showing {previewPage * pageSize + 1}-{Math.min((previewPage + 1) * pageSize, selectedDataset?.rowCount || 0)} of {selectedDataset?.rowCount.toLocaleString()}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7" disabled={previewPage === 0} onClick={() => setPreviewPage((p) => p - 1)}>
                    <ChevronLeft size={14} />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" disabled={(previewPage + 1) * pageSize >= (selectedDataset?.rowCount || 0)} onClick={() => setPreviewPage((p) => p + 1)}>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
              <Table size={32} strokeWidth={1.5} />
              <p className="text-sm">No data to preview</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
