import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { useNotifications, type NotificationType } from "@/contexts/NotificationContext";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

const iconMap: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const colorMap: Record<NotificationType, string> = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  error: "text-red-500",
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, removeNotification } =
    useNotifications();
  const { t } = useI18n();

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-lg shadow-lg z-50">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-medium text-sm">{t("notifications.title")}</h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={markAllAsRead}
                  title={t("notifications.markAllRead")}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearAll}
                  title={t("notifications.clearAll")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("notifications.empty")}
                </p>
              ) : (
                <div className="divide-y">
                  {notifications.map((n) => {
                    const Icon = iconMap[n.type];
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors",
                          !n.read && "bg-primary/5"
                        )}
                        onClick={() => markAsRead(n.id)}
                      >
                        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", colorMap[n.type])} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", !n.read && "font-medium")}>
                            {n.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {n.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(n.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(n.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
