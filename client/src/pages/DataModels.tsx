import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import {
  Database, Box, Plus, Loader2, Upload, Link, Trash2, Pencil,
  FileSpreadsheet, Table, Eye, X, ChevronLeft, ChevronRight, Globe
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";

interface Dataset {
  id: number;
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

interface Model {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

interface DatasetRow {
  id: number;
  datasetId: number;
  rowIndex: number;
  data: Record<string, string>;
}

export default function DataModels() {
  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [showCreateModel, setShowCreateModel] = useState(false);
  const [showEditDataset, setShowEditDataset] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showApiLink, setShowApiLink] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const [dsName, setDsName] = useState("");
  const [dsDesc, setDsDesc] = useState("");
  const [dsSourceType, setDsSourceType] = useState("manual");
  const [dsSourceUrl, setDsSourceUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelDesc, setModelDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const pageSize = 50;

  const { data: datasets, isLoading: loadingDs } = useQuery<Dataset[]>({ queryKey: ["/api/data/datasets"] });
  const { data: models, isLoading: loadingModels } = useQuery<Model[]>({ queryKey: ["/api/data/models"] });

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
        name: dsName,
        description: dsDesc,
        sourceType: dsSourceType,
        sourceUrl: dsSourceType === "api" ? dsSourceUrl : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets"] });
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
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets"] });
      setShowEditDataset(false);
      resetForm();
    },
  });

  const deleteDataset = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/data/datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets"] });
    },
  });

  const createModel = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data/models", { name: modelName, description: modelDesc });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data/models"] });
      setShowCreateModel(false);
      setModelName("");
      setModelDesc("");
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

  const handleCSVUpload = useCallback(async (file: File) => {
    if (!selectedDataset) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/data/datasets/${selectedDataset.id}/upload-csv`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadResult(`Uploaded ${data.rowCount} rows with ${data.columns.length} columns`);
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets"] });
    } catch (err: any) {
      setUploadResult(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, [selectedDataset]);

  const handleApiSave = async () => {
    if (!selectedDataset) return;
    await apiRequest("PUT", `/api/data/datasets/${selectedDataset.id}`, {
      sourceType: "api",
      sourceUrl: dsSourceUrl,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/data/datasets"] });
    setShowApiLink(false);
  };

  const sourceIcon = (type: string) => {
    switch (type) {
      case "csv": return <FileSpreadsheet size={14} className="text-emerald-400" />;
      case "api": return <Globe size={14} className="text-blue-400" />;
      default: return <Database size={14} className="text-muted-foreground" />;
    }
  };

  const sourceBadge = (type: string) => {
    switch (type) {
      case "csv": return <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-xs">CSV</Badge>;
      case "api": return <Badge className="bg-blue-500/15 text-blue-400 border-0 text-xs">API</Badge>;
      default: return <Badge variant="outline" className="text-xs">Manual</Badge>;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Data & Models</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage datasets and analytical models</p>
      </div>

      <Tabs defaultValue="datasets">
        <TabsList>
          <TabsTrigger value="datasets">
            <Database size={14} className="mr-1.5" />
            Datasets
          </TabsTrigger>
          <TabsTrigger value="models">
            <Box size={14} className="mr-1.5" />
            Models
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datasets" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => { resetForm(); setShowCreateDataset(true); }}>
              <Plus size={16} />
              Add Dataset
            </Button>
          </div>
          {loadingDs ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !datasets || datasets.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
              <Database size={40} strokeWidth={1.5} />
              <p className="text-sm">No datasets yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {datasets.map((ds) => (
                <Card key={ds.id} className="p-4 group hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    {sourceIcon(ds.sourceType)}
                    <h3 className="font-semibold text-sm truncate">{ds.name}</h3>
                    {sourceBadge(ds.sourceType)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{ds.description || "No description"}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{ds.rowCount.toLocaleString()} rows</span>
                    {ds.schemaJson && Array.isArray(ds.schemaJson) && (
                      <span>{ds.schemaJson.length} columns</span>
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
          )}
        </TabsContent>

        <TabsContent value="models" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowCreateModel(true)}>
              <Plus size={16} />
              Add Model
            </Button>
          </div>
          {loadingModels ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !models || models.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
              <Box size={40} strokeWidth={1.5} />
              <p className="text-sm">No models yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {models.map((m) => (
                <Card key={m.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Box size={16} className="text-primary" />
                    <h3 className="font-semibold text-sm">{m.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.description || "No description"}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dataset Dialog */}
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

      {/* Edit Dataset Dialog */}
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

      {/* CSV Upload Dialog */}
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
              <div className={`text-sm p-3 rounded-lg ${uploadResult.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-400"}`}>
                {uploadResult}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* API Link Dialog */}
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

      {/* Data Preview Dialog */}
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

      {/* Create Model Dialog */}
      <Dialog open={showCreateModel} onOpenChange={setShowCreateModel}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Model</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Model name" value={modelName} onChange={(e) => setModelName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What does this model do?" value={modelDesc} onChange={(e) => setModelDesc(e.target.value)} rows={3} />
            </div>
            <Button onClick={() => createModel.mutate()} disabled={!modelName || createModel.isPending}>
              {createModel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Model"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
