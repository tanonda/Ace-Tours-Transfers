/**
 * Notification Cleanup Job
 *
 * Deletes read notifications older than 90 days and unread notifications
 * older than 180 days to prevent unbounded table growth.
 *
 * Should be called periodically (e.g., once per day at startup or via cron).
 */

import { db } from "../../db.js";
import { sql } from "drizzle-orm";

const READ_RETENTION_DAYS = 90;
const UNREAD_RETENTION_DAYS = 180;

export async function cleanupNotifications(): Promise<{ deletedRead: number; deletedUnread: number }> {
  try {
    const readResult = await db.execute(
      sql`DELETE FROM notifications WHERE read = true AND created_at < NOW() - INTERVAL '${sql.raw(String(READ_RETENTION_DAYS))} days'`
    );
    const deletedRead = (readResult as any).rowCount ?? 0;

    const unreadResult = await db.execute(
      sql`DELETE FROM notifications WHERE read = false AND created_at < NOW() - INTERVAL '${sql.raw(String(UNREAD_RETENTION_DAYS))} days'`
    );
    const deletedUnread = (unreadResult as any).rowCount ?? 0;

    if (deletedRead > 0 || deletedUnread > 0) {
      console.log(`[CLEANUP] Notifications: deleted ${deletedRead} read (>${READ_RETENTION_DAYS}d) and ${deletedUnread} unread (>${UNREAD_RETENTION_DAYS}d)`);
    }

    return { deletedRead, deletedUnread };
  } catch (error) {
    console.error("[CLEANUP] Notification cleanup failed:", error);
    return { deletedRead: 0, deletedUnread: 0 };
  }
}
