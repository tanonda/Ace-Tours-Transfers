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
    content: value,
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
    <div className="border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted/30">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="h-3.5 w-3.5" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Paragraph"
          active={editor.isActive('paragraph') && !editor.isActive('heading')}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          active={editor.isActive('bold')}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          active={editor.isActive('italic')}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Center"
          active={editor.isActive({ textAlign: 'center' })}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
          active={editor.isActive('bulletList')}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
          active={editor.isActive('blockquote')}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
          active={editor.isActive('codeBlock')}
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton
          onClick={addLink}
          title="Insert Link"
          active={editor.isActive('link')}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <style>{`
        .ProseMirror { min-height: 160px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
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
        // Hero
        { key: "hero_title_part1", label: "Hero Title — Line 1", type: "text", description: "White text: e.g. \"Time for your\"" },
        { key: "hero_title_part2", label: "Hero Title — Line 2", type: "text", description: "Orange italic text: e.g. \"next adventure\"" },
        { key: "hero_subtitle", label: "Hero Subtitle", type: "text", description: "Sentence below the headline in the hero" },
        { key: "hero_image", label: "Hero Background Image", type: "image", description: "1920×1080 recommended" },
        // About
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
      fields: [
        { key: "faq1_q", label: "Question 1", type: "text" },
        { key: "faq1_a", label: "Answer 1", type: "rich" },
        { key: "faq2_q", label: "Question 2", type: "text" },
        { key: "faq2_a", label: "Answer 2", type: "rich" },
        { key: "faq3_q", label: "Question 3", type: "text" },
        { key: "faq3_a", label: "Answer 3", type: "rich" },
        { key: "faq4_q", label: "Question 4", type: "text" },
        { key: "faq4_a", label: "Answer 4", type: "rich" },
        { key: "faq5_q", label: "Question 5", type: "text" },
        { key: "faq5_a", label: "Answer 5", type: "rich" },
        { key: "faq6_q", label: "Question 6", type: "text" },
        { key: "faq6_a", label: "Answer 6", type: "rich" },
        { key: "faq7_q", label: "Question 7", type: "text" },
        { key: "faq7_a", label: "Answer 7", type: "rich" },
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
                            <div className="flex items-start gap-4">
                              {item.value ? (
                                <img src={item.value} alt={field.label} className="w-40 h-24 object-cover rounded-lg border border-border" />
                              ) : (
                                <div className="w-40 h-24 bg-muted/50 rounded-lg border border-border flex items-center justify-center text-muted-foreground">
                                  <ImageIcon className="h-6 w-6" />
                                </div>
                              )}
                              <div className="flex-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, item)} disabled={isUploading} className="w-full max-w-sm cursor-pointer" />
                                  {isUploading && <Loader2 className="animate-spin h-4 w-4" />}
                                </label>
                                <p className="text-xs text-muted-foreground mt-1.5">
                                  <Upload className="h-3 w-3 inline mr-1" />Uploads to Cloudinary — replaces current image immediately.
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
                                    <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: displayValue }} />
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
                                    <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: richContent[richKey] }} />
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
