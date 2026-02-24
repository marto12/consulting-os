import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useNotifications } from "./NotificationsProvider";

export default function NotificationsBell() {
  const { notifications, markAllRead, markRead, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () => notifications.slice(0, 12),
    [notifications]
  );

  useEffect(() => {
    if (!open) return;
    markAllRead();
  }, [open, markAllRead]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className={cn(
          "relative h-8 w-8 rounded-md border border-border/60 text-muted-foreground",
          "flex items-center justify-center hover:text-foreground hover:bg-muted/40 transition-colors"
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
        )}
      </button>

      <div
        className={cn(
          "fixed right-4 top-14 z-50 w-[360px] max-w-[calc(100vw-2rem)]",
          "transition-all duration-200",
          open ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
        )}
      >
        <div className="rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Notifications</div>
              <div className="text-[11px] text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                onClick={() => markAllRead()}
                aria-label="Mark all read"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto px-3 py-2">
            {visibleNotifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              <div className="space-y-2">
                {visibleNotifications.map((notification) => {
                  const isUnread = !notification.readAt;
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "rounded-xl border border-border/60 bg-background/80 px-3 py-2.5",
                        isUnread && "border-primary/30"
                      )}
                      onMouseEnter={() => markRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">{notification.title}</div>
                          {notification.message && (
                            <div className="mt-1 text-[11px] text-muted-foreground leading-snug">
                              {notification.message}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                          onClick={() => remove(notification.id)}
                          aria-label="Remove notification"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
