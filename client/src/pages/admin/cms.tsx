import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllCmsContent, createCmsContent, updateCmsContent, uploadImage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Upload, ImageIcon } from "lucide-react";
import { useState } from "react";

export default function AdminCMS() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("home");
    const [isUploading, setIsUploading] = useState(false);

    const { data: content = {}, isLoading } = useQuery({
        queryKey: ["cms-content"],
        queryFn: fetchAllCmsContent,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCmsContent(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cms-content"] });
            toast({ title: t("cms.updated"), description: "Content saved successfully." });
        },
        onError: () => {
            toast({ title: t("common.error"), description: "Failed to save content.", variant: "destructive" });
        },
    });

    const createMutation = useMutation({
        mutationFn: createCmsContent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cms-content"] });
            toast({ title: t("cms.updated"), description: "Content created successfully." });
        },
    });

    const handleSave = (item: any, value: string) => {
        if (item.id) {
            updateMutation.mutate({ id: item.id, data: { value } });
        } else {
            createMutation.mutate({
                blockSlug: activeTab,
                contentKey: item.key,
                contentType: item.type,
                value,
                locale: 'en' // Default to English for now
            });
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, item: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const result = await uploadImage(file);
            handleSave(item, result.url);
        } catch (error) {
            console.error("Upload failed:", error);
            toast({ title: t("common.error"), description: "Image upload failed.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    // Helper to find content value by key
    const getContent = (key: string): any => {
        const blockContent = content[activeTab] || [];
        const item = blockContent.find((c: any) => c.contentKey === key);
        return item ? { ...item, value: item.value } : { key, value: "", type: "text" };
    };

    const SECTIONS = {
        home: {
            label: "Home Page",
            fields: [
                { key: "hero_title", label: "Hero Title", type: "text" },
                { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
                { key: "hero_image", label: "Hero Background Image", type: "image" },
                { key: "about_title", label: "About Section Title", type: "text" },
                { key: "about_desc", label: "About Section Description", type: "textarea" },
            ]
        },
        about: {
            label: "About Us",
            fields: [
                { key: "story_title", label: "Our Story Title", type: "text" },
                { key: "story_content", label: "Our Story Content", type: "textarea" },
            ]
        },
        contact: {
            label: "Contact",
            fields: [
                { key: "contact_title", label: "Contact Page Title", type: "text" },
                { key: "contact_subtitle", label: "Contact Page Subtitle", type: "text" },
            ]
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout type="admin">
                <div className="flex items-center justify-center min-h-[50vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout type="admin">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("cms.title")}</h1>
                    <p className="text-sm text-muted-foreground">{t("cms.description")}</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        {Object.entries(SECTIONS).map(([key, section]) => (
                            <TabsTrigger key={key} value={key}>{section.label}</TabsTrigger>
                        ))}
                    </TabsList>

                    {Object.entries(SECTIONS).map(([key, section]) => (
                        <TabsContent key={key} value={key} className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{section.label}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {section.fields.map((field) => {
                                        const item = getContent(field.key);
                                        // Override type from config if item doesn't exist yet
                                        if (!item.id) item.type = field.type;
                                        const displayValue = item.value || "";

                                        return (
                                            <div key={field.key} className="space-y-2">
                                                <Label>{field.label}</Label>

                                                {field.type === 'textarea' ? (
                                                    <div className="flex gap-2">
                                                        <Textarea
                                                            defaultValue={displayValue}
                                                            className="min-h-[100px]"
                                                            onBlur={(e) => handleSave(item, e.target.value)}
                                                        />
                                                    </div>
                                                ) : field.type === 'image' ? (
                                                    <div className="flex items-start gap-4">
                                                        {item.value ? (
                                                            <img
                                                                src={item.value}
                                                                alt={field.label}
                                                                className="w-32 h-20 object-cover rounded-md border border-border"
                                                            />
                                                        ) : (
                                                            <div className="w-32 h-20 bg-muted/50 rounded-md border border-border flex items-center justify-center text-muted-foreground">
                                                                <ImageIcon className="h-6 w-6" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleImageUpload(e, item)}
                                                                    disabled={isUploading}
                                                                    className="w-full max-w-sm cursor-pointer"
                                                                />
                                                                {isUploading && <Loader2 className="animate-spin h-4 w-4" />}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Upload a new image to replace the current one.
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <Input
                                                            defaultValue={displayValue}
                                                            onBlur={(e) => handleSave(item, e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
