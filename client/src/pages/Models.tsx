import { useState, useMemo, type MouseEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Box, Plus, Loader2 } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useUserContext } from "../lib/user-context";

interface Model {
  id: number;
  projectId: number | null;
  lastEditedByUserId?: number | null;
  name: string;
  description: string;
  createdAt: string;
}

export default function Models() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGlobal = location.pathname.startsWith("/global/");
  const projectId = !isGlobal && id ? Number(id) : undefined;
  const { activeUser, users } = useUserContext();
  const [showCreateModel, setShowCreateModel] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelDesc, setModelDesc] = useState("");

  const { data: models, isLoading: loadingModels } = useQuery<Model[]>({
    queryKey: ["/api/projects", projectId, "models"],
    queryFn: () => fetch(`/api/projects/${projectId}/models`).then(r => r.json()),
    enabled: !!projectId,
  });

  const { data: globalModels = [], isLoading: loadingGlobal } = useQuery<Model[]>({
    queryKey: ["/api/data/models", "shared"],
    queryFn: async () => {
      const res = await fetch("/api/data/models");
      const items = await res.json();
      return items.filter((m: Model) => !m.projectId);
    },
    enabled: isGlobal,
  });

  const { data: sharedModels = [], isLoading: loadingShared } = useQuery<Model[]>({
    queryKey: ["/api/projects", projectId, "models", "shared"],
    queryFn: () => fetch(`/api/projects/${projectId}/models/shared`).then(r => r.json()),
    enabled: !!projectId,
  });

  const createModel = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data/models", { projectId, lastEditedByUserId: activeUser?.id || null, name: modelName, description: modelDesc });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "models", "shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/models", "shared"] });
      setShowCreateModel(false);
      setModelName("");
      setModelDesc("");
    },
  });

  const linkModel = useMutation({
    mutationFn: async (modelId: number) => {
      await apiRequest("POST", `/api/projects/${projectId}/models/link`, { modelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "models", "shared"] });
    },
  });

  const unlinkModel = useMutation({
    mutationFn: async (modelId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/models/link/${modelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "models", "shared"] });
    },
  });

  const userLookup = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const skeletonCards = Array.from({ length: 6 });
  const handleRowClick = (modelId: number) => {
    if (isGlobal) {
      navigate(`/global/models/${modelId}`);
      return;
    }
    if (projectId) {
      navigate(`/project/${projectId}/models/${modelId}`);
    }
  };

  const stopPropagation = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Models</h1>
        <p className="text-sm text-muted-foreground mt-1">Track analytical and ML models</p>
      </div>

      {!projectId && !isGlobal && (
        <Card className="p-10 text-center">
          <Box size={40} strokeWidth={1.5} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a project to view models.</p>
        </Card>
      )}

      {isGlobal ? (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowCreateModel(true)}>
              <Plus size={16} />
              Add Model
            </Button>
          </div>

          {loadingGlobal ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {skeletonCards.map((_, idx) => (
                <Card key={`model-skeleton-${idx}`} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-7 w-16 mt-3" />
                </Card>
              ))}
            </div>
          ) : globalModels.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No shared models available.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shared Models</h2>
                <Badge variant="secondary" className="text-[10px]">{globalModels.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {globalModels.map((m) => (
                  <Card key={m.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Box size={16} className="text-primary" />
                      <h3 className="font-semibold text-sm">{m.name}</h3>
                      <Badge variant="outline" className="text-[10px]">Shared</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{m.description || "No description"}</p>
                    {m.lastEditedByUserId && userLookup.get(m.lastEditedByUserId) && (
                      <p className="text-[10px] text-muted-foreground mt-2">{userLookup.get(m.lastEditedByUserId)}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : projectId ? (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowCreateModel(true)}>
              <Plus size={16} />
              Add Model
            </Button>
          </div>

          {loadingModels ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {skeletonCards.map((_, idx) => (
                <Card key={`model-skeleton-${idx}`} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-7 w-16 mt-3" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Project Models</h2>
                  <Badge variant="secondary" className="text-[10px]">{models?.length || 0}</Badge>
                </div>
                {!models || models.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                    <Box size={40} strokeWidth={1.5} />
                    <p className="text-sm">No models yet</p>
                  </div>
                ) : (
                  <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr className="text-left text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Model</th>
                            <th className="px-4 py-3 font-medium">Description</th>
                            <th className="px-4 py-3 font-medium">Owner</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {models.map((m) => {
                            const isShared = !m.projectId;
                            const editorName = m.lastEditedByUserId ? userLookup.get(m.lastEditedByUserId) : null;
                            return (
                              <tr
                                key={m.id}
                                className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                                onClick={() => handleRowClick(m.id)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Box size={16} className="text-primary" />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-foreground truncate">{m.name}</div>
                                    </div>
                                    {isShared && <Badge variant="outline" className="text-[10px]">Shared</Badge>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  <span className="line-clamp-2">{m.description || "No description"}</span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {editorName || "System"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    {isShared && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                        onClick={(e) => { stopPropagation(e); unlinkModel.mutate(m.id); }}
                                      >
                                        Unlink
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
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shared Models</h2>
                  <Badge variant="secondary" className="text-[10px]">{sharedModels.length}</Badge>
                </div>
                {loadingShared ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {skeletonCards.map((_, idx) => (
                      <Card key={`shared-model-skeleton-${idx}`} className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Skeleton className="h-4 w-4 rounded-full" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                        <Skeleton className="h-3 w-full mb-2" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-7 w-16 mt-3" />
                      </Card>
                    ))}
                  </div>
                ) : sharedModels.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">No shared models available.</p>
                  </Card>
                ) : (
                  <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr className="text-left text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Model</th>
                            <th className="px-4 py-3 font-medium">Description</th>
                            <th className="px-4 py-3 font-medium">Owner</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sharedModels.map((m) => {
                            const editorName = m.lastEditedByUserId ? userLookup.get(m.lastEditedByUserId) : null;
                            return (
                              <tr
                                key={m.id}
                                className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                                onClick={() => handleRowClick(m.id)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Box size={16} className="text-primary" />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-foreground truncate">{m.name}</div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">Shared</Badge>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  <span className="line-clamp-2">{m.description || "No description"}</span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {editorName || "System"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => { stopPropagation(e); linkModel.mutate(m.id); }}
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
