import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationRead } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Bell, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminNotifications() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: fetchNotifications,
    });

    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
            if (!res.ok) throw new Error("Failed to mark all as read");
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });

    if (isLoading) {
        return (
            <DashboardLayout type="admin">
                <div className="flex items-center justify-center min-h-[50vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </DashboardLayout>
        );
    }

    const unreadCount = notifications.filter((n: any) => !n.read).length;

    return (
        <DashboardLayout type="admin">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.notifications")}</h1>
                        <p className="text-sm text-muted-foreground">Stay up to date with system alerts and bookings.</p>
                    </div>
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
                            <Check className="h-4 w-4 mr-2" /> Mark all read
                        </Button>
                    )}
                </div>

                <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
                    {notifications.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            You're all caught up! No notifications yet.
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {notifications.map((n: any) => (
                                <div
                                    key={n.id}
                                    className={`p-5 flex gap-4 transition-colors ${n.read ? 'bg-background hover:bg-muted/30' : 'bg-primary/5 hover:bg-primary/10'}`}
                                >
                                    <div className="pt-1">
                                        <div className={`w-2.5 h-2.5 rounded-full ${!n.read ? 'bg-primary' : 'bg-transparent border border-muted-foreground'}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between gap-4 mb-1">
                                            <h3 className={`font-semibold text-base ${!n.read ? 'text-foreground' : 'text-foreground/80'}`}>{n.title}</h3>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(n.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className={`text-sm mb-3 ${!n.read ? 'text-foreground/90' : 'text-muted-foreground'}`}>{n.message}</p>
                                        <div className="flex gap-3">
                                            {n.link && (
                                                <Button variant="secondary" size="sm" className="h-8 text-xs font-semibold" onClick={() => setLocation(n.link!)}>
                                                    View Details <ExternalLink className="h-3 w-3 ml-1.5" />
                                                </Button>
                                            )}
                                            {!n.read && (
                                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => markReadMutation.mutate(n.id)} disabled={markReadMutation.isPending}>
                                                    Mark as read
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
