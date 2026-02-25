import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationRead } from "@/lib/api";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

export function NotificationsPopover() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [, setLocation] = useLocation();
    const { user } = useAuth();
    const { toast } = useToast();
    const sseRef = useRef<EventSource | null>(null);

    const { data: notifications = [], isLoading: isLoadingNotifications } = useQuery({
        queryKey: ["notifications"],
        queryFn: fetchNotifications,
        refetchInterval: 60000,
    });

    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/notifications/mark-all-read", {
                method: "PATCH",
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    // D: SSE real-time connection for instant notifications
    useEffect(() => {
        if (!user) return;

        let retryTimeout: ReturnType<typeof setTimeout>;

        const connect = () => {
            const es = new EventSource("/api/notifications/stream", { withCredentials: true });
            sseRef.current = es;

            es.addEventListener("new_booking", (e) => {
                try {
                    const booking = JSON.parse(e.data);
                    queryClient.invalidateQueries({ queryKey: ["notifications"] });
                    queryClient.invalidateQueries({ queryKey: ["bookings"] });
                    queryClient.invalidateQueries({ queryKey: ["stats"] });
                    toast({
                        title: "New booking received",
                        description: `${booking.customerName} booked ${booking.tourName}`,
                    });
                } catch { /* ignore */ }
            });

            es.addEventListener("notification_read", () => {
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
            });

            es.onerror = () => {
                es.close();
                retryTimeout = setTimeout(connect, 10000);
            };
        };

        connect();

        return () => {
            sseRef.current?.close();
            clearTimeout(retryTimeout);
        };
    }, [user]);

    const handleNotificationClick = (notification: any) => {
        if (!notification.read) markReadMutation.mutate(notification.id);
        setOpen(false);
        if (notification.link) setLocation(notification.link);
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-600 rounded-full border-2 border-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <div>
                        <h4 className="font-medium leading-none">Notifications</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => markAllReadMutation.mutate()}
                            disabled={markAllReadMutation.isPending}
                        >
                            <CheckCheck className="h-3 w-3" />
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {isLoadingNotifications ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="mt-1 h-2 w-2 rounded-full bg-muted shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-muted rounded w-3/4" />
                                        <div className="h-3 bg-muted rounded w-full" />
                                        <div className="h-2 bg-muted rounded w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : notifications.length > 0 ? (
                        <div className="divide-y divide-border">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${!notification.read ? "bg-muted/20" : ""}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notification.read ? "bg-primary" : "bg-transparent"}`} />
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-none">{notification.title}</p>
                                            <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                                            <p className="text-xs text-muted-foreground pt-1">
                                                {new Date(notification.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            No notifications yet.
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
