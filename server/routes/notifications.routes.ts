import type { Express } from "express";
import { storage } from "../storage.js";

import { requireAdmin, requireAuth, type RouteDeps } from "./shared.js";

export function registerNotificationsRoutes(app: Express, deps: RouteDeps) {
  const { sseClients } = deps;

  // Notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const notifications = await storage.getUnreadNotifications(req.session.userRole === 'admin' ? undefined : req.session.userId);
    res.json(notifications);
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await storage.markNotificationAsRead(req.params.id);
    // Broadcast to all SSE clients that a notification was read
    sseClients.forEach(client => {
      if (client.userId === req.session.userId || req.session.userRole === 'admin') {
        client.res.write(`event: notification_read\ndata: ${JSON.stringify({ id: req.params.id })}\n\n`);
      }
    });
    res.json({ success: true });
  });

  app.patch("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userRole === 'admin' ? undefined : req.session.userId;
      const unread = await storage.getUnreadNotifications(userId);
      for (const n of unread) await storage.markNotificationAsRead(n.id);
      res.json({ success: true, count: unread.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all read" });
    }
  });

  // SSE endpoint for real-time notifications (no external package needed)

  app.get("/api/notifications/stream", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    const client = { res, userId: req.session.userId!, role: req.session.userRole! };
    sseClients.push(client);

    // Send initial heartbeat
    res.write(`:heartbeat\n\n`);

    // Keepalive ping every 25s to prevent proxy timeouts
    const ping = setInterval(() => {
      try { res.write(`:ping\n\n`); } catch { clearInterval(ping); }
    }, 25000);

    req.on("close", () => {
      clearInterval(ping);
      const idx = sseClients.indexOf(client);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Expose broadcaster for use in booking creation routes
  (app as any)._sseClients = sseClients;

  // GET all notifications (admin only — includes read ones, for message board history)
  app.get("/api/notifications/all", requireAdmin, async (_req, res) => {
    try {
      const all = await storage.getAllNotifications(200);
      res.json(all);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // POST broadcast a message to all staff / specific user
  app.post("/api/notifications/broadcast", requireAdmin, async (req, res) => {
    try {
      const { title, message, type = "info", link, userId } = req.body;
      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ error: "Title and message are required" });
      }

      const notification = await storage.createNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        link: link?.trim() || null,
        userId: userId || null, // null = broadcast to all staff
        read: false,
      });

      // Push over SSE to connected clients
      const payload = JSON.stringify(notification);
      sseClients.forEach(client => {
        if (!userId || client.userId === userId || client.role === "admin" || client.role === "field_service") {
          try { client.res.write(`event: new_notification\ndata: ${payload}\n\n`); } catch { }
        }
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error("Failed to broadcast notification:", error);
      res.status(500).json({ error: "Failed to broadcast notification" });
    }
  });

  // DELETE a notification (admin only)
  app.delete("/api/notifications/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });



}
