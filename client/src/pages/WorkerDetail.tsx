import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { useUserContext } from "../lib/user-context";
import { getAvatarGradient, getInitials } from "../lib/avatar-utils";
import { getWorkforceTitle } from "../lib/workforce-utils";

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { users } = useUserContext();
  const userId = id ? Number(id) : NaN;
  const user = users.find((u) => u.id === userId);

  const title = useMemo(() => {
    if (!user) return "consultant";
    return user.role || getWorkforceTitle(user.id, users.map((u) => u.id));
  }, [user, users]);

  return (
    <Dialog open onOpenChange={() => navigate("/global/workforce")}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Worker profile</DialogTitle>
        </DialogHeader>
        {!user ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Worker not found.
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-16 w-16 rounded-xl">
                <AvatarFallback
                  className="rounded-xl text-lg font-semibold text-white"
                  style={{ backgroundImage: getAvatarGradient(user.name) }}
                >
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-xl font-semibold text-foreground">{user.name}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                  <Briefcase className="size-3" />
                  {title}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => navigate("/global/workforce")}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
