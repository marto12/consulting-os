import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Database, Box, Plus, Loader2 } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";

interface Dataset {
  id: number;
  name: string;
  description: string;
  owner: string;
  accessLevel: string;
  createdAt: string;
}

interface Model {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

export default function DataModels() {
  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [showCreateModel, setShowCreateModel] = useState(false);
  const [dsName, setDsName] = useState("");
  const [dsDesc, setDsDesc] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelDesc, setModelDesc] = useState("");

  const { data: datasets, isLoading: loadingDs } = useQuery<Dataset[]>({ queryKey: ["/api/data/datasets"] });
  const { data: models, isLoading: loadingModels } = useQuery<Model[]>({ queryKey: ["/api/data/models"] });

  const createDataset = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data/datasets", { name: dsName, description: dsDesc });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data/datasets"] });
      setShowCreateDataset(false);
      setDsName("");
      setDsDesc("");
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
            <Button size="sm" onClick={() => setShowCreateDataset(true)}>
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
                <Card key={ds.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={16} className="text-primary" />
                    <h3 className="font-semibold text-sm">{ds.name}</h3>
                    <Badge variant="default" className="ml-auto text-xs">{ds.accessLevel}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{ds.description || "No description"}</p>
                  <p className="text-xs text-muted-foreground mt-2">Owner: {ds.owner}</p>
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
            <Button onClick={() => createDataset.mutate()} disabled={!dsName || createDataset.isPending}>
              {createDataset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Dataset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
