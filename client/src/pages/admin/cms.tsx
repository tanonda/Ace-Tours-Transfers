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
import { sanitizeHtml } from "@/components/shared-detail-components";
import { useState, useRef, useCallback, useEffect } from "react";

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
      className={`p-1.5 md:p-2 rounded-md transition-all duration-200 flex items-center justify-center ${active
        ? 'bg-primary/10 text-primary shadow-sm'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
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
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'min-h-[200px] p-5 text-base focus:outline-none prose prose-stone dark:prose-invert max-w-none focus:ring-0 outline-none placeholder:text-muted-foreground',
        style: 'line-height: 1.6',
      },
    },
  });

  // Keep editor content in sync with external value changes (e.g. from React Query)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
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
    <div className="border border-input rounded-xl overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-200 shadow-sm bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/10">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="h-4 w-4" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Paragraph"
          active={editor.isActive('paragraph') && !editor.isActive('heading')}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          active={editor.isActive('bold')}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          active={editor.isActive('italic')}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Center"
          active={editor.isActive({ textAlign: 'center' })}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
          active={editor.isActive('bulletList')}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
          active={editor.isActive('blockquote')}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
          active={editor.isActive('codeBlock')}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton
          onClick={addLink}
          title="Insert Link"
          active={editor.isActive('link')}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="flex-1 cursor-text" onClick={() => editor.chain().focus().run()} />

      <style>{`
        .ProseMirror { min-height: 200px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .ProseMirror h1 { font-size: 1.875rem; font-weight: 800; margin: 0.75rem 0; line-height: 1.2; letter-spacing: -0.02em; }
        .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0; line-height: 1.3; }
        .ProseMirror p { margin: 0.5rem 0; }
        .ProseMirror blockquote { border-left: 4px solid hsl(var(--primary)); padding-left: 1rem; color: hsl(var(--muted-foreground)); margin: 1rem 0; font-style: italic; background: hsl(var(--muted)/0.3); padding: 1rem; border-radius: 0 0.5rem 0.5rem 0; }
        .ProseMirror pre { background: hsl(var(--muted)/0.5); padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem; border: 1px solid hsl(var(--border)); overflow-x: auto; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .ProseMirror li { margin: 0.25rem 0; }
        .ProseMirror a { color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 4px; font-weight: 500; transition: color 0.2s; }
        .ProseMirror a:hover { color: hsl(var(--primary)/0.8); }
        .ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror ul { cursor: text; }
        .ProseMirror:focus { outline: none; }
      `}</style>
    </div>
  );
}

// ─── Main CMS Page ─────────────────────────────────────────────────────────────

export default function AdminCMS() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("home-page");
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
    "home-page": {
      label: "Home Page",
      fields: [
        // Hero
        { key: "hero_title_part1", label: "Hero Title — Line 1", type: "text", description: "White text: e.g. \"Time for your\"" },
        { key: "hero_title_part2", label: "Hero Title — Line 2", type: "text", description: "Orange italic text: e.g. \"next adventure\"" },
        { key: "hero_subtitle", label: "Hero Subtitle", type: "text", description: "Sentence below the headline in the hero" },
        { key: "hero_image", label: "Hero Background Image", type: "image", description: "1920×1080 recommended" },
        // About
        { key: "about_image", label: "About Section Image", type: "image", description: "Image next to the about text" },
        { key: "about_label", label: "About Label", type: "text", description: "Small uppercase label above the about heading" },
        { key: "about_title", label: "About Heading", type: "text", description: "Main about section heading" },
        { key: "about_desc1", label: "About Body — Paragraph 1", type: "rich", description: "First paragraph in the about section" },
        { key: "about_desc2", label: "About Body — Paragraph 2", type: "rich", description: "Second paragraph in the about section" },
        { key: "about_quote", label: "About Pull Quote", type: "text", description: "Italic quote card overlaid on the photo" },
        { key: "about_badge1", label: "Trust Badge 1", type: "text", description: "e.g. Fully Insured" },
        { key: "about_badge2", label: "Trust Badge 2", type: "text", description: "e.g. Experienced Drivers" },
        { key: "about_badge3", label: "Trust Badge 3", type: "text", description: "e.g. Custom Itineraries" },
        { key: "about_badge4", label: "Trust Badge 4", type: "text", description: "e.g. Safety First" },
        // Tours section
        { key: "tours_label", label: "Tours Section Label", type: "text", description: "Small label above the tours heading" },
        { key: "tours_title", label: "Tours Section Heading", type: "text", description: "e.g. Unforgettable Tours" },
        { key: "tours_desc", label: "Tours Section Description", type: "rich", description: "Subheading under the tours title" },
        // Transfers section
        { key: "transfers_label", label: "Transfers Section Label", type: "text", description: "" },
        { key: "transfers_title", label: "Transfers Section Heading", type: "text", description: "" },
        { key: "transfers_desc", label: "Transfers Description", type: "rich", description: "" },
        // Vehicles section
        { key: "vehicles_label", label: "Vehicles Section Label", type: "text", description: "" },
        { key: "vehicles_title", label: "Vehicles Section Heading", type: "text", description: "" },
        { key: "vehicles_desc", label: "Vehicles Description", type: "rich", description: "" },
        // CTA
        { key: "cta_title", label: "CTA Banner Heading", type: "text", description: "Large text in the orange CTA banner" },
        { key: "cta_desc", label: "CTA Banner Subtext", type: "text", description: "" },
        { key: "cta_button", label: "CTA Button Text", type: "text", description: "" },
        // Trust indicators
        { key: "trust_licensed", label: "Trust: Licensed Title", type: "text", description: "" },
        { key: "trust_licensed_desc", label: "Trust: Licensed Description", type: "text", description: "" },
        { key: "trust_rated", label: "Trust: Top Rated Title", type: "text", description: "" },
        { key: "trust_rated_desc", label: "Trust: Top Rated Description", type: "text", description: "" },
        { key: "trust_secure", label: "Trust: Secure Title", type: "text", description: "" },
        { key: "trust_secure_desc", label: "Trust: Secure Description", type: "text", description: "" },
      ]
    },
    about: {
      label: "About Us",
      fields: [
        { key: "page_title", label: "Page Title", type: "text", description: "H1 at top of the about page" },
        { key: "page_subtitle", label: "Page Subtitle", type: "text", description: "Subheading under the page title" },
        { key: "story_title", label: "Our Story — Heading", type: "text", description: "" },
        { key: "story_image", label: "Our Story — Image", type: "image", description: "Image displayed alongside our story" },
        { key: "story_desc1", label: "Our Story — Paragraph 1", type: "rich", description: "" },
        { key: "story_desc2", label: "Our Story — Paragraph 2", type: "rich", description: "" },
        { key: "badge1", label: "Credential Badge 1", type: "text", description: "e.g. Locally Owned & Operated" },
        { key: "badge2", label: "Credential Badge 2", type: "text", description: "" },
        { key: "badge3", label: "Credential Badge 3", type: "text", description: "" },
        { key: "badge4", label: "Credential Badge 4", type: "text", description: "" },
        { key: "badge5", label: "Credential Badge 5", type: "text", description: "" },
        { key: "badge6", label: "Credential Badge 6", type: "text", description: "" },
        { key: "why_choose_us", label: "Why Choose Us — Heading", type: "text", description: "" },
        { key: "feature1_title", label: "Feature 1 Title", type: "text", description: "e.g. Local Expertise" },
        { key: "feature1_desc", label: "Feature 1 Description", type: "rich", description: "" },
        { key: "feature2_title", label: "Feature 2 Title", type: "text", description: "" },
        { key: "feature2_desc", label: "Feature 2 Description", type: "rich", description: "" },
        { key: "feature3_title", label: "Feature 3 Title", type: "text", description: "" },
        { key: "feature3_desc", label: "Feature 3 Description", type: "rich", description: "" },
      ]
    },
    contact: {
      label: "Contact",
      fields: [
        { key: "page_title", label: "Page Title", type: "text", description: "H1 at top of the contact page" },
        { key: "page_subtitle", label: "Page Subtitle", type: "text", description: "" },
        { key: "get_in_touch_desc", label: "Intro Paragraph", type: "rich", description: "Opening paragraph below the title" },
        { key: "phone_availability", label: "Phone Availability Note", type: "text", description: "e.g. Available 24/7 for emergencies" },
        { key: "email_reply_time", label: "Email Reply Time Note", type: "text", description: "e.g. We usually reply within 24 hours" },
        { key: "office_hours", label: "Office Hours Note", type: "rich", description: "" },
        { key: "whatsapp_desc", label: "WhatsApp CTA Description", type: "text", description: "Text under the WhatsApp chat button" },
      ]
    },
    footer: {
      label: "Footer",
      fields: [
        { key: "description", label: "Footer Description", type: "text", description: "2–3 sentences shown below the logo in the footer" },
        { key: "copyright", label: "Copyright Text", type: "text", description: "Text after the year and company name, e.g. All rights reserved." },
      ]
    },
    faq: {
      label: "FAQ",
      fields: Array.from({ length: 20 }, (_, i) => [
        { key: `faq${i + 1}_q`, label: `Question ${i + 1}`, type: "text" },
        { key: `faq${i + 1}_a`, label: `Answer ${i + 1}`, type: "rich" }
      ]).flat()
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
                          {(field as any).description && (
                            <CardDescription className="mt-0.5">{(field as any).description}</CardDescription>
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
                      <div className={field.type === 'image' ? "" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
                        {/* Edit Column */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">✏️ Edit</p>
                          {field.type === 'rich' ? (
                            <RichEditor
                              value={richContent[richKey] ?? displayValue}
                              onChange={(html) => setRichContent(prev => ({ ...prev, [richKey]: html }))}
                              placeholder={`Enter ${field.label.toLowerCase()}...`}
                            />
                          ) : field.type === 'image' ? (
                            <div className="space-y-3">
                              {item.value ? (
                                <div className="relative group rounded-xl overflow-hidden border border-border bg-muted/20">
                                  <img src={item.value} alt={field.label} className="w-full h-48 md:h-56 object-cover transition-transform duration-500 group-hover:scale-105" />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3">
                                    <label className="cursor-pointer bg-white text-black hover:bg-gray-100 px-5 py-2.5 rounded-full font-semibold flex items-center gap-2 transition-all transform hover:scale-105 shadow-xl">
                                      {isUploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Upload className="h-4 w-4" />}
                                      {isUploading ? "Uploading..." : "Replace Image"}
                                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, item)} disabled={isUploading} />
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-full h-48 md:h-56 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
                                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                    {isUploading ? (
                                      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                                    ) : (
                                      <div className="p-4 bg-muted/50 rounded-full group-hover:bg-primary/10 transition-colors mb-4 shadow-sm group-hover:shadow-md">
                                        <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                      </div>
                                    )}
                                    <p className="mb-2 text-sm text-foreground font-semibold">
                                      {isUploading ? "Uploading file..." : "Click to upload an image"}
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-[200px]">
                                      High resolution images recommended. PNG, JPG or WEBP.
                                    </p>
                                  </div>
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, item)} disabled={isUploading} />
                                </label>
                              )}
                              <div className="flex items-center gap-2 p-3 bg-blue-50/50 text-blue-700 rounded-lg border border-blue-100 object-contain">
                                <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
                                <p className="text-xs font-medium content-center">Uploads to Cloudinary — replaces magically & instantly.</p>
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
                        </div>

                        {/* Preview Column — only for non-image fields */}
                        {field.type !== 'image' && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">👁 Preview</p>
                              {richContent[richKey] && richContent[richKey] !== displayValue && (
                                <span className="text-[10px] bg-orange-500/15 text-orange-600 border border-orange-500/25 rounded-full px-2 py-0.5 font-semibold">Unsaved changes</span>
                              )}
                            </div>
                            <div className="border border-border rounded-lg bg-muted/20 overflow-hidden">
                              {/* Currently live from DB */}
                              <div className="border-b border-border px-3 py-2 bg-green-500/5">
                                <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">✅ Currently Live (Database)</p>
                                {displayValue ? (
                                  field.type === 'rich' ? (
                                    <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayValue) }} />
                                  ) : (
                                    <p className="text-sm text-foreground">{displayValue}</p>
                                  )
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No content saved yet — run the seed migration or save a value above.</p>
                                )}
                              </div>
                              {/* Proposed — shown only when there are unsaved changes */}
                              {richContent[richKey] && richContent[richKey] !== displayValue && (
                                <div className="px-3 py-2 bg-orange-500/5">
                                  <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wide mb-1">⏳ Proposed (unsaved)</p>
                                  {field.type === 'rich' ? (
                                    <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(richContent[richKey]) }} />
                                  ) : (
                                    <p className="text-sm text-foreground">{richContent[richKey]}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
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
