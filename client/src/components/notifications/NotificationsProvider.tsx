import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

type NotificationVariant = "info" | "success" | "error";

type NotificationInput = {
  title: string;
  message?: string;
  variant?: NotificationVariant;
  duration?: number;
};

type NotificationItem = NotificationInput & {
  id: string;
  createdAt: number;
  readAt?: number | null;
  visible: boolean;
};

type NotificationsContextValue = {
  notify: (input: NotificationInput) => string;
  hideToast: (id: string) => void;
  remove: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  notifications: NotificationItem[];
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const DEFAULT_DURATION = 5200;
const EXIT_DURATION = 220;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [closingIds, setClosingIds] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, number>>(new Map());

  const hideToast = useCallback((id: string) => {
    setClosingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    if (timersRef.current.has(id)) {
      window.clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }

    window.setTimeout(() => {
      setNotifications((prev) => prev.map((item) => (item.id === id
        ? { ...item, visible: false, readAt: item.readAt ?? Date.now() }
        : item
      )));
      setClosingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, EXIT_DURATION);
  }, []);

  const remove = useCallback((id: string) => {
    if (timersRef.current.has(id)) {
      window.clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === id
      ? { ...item, readAt: item.readAt ?? Date.now() }
      : item
    )));
  }, []);

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    const id = createId();
    const duration = input.duration ?? DEFAULT_DURATION;
    const item: NotificationItem = {
      id,
      createdAt: Date.now(),
      readAt: null,
      visible: true,
      variant: input.variant ?? "info",
      ...input,
    };

    setNotifications((prev) => [item, ...prev].slice(0, 20));

    if (duration > 0) {
      const timeoutId = window.setTimeout(() => hideToast(id), duration);
      timersRef.current.set(id, timeoutId);
    }

    return id;
  }, [hideToast]);

  useEffect(() => () => {
    timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timersRef.current.clear();
  }, []);

  const value = useMemo(() => ({ notify, hideToast, remove, markRead, markAllRead, notifications }), [notify, hideToast, remove, markRead, markAllRead, notifications]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationsViewport notifications={notifications} closingIds={closingIds} onDismiss={hideToast} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}

function NotificationsViewport({
  notifications,
  closingIds,
  onDismiss,
}: {
  notifications: NotificationItem[];
  closingIds: Set<string>;
  onDismiss: (id: string) => void;
}) {
  const visibleNotifications = notifications.filter((item) => item.visible);
  if (visibleNotifications.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-3",
        "pointer-events-none"
      )}
      aria-live="polite"
    >
      {visibleNotifications.map((notification) => {
        const isClosing = closingIds.has(notification.id);
        const Icon = notification.variant === "success" ? CheckCircle2
          : notification.variant === "error" ? AlertTriangle
            : Info;

        return (
          <div
            key={notification.id}
            className={cn(
              "pointer-events-auto rounded-xl border border-border/70 bg-card/95 shadow-lg backdrop-blur",
              "px-4 py-3 text-sm text-foreground",
              notification.variant === "success" && "border-emerald-200/70",
              notification.variant === "error" && "border-rose-200/80"
            )}
            style={{ animation: `${isClosing ? "toast-out" : "toast-in"} ${EXIT_DURATION}ms ${isClosing ? "ease-in" : "ease-out"} forwards` }}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full",
                  notification.variant === "success" && "bg-emerald-100 text-emerald-700",
                  notification.variant === "error" && "bg-rose-100 text-rose-700",
                  notification.variant === "info" && "bg-slate-100 text-slate-700"
                )}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{notification.title}</div>
                {notification.message && (
                  <div className="mt-1 text-xs text-muted-foreground leading-snug">
                    {notification.message}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onDismiss(notification.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
