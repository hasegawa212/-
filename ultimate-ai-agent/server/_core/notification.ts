export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// In-memory notification store
const notifications: Notification[] = [];
const listeners: Set<(notification: Notification) => void> = new Set();

export function sendNotification(
  type: NotificationType,
  title: string,
  message: string
): Notification {
  const notification: Notification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    timestamp: new Date(),
    read: false,
  };

  notifications.push(notification);
  listeners.forEach((listener) => listener(notification));
  return notification;
}

export function getNotifications(): Notification[] {
  return [...notifications].reverse();
}

export function onNotification(
  callback: (notification: Notification) => void
): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
