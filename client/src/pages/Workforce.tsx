import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Users, Bot, Plus } from "lucide-react";
import { Card } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useUserContext } from "../lib/user-context";
import { getAvatarGradient, getInitials } from "../lib/avatar-utils";
import { WORKFORCE_TITLES, getWorkforceTitle } from "../lib/workforce-utils";
import { apiRequest, queryClient } from "../lib/query-client";

type Agent = {
  id: number;
  key: string;
  name: string;
  role: string;
  description: string;
};

const getAgentAvailability = (agent: Agent) => {
  if (agent.key.startsWith("doc_")) {
    return ["Document editor", "Spreadsheets", "Slides"];
  }

  return ["Process automation", "Document editor", "Spreadsheets", "Slides"];
};

export default function Workforce() {
  const navigate = useNavigate();
  const { users, isLoading: usersLoading } = useUserContext();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState(WORKFORCE_TITLES[0]);
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users", { name, email, role: title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreate(false);
      setName("");
      setEmail("");
      setTitle(WORKFORCE_TITLES[0]);
    },
  });

  const userIds = useMemo(() => users.map((user) => user.id), [users]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            Library
          </div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Workforce</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All human contributors and AI agents available in this workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/global/agents")}>Add agent</Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add human
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Human workers</h2>
            <p className="text-sm text-muted-foreground">Team members available for project assignments.</p>
          </div>
          <span className="text-xs text-muted-foreground">{users.length} total</span>
        </div>
        {usersLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading workers...</Card>
        ) : users.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No human workers found.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <Card key={user.id} className="p-4 cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm" onClick={() => navigate(`/global/workforce/${user.id}`)}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarFallback
                      className="rounded-lg text-sm font-semibold text-white"
                      style={{ backgroundImage: getAvatarGradient(user.name) }}
                    >
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {user.role || getWorkforceTitle(user.id, userIds)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Agents</h2>
            <p className="text-sm text-muted-foreground">AI workers that execute specialized tasks.</p>
          </div>
          <span className="text-xs text-muted-foreground">{agents.length} total</span>
        </div>
        {agentsLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading agents...</Card>
        ) : agents.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No agents available.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <Card
                key={agent.key}
                className="p-4 cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"
                onClick={() => navigate(`/global/agent/${agent.key}`)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarFallback
                      className="rounded-lg text-white"
                      style={{ backgroundImage: getAvatarGradient(agent.name) }}
                    >
                      <Bot className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{agent.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{agent.role || "Agent"}</div>
                    {agent.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getAgentAvailability(agent).map((location) => (
                        <Badge key={location} variant="secondary" className="text-[11px]">
                          {location}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add human worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g., Jordan Patel" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Select value={title} onValueChange={setTitle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select title" />
                </SelectTrigger>
                <SelectContent>
                  {WORKFORCE_TITLES.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!name || !email || createMutation.isPending}
            >
              {createMutation.isPending ? "Adding..." : "Add human"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
