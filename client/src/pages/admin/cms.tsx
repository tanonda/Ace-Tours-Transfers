import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllCmsContent, createCmsContent, updateCmsContent, uploadImage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Save, Upload, ImageIcon, Bold, Italic, List,
  Heading1, Heading2, Link as LinkIcon, Undo, Redo, AlignLeft,
  AlignCenter, Code, Quote, Minus
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

// ─── Rich Text Editor (lightweight, no external deps) ────────────────────────

function ToolbarButton({
  onClick, title, active, children
}: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded text-sm hover:bg-muted transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}

function RichEditor({
  value, onChange, placeholder = "Start typing..."
}: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const insertLink = () => {
    // Save selection before opening dialog
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    setIsLinkDialogOpen(true);
  };

  const confirmLink = () => {
    if (!linkUrl) return;
    editorRef.current?.focus();
    // Restore saved selection
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    document.execCommand("createLink", false, linkUrl);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setLinkUrl("");
    setIsLinkDialogOpen(false);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted/30">
        <ToolbarButton onClick={() => exec("undo")} title="Undo"><Undo className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("redo")} title="Redo"><Redo className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => exec("formatBlock", "H1")} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "H2")} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "P")} title="Paragraph"><AlignLeft className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => exec("bold")} title="Bold"><Bold className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italic"><Italic className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("justifyCenter")} title="Center"><AlignCenter className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Bullet List"><List className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "BLOCKQUOTE")} title="Quote"><Quote className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "PRE")} title="Code Block"><Code className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("insertHorizontalRule")} title="Divider"><Minus className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={insertLink} title="Insert Link"><LinkIcon className="h-3.5 w-3.5" /></ToolbarButton>
      </div>

      {/* Link input (inline) */}
      {isLinkDialogOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-blue-50">
          <Input
            placeholder="https://..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmLink()}
            className="h-7 text-sm"
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={confirmLink}>Add</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setIsLinkDialogOpen(false)}>Cancel</Button>
        </div>
      )}

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[160px] p-4 text-sm focus:outline-none prose prose-sm max-w-none"
        style={{ lineHeight: 1.6 }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
        [contenteditable] h2 { font-size: 1.25rem; font-weight: 600; margin: 0.5rem 0; }
        [contenteditable] blockquote { border-left: 3px solid hsl(var(--primary)); padding-left: 1rem; color: hsl(var(--muted-foreground)); margin: 0.5rem 0; }
        [contenteditable] pre { background: hsl(var(--muted)); padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.8rem; }
        [contenteditable] ul { list-style: disc; padding-left: 1.5rem; }
        [contenteditable] a { color: hsl(var(--primary)); text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ─── Main CMS Page ─────────────────────────────────────────────────────────────

export default function AdminCMS() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("home");
  const [isUploading, setIsUploading] = useState(false);
  const [richContent, setRichContent] = useState<Record<string, string>>({});

  const { data: content = {}, isLoading } = useQuery({
    queryKey: ["cms-content"],
    queryFn: fetchAllCmsContent,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateCmsContent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-content"] });
      toast({ title: "Content saved", description: "Changes published successfully." });
    },
    onError: () => {
      toast({ title: t("common.error"), description: "Failed to save content.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: createCmsContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-content"] });
      toast({ title: "Content created", description: "New content block published." });
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
        locale: 'en'
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
      toast({ title: "Image uploaded", description: "Image has been saved." });
    } catch {
      toast({ title: t("common.error"), description: "Image upload failed.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const getContent = (key: string): any => {
    const blockContent = (content as any)[activeTab] || [];
    const item = blockContent.find((c: any) => c.contentKey === key);
    return item ? { ...item, value: item.value } : { key, value: "", type: "text" };
  };

  const SECTIONS = {
    home: {
      label: "Home Page",
      fields: [
        { key: "hero_title", label: "Hero Title", type: "text", description: "Main headline shown in the hero banner" },
        { key: "hero_subtitle", label: "Hero Subtitle", type: "text", description: "Supporting text below the headline" },
        { key: "hero_image", label: "Hero Background Image", type: "image", description: "1920×1080 recommended" },
        { key: "about_title", label: "About Section Title", type: "text", description: "Heading for the homepage about section" },
        { key: "about_desc", label: "About Section Body", type: "rich", description: "Rich text content for the about section" },
      ]
    },
    about: {
      label: "About Us",
      fields: [
        { key: "story_title", label: "Our Story Title", type: "text", description: "Heading for the about page" },
        { key: "story_content", label: "Our Story Body", type: "rich", description: "Full story content — supports rich formatting" },
        { key: "team_intro", label: "Team Introduction", type: "rich", description: "Introduction paragraph for the team section" },
      ]
    },
    contact: {
      label: "Contact",
      fields: [
        { key: "contact_title", label: "Contact Page Title", type: "text", description: "Page heading" },
        { key: "contact_subtitle", label: "Contact Page Subtitle", type: "text", description: "Supporting subtitle" },
        { key: "contact_intro", label: "Contact Introduction", type: "rich", description: "Opening paragraph on the contact page" },
      ]
    },
    footer: {
      label: "Footer",
      fields: [
        { key: "footer_tagline", label: "Footer Tagline", type: "text", description: "Short tagline shown in footer" },
        { key: "footer_about", label: "Footer About Blurb", type: "text", description: "1–2 sentence description in footer" },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("cms.title")}</h1>
            <p className="text-sm text-muted-foreground">Edit page content with rich text formatting — changes publish immediately.</p>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live CMS
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            {Object.entries(SECTIONS).map(([key, section]) => (
              <TabsTrigger key={key} value={key}>{section.label}</TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(SECTIONS).map(([key, section]) => (
            <TabsContent key={key} value={key} className="mt-4 space-y-4">
              {section.fields.map((field) => {
                const item = getContent(field.key);
                if (!item.id) item.type = field.type;
                const displayValue = item.value || "";
                const richKey = `${key}.${field.key}`;

                return (
                  <Card key={field.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{field.label}</CardTitle>
                          {field.description && (
                            <CardDescription className="mt-0.5">{field.description}</CardDescription>
                          )}
                        </div>
                        {field.type !== 'image' && (
                          <Button
                            size="sm"
                            disabled={updateMutation.isPending || createMutation.isPending}
                            onClick={() => handleSave(item, richContent[richKey] ?? displayValue)}
                          >
                            {(updateMutation.isPending || createMutation.isPending)
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <><Save className="h-3.5 w-3.5 mr-1" />Save</>
                            }
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {field.type === 'rich' ? (
                        <RichEditor
                          value={richContent[richKey] ?? displayValue}
                          onChange={(html) => setRichContent(prev => ({ ...prev, [richKey]: html }))}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                        />
                      ) : field.type === 'image' ? (
                        <div className="flex items-start gap-4">
                          {item.value ? (
                            <img
                              src={item.value}
                              alt={field.label}
                              className="w-40 h-24 object-cover rounded-lg border border-border"
                            />
                          ) : (
                            <div className="w-40 h-24 bg-muted/50 rounded-lg border border-border flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          <div className="flex-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, item)}
                                disabled={isUploading}
                                className="w-full max-w-sm cursor-pointer"
                              />
                              {isUploading && <Loader2 className="animate-spin h-4 w-4" />}
                            </label>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              <Upload className="h-3 w-3 inline mr-1" />
                              Uploads to Cloudinary — replaces current image immediately.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Input
                          defaultValue={displayValue}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          onChange={(e) => setRichContent(prev => ({ ...prev, [richKey]: e.target.value }))}
                          onBlur={(e) => handleSave(item, e.target.value)}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
