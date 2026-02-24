import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Users, Bot, Plus, Check } from "lucide-react";
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
  const availabilityColumns = ["Process automation", "Document editor", "Spreadsheets", "Slides"];

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
        <div />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Human workers</h2>
            <p className="text-sm text-muted-foreground">Team members available for project assignments.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              Add human
            </Button>
          </div>
        </div>
        {usersLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading workers...</Card>
        ) : users.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No human workers found.</Card>
        ) : (
          <div className="space-y-2">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate(`/global/workforce/${user.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 rounded-lg">
                              <AvatarFallback
                                className="rounded-lg text-xs font-semibold text-white"
                                style={{ backgroundImage: getAvatarGradient(user.name) }}
                              >
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-foreground truncate">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3 text-muted-foreground uppercase tracking-wide text-[11px]">
                          {user.role || getWorkforceTitle(user.id, userIds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="text-xs text-muted-foreground text-right">{users.length} total</div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Agents</h2>
            <p className="text-sm text-muted-foreground">AI workers that execute specialized tasks.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => navigate("/global/agents")}>
              <Bot className="size-4" />
              Add agent
            </Button>
          </div>
        </div>
        {agentsLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading agents...</Card>
        ) : agents.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No agents available.</Card>
        ) : (
          <div className="space-y-2">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    {availabilityColumns.map((column) => (
                      <th key={column} className="px-3 py-3 font-medium text-center">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr
                      key={agent.key}
                      className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/global/agent/${agent.key}`)}
                    >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 rounded-lg">
                              <AvatarFallback
                                className="rounded-lg text-white"
                                style={{ backgroundImage: getAvatarGradient(agent.name) }}
                              >
                                <Bot className="size-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{agent.name}</div>
                              {agent.description && (
                                <div className="text-[11px] text-muted-foreground line-clamp-1">{agent.description}</div>
                              )}
                            </div>
                          </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{agent.role || "Agent"}</td>
                      {availabilityColumns.map((column) => {
                        const hasAccess = getAgentAvailability(agent).includes(column);
                        return (
                          <td key={column} className="px-3 py-3 text-center">
                            {hasAccess ? <Check className="size-4 text-emerald-600 inline" /> : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
            <div className="text-xs text-muted-foreground text-right">{agents.length} total</div>
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
