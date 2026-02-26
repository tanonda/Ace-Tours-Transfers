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
  AlignCenter, Code, Quote, Minus, RefreshCw
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';

// ─── Rich Text Editor (TipTap) ────────────────────────

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
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'min-h-[160px] p-4 text-sm focus:outline-none prose prose-sm max-w-none focus:ring-0 outline-none',
        style: 'line-height: 1.6',
      },
    },
  });

  // Sync editor content when value changes externally (e.g. from React Query refetch)
  const prevValue = useRef(value);
  useEffect(() => {
    if (editor && value !== prevValue.current) {
      prevValue.current = value;
      const currentHTML = editor.getHTML();
      if (value !== currentHTML) {
        editor.commands.setContent(value || "", false);
      }
    }
  }, [value, editor]);

  if (!editor) return null;

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted/30">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1" active={editor.isActive('heading', { level: 1 })}><Heading1 className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" active={editor.isActive('heading', { level: 2 })}><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraph" active={editor.isActive('paragraph') && !editor.isActive('heading')}><AlignLeft className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" active={editor.isActive('bold')}><Bold className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" active={editor.isActive('italic')}><Italic className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Center" active={editor.isActive({ textAlign: 'center' })}><AlignCenter className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List" active={editor.isActive('bulletList')}><List className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote" active={editor.isActive('blockquote')}><Quote className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block" active={editor.isActive('codeBlock')}><Code className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={addLink} title="Insert Link" active={editor.isActive('link')}><LinkIcon className="h-3.5 w-3.5" /></ToolbarButton>
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror { min-height: 160px; }
        .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin: 0.5rem 0; }
        .ProseMirror blockquote { border-left: 3px solid hsl(var(--primary)); padding-left: 1rem; color: hsl(var(--muted-foreground)); margin: 0.5rem 0; }
        .ProseMirror pre { background: hsl(var(--muted)); padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.8rem; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5rem; }
        .ProseMirror a { color: hsl(var(--primary)); text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ─── Main CMS Page ─────────────────────────────────────────────────────────────

const SECTIONS: Record<string, { label: string; fields: Array<{ key: string; label: string; type: string; description?: string }> }> = {
  home: {
    label: "Home Page",
    fields: [
      { key: "hero_title", label: "Hero Title", type: "text", description: "Main headline shown in the hero banner" },
      { key: "hero_subtitle", label: "Hero Subtitle", type: "text", description: "Supporting text below the headline" },
      { key: "hero_image", label: "Hero Background Image", type: "image", description: "1920×1080 recommended" },
      { key: "about_title", label: "About Section Title", type: "text", description: "Heading for the homepage about section" },
      { key: "about_desc", label: "About Section Body", type: "rich", description: "Rich text content for the about section" },
      { key: "tours_label", label: "Tours Section Label", type: "text", description: "Small label above the tours section heading" },
      { key: "tours_title", label: "Tours Section Title", type: "text", description: "Heading for the featured tours section" },
      { key: "tours_desc", label: "Tours Section Description", type: "text", description: "Intro paragraph under the tours heading" },
      { key: "cta_title", label: "CTA Banner Title", type: "text", description: "Heading for the call-to-action section" },
      { key: "cta_desc", label: "CTA Banner Description", type: "text", description: "Supporting text in the CTA section" },
    ]
  },
  about: {
    label: "About Us",
    fields: [
      { key: "story_title", label: "Our Story Title", type: "text", description: "Heading for the about page" },
      { key: "story_content", label: "Our Story Body", type: "rich", description: "Full story content — supports rich formatting" },
      { key: "team_intro", label: "Team Introduction", type: "rich", description: "Introduction paragraph for the team section" },
      { key: "mission_title", label: "Mission Title", type: "text", description: "Heading for the mission section" },
      { key: "mission_content", label: "Mission Content", type: "rich", description: "Mission statement body text" },
    ]
  },
  contact: {
    label: "Contact",
    fields: [
      { key: "contact_title", label: "Contact Page Title", type: "text", description: "Page heading" },
      { key: "contact_subtitle", label: "Contact Page Subtitle", type: "text", description: "Supporting subtitle" },
      { key: "contact_intro", label: "Contact Introduction", type: "rich", description: "Opening paragraph on the contact page" },
      { key: "contact_address", label: "Office Address", type: "text", description: "Physical address displayed on the contact page" },
      { key: "contact_hours", label: "Opening Hours", type: "text", description: "Business hours text" },
    ]
  },
  footer: {
    label: "Footer",
    fields: [
      { key: "footer_tagline", label: "Footer Tagline", type: "text", description: "Short tagline shown in footer" },
      { key: "footer_about", label: "Footer About Blurb", type: "text", description: "1–2 sentence description in footer" },
      { key: "footer_copyright", label: "Copyright Text", type: "text", description: "Copyright notice (year is prepended automatically)" },
    ]
  },
  tours: {
    label: "Tours Page",
    fields: [
      { key: "tours_page_title", label: "Page Title", type: "text", description: "Heading for the tours listing page" },
      { key: "tours_page_intro", label: "Page Introduction", type: "rich", description: "Introductory text on the tours page" },
    ]
  },
  transfers: {
    label: "Transfers Page",
    fields: [
      { key: "transfers_page_title", label: "Page Title", type: "text", description: "Heading for the transfers listing page" },
      { key: "transfers_page_intro", label: "Page Introduction", type: "rich", description: "Introductory text on the transfers page" },
    ]
  },
};

export default function AdminCMS() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("home");
  const [isUploading, setIsUploading] = useState(false);
  // Local edits keyed by "section.fieldKey" — holds the in-progress value
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});

  const { data: content = {}, isLoading, refetch } = useQuery({
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
    onError: () => {
      toast({ title: t("common.error"), description: "Failed to create content.", variant: "destructive" });
    },
  });

  /**
   * Get the latest saved item for a field.
   * The API returns ALL historical entries — we pick the one with the latest createdAt.
   */
  const getLatestContent = (blockSlug: string, fieldKey: string): { id?: string; value: string; type: string } => {
    const blockContent = (content as any)[blockSlug] || [];
    const matching = blockContent.filter((c: any) => c.contentKey === fieldKey);
    if (matching.length === 0) return { value: "", type: "text" };
    // Sort by createdAt desc and take the first
    const latest = [...matching].sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    return { id: latest.id, value: latest.value ?? "", type: latest.contentType ?? "text" };
  };

  const handleSave = (blockSlug: string, fieldKey: string, fieldType: string, value: string) => {
    const existing = getLatestContent(blockSlug, fieldKey);
    if (existing.id) {
      updateMutation.mutate({ id: existing.id, data: { value } });
    } else {
      createMutation.mutate({
        blockSlug,
        contentKey: fieldKey,
        contentType: fieldType,
        value,
        locale: 'en'
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockSlug: string, fieldKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadImage(file);
      handleSave(blockSlug, fieldKey, "image", result.url);
      toast({ title: "Image uploaded", description: "Image has been saved." });
    } catch {
      toast({ title: t("common.error"), description: "Image upload failed.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const editKey = (section: string, fieldKey: string) => `${section}.${fieldKey}`;

  const getDisplayValue = (section: string, fieldKey: string): string => {
    const localKey = editKey(section, fieldKey);
    // If user has typed something locally, use that
    if (localKey in localEdits) return localEdits[localKey];
    // Otherwise use the persisted value from the API
    return getLatestContent(section, fieldKey).value;
  };

  const isSaving = updateMutation.isPending || createMutation.isPending;

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
            <h1 className="text-2xl font-bold text-foreground">{t("cms.title", "Content Management")}</h1>
            <p className="text-sm text-muted-foreground">Edit page content with rich text formatting — changes publish immediately.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
            <Badge variant="secondary" className="gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live CMS
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(tab) => {
          setActiveTab(tab);
          setLocalEdits({}); // clear local edits when switching tabs
        }}>
          <TabsList className="flex-wrap h-auto gap-1">
            {Object.entries(SECTIONS).map(([key, section]) => (
              <TabsTrigger key={key} value={key}>{section.label}</TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(SECTIONS).map(([sectionKey, section]) => (
            <TabsContent key={sectionKey} value={sectionKey} className="mt-4 space-y-4">
              {section.fields.map((field) => {
                const savedItem = getLatestContent(sectionKey, field.key);
                const displayValue = getDisplayValue(sectionKey, field.key);
                const lKey = editKey(sectionKey, field.key);

                return (
                  <Card key={field.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{field.label}</CardTitle>
                          {field.description && (
                            <CardDescription className="mt-0.5">{field.description}</CardDescription>
                          )}
                          {savedItem.id && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono opacity-60">
                              ID: {savedItem.id.slice(0, 8)}…
                            </p>
                          )}
                        </div>
                        {field.type !== 'image' && (
                          <Button
                            size="sm"
                            disabled={isSaving}
                            onClick={() => handleSave(sectionKey, field.key, field.type, displayValue)}
                          >
                            {isSaving
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
                          key={`${sectionKey}-${field.key}-${savedItem.id ?? "new"}`}
                          value={displayValue}
                          onChange={(html) => setLocalEdits(prev => ({ ...prev, [lKey]: html }))}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                        />
                      ) : field.type === 'image' ? (
                        <div className="flex items-start gap-4">
                          {displayValue ? (
                            <img
                              src={displayValue}
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
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, sectionKey, field.key)}
                                disabled={isUploading}
                                className="w-full max-w-sm cursor-pointer text-sm"
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
                        <div className="space-y-1">
                          <Input
                            value={displayValue}
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                            onChange={(e) => setLocalEdits(prev => ({ ...prev, [lKey]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(sectionKey, field.key, field.type, displayValue);
                            }}
                          />
                          {savedItem.value && savedItem.value !== displayValue && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Unsaved changes — click Save to publish
                            </p>
                          )}
                        </div>
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
