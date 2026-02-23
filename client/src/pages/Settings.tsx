import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Settings as SettingsIcon, Bell, Palette, Layers, Shield, User, Lock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { cn } from "../lib/utils";

const HIGHLIGHT_OPTIONS = [
  {
    id: "sky",
    label: "Sky",
    primary: "209 78% 45%",
    primaryForeground: "210 40% 98%",
    accent: "210 40% 96%",
    accentForeground: "220 15% 18%",
  },
  {
    id: "emerald",
    label: "Emerald",
    primary: "158 64% 38%",
    primaryForeground: "152 40% 98%",
    accent: "150 40% 96%",
    accentForeground: "160 15% 18%",
  },
  {
    id: "amber",
    label: "Amber",
    primary: "38 92% 42%",
    primaryForeground: "36 40% 98%",
    accent: "36 40% 96%",
    accentForeground: "28 20% 20%",
  },
  {
    id: "rose",
    label: "Rose",
    primary: "347 77% 46%",
    primaryForeground: "350 40% 98%",
    accent: "350 40% 96%",
    accentForeground: "340 20% 20%",
  },
  {
    id: "slate",
    label: "Slate",
    primary: "215 16% 40%",
    primaryForeground: "210 40% 98%",
    accent: "220 16% 94%",
    accentForeground: "220 15% 18%",
  },
];

const HIGHLIGHT_STORAGE_KEY = "ui-highlight";

export default function Settings() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [highlightId, setHighlightId] = useState(() => {
    const saved = localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
    if (saved && HIGHLIGHT_OPTIONS.some((option) => option.id === saved)) {
      return saved;
    }
    return HIGHLIGHT_OPTIONS[0].id;
  });

  useEffect(() => {
    const selection = HIGHLIGHT_OPTIONS.find((option) => option.id === highlightId) ?? HIGHLIGHT_OPTIONS[0];
    const root = document.documentElement;
    root.style.setProperty("--primary", selection.primary);
    root.style.setProperty("--primary-foreground", selection.primaryForeground);
    root.style.setProperty("--accent", selection.accent);
    root.style.setProperty("--accent-foreground", selection.accentForeground);
    root.style.setProperty("--ring", selection.primary);
    root.style.setProperty("--sidebar-primary", selection.primary);
    root.style.setProperty("--sidebar-primary-foreground", selection.primaryForeground);
    root.style.setProperty("--sidebar-accent", selection.accent);
    root.style.setProperty("--sidebar-accent-foreground", selection.accentForeground);
    root.style.setProperty("--sidebar-ring", selection.primary);
    localStorage.setItem(HIGHLIGHT_STORAGE_KEY, selection.id);
  }, [highlightId]);


  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      navigate(-1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-[92vw] h-[82vh] p-0 gap-0 bg-white">
        <div className="flex h-full overflow-hidden">
          <div className="w-64 border-r border-border bg-background/60 px-4 py-5">
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm font-semibold">Settings</div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenChange(false)}>
                <X size={16} />
              </Button>
            </div>
            <div className="space-y-1 text-sm">
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 bg-muted/60 text-foreground">
                <SettingsIcon className="size-4" />
                General
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted/40">
                <Bell className="size-4" />
                Notifications
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted/40">
                <Palette className="size-4" />
                Personalization
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted/40">
                <Layers className="size-4" />
                Apps
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted/40">
                <Shield className="size-4" />
                Data controls
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted/40">
                <Lock className="size-4" />
                Security
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted/40">
                <User className="size-4" />
                Account
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6" data-testid="settings-page">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">General</h2>
              <p className="text-sm text-muted-foreground">Adjust interface personalization.</p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <h2 className="text-lg font-semibold">Interface</h2>
                <p className="text-sm text-muted-foreground">Select an accent color for highlights and focus states.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label>Highlight color</Label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {HIGHLIGHT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setHighlightId(option.id)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                          highlightId === option.id ? "border-primary bg-accent text-foreground" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: `hsl(${option.primary})` }} />
                          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: `hsl(${option.accent})` }} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
