import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold, Italic, List, Heading1, Heading2, Link as LinkIcon,
  Undo, Redo, AlignLeft, AlignCenter, Code, Quote, Minus,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocalizedProducts } from "@/hooks/useLocalizedProducts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Article } from "@shared/schema";

// ─── Slug helper ──────────────────────────────────────────────────────────────
const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ─── Toolbar ──────────────────────────────────────────────────────────────────
function ToolbarButton({
  onClick, title, active, children,
}: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center ${
        active
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const EDITOR_EXTENSIONS = [
  StarterKit,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: "text-primary underline cursor-pointer" },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface ArticleEditorDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  article: Article | null;
  onSaved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ArticleEditorDialog({ open, onOpenChange, article, onSaved }: ArticleEditorDialogProps) {
  const { data: products = [] } = useLocalizedProducts();

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [author, setAuthor] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [relatedProductIds, setRelatedProductIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [slugError, setSlugError] = useState("");

  // TipTap
  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] p-4 text-base focus:outline-none prose prose-stone dark:prose-invert max-w-none outline-none",
        style: "line-height: 1.6",
      },
    },
  });

  // Seed form when dialog opens / article changes
  useEffect(() => {
    if (!open) return;

    if (article) {
      setTitle(article.title);
      setSlug(article.slug);
      setSlugTouched(true); // don't auto-overwrite on edit
      setExcerpt(article.excerpt ?? "");
      setCoverImage(article.coverImage ?? "");
      setImageAlt(article.imageAlt ?? "");
      setAuthor(article.author ?? "");
      const t = article.tags ?? [];
      setTags(t);
      setTagsRaw(t.join(", "));
      setRelatedProductIds(article.relatedProductIds ?? []);
      setStatus((article.status as "draft" | "published") ?? "draft");
      setSeoTitle(article.seoTitle ?? "");
      setSeoDescription(article.seoDescription ?? "");
      setSeoKeywords(article.seoKeywords ?? "");
      editor?.commands.setContent(article.bodyHtml ?? "");
    } else {
      setTitle("");
      setSlug("");
      setSlugTouched(false);
      setExcerpt("");
      setCoverImage("");
      setImageAlt("");
      setAuthor("");
      setTags([]);
      setTagsRaw("");
      setRelatedProductIds([]);
      setStatus("draft");
      setSeoTitle("");
      setSeoDescription("");
      setSeoKeywords("");
      editor?.commands.setContent("");
    }
    setSlugError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, article]);

  // Auto-fill slug from title when creating and slug not manually touched
  useEffect(() => {
    if (!article && !slugTouched) {
      setSlug(toSlug(title));
    }
  }, [title, article, slugTouched]);

  const addLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        slug,
        excerpt,
        bodyHtml: editor?.getHTML() ?? "",
        coverImage,
        imageAlt,
        author,
        tags,
        relatedProductIds,
        status,
        seoTitle,
        seoDescription,
        seoKeywords,
      };
      const res = await apiRequest(
        article ? "PATCH" : "POST",
        article ? `/api/admin/articles/${article.id}` : "/api/admin/articles",
        payload,
      );
      if (!res.ok) {
        if (res.status === 409) {
          const body = await res.json();
          throw Object.assign(new Error(body.error ?? "Slug already exists"), { status: 409 });
        }
        throw new Error("Failed to save article");
      }
      return res.json();
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
    onError: (err: any) => {
      if (err.status === 409) {
        setSlugError("Slug already exists — please choose a different slug.");
      }
    },
  });

  const handleTagsChange = (value: string) => {
    setTagsRaw(value);
    setTags(
      value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    );
  };

  const toggleProduct = (id: string) => {
    setRelatedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? "Edit Article" : "New Article"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-2">
          {/* ── Left column: body editor ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="art-title">Title</Label>
              <Input
                id="art-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="art-slug">Slug</Label>
              <Input
                id="art-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                  setSlugError("");
                }}
                placeholder="auto-generated-from-title"
                className={slugError ? "border-destructive" : ""}
              />
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
            </div>

            {/* Excerpt */}
            <div className="space-y-1.5">
              <Label htmlFor="art-excerpt">Excerpt</Label>
              <Textarea
                id="art-excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short summary shown in article cards"
                rows={3}
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label>Body</Label>
              <div className="border border-input rounded-xl overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-200 shadow-sm bg-background">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/10">
                  <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} title="Undo">
                    <Undo className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} title="Redo">
                    <Redo className="h-4 w-4" />
                  </ToolbarButton>
                  <div className="w-px h-5 bg-border mx-1" />
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                    title="Heading 1"
                    active={editor?.isActive("heading", { level: 1 })}
                  >
                    <Heading1 className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    title="Heading 2"
                    active={editor?.isActive("heading", { level: 2 })}
                  >
                    <Heading2 className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().setParagraph().run()}
                    title="Paragraph"
                    active={editor?.isActive("paragraph") && !editor?.isActive("heading")}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </ToolbarButton>
                  <div className="w-px h-5 bg-border mx-1" />
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    title="Bold"
                    active={editor?.isActive("bold")}
                  >
                    <Bold className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    title="Italic"
                    active={editor?.isActive("italic")}
                  >
                    <Italic className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                    title="Center"
                    active={editor?.isActive({ textAlign: "center" })}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </ToolbarButton>
                  <div className="w-px h-5 bg-border mx-1" />
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    title="Bullet List"
                    active={editor?.isActive("bulletList")}
                  >
                    <List className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                    title="Quote"
                    active={editor?.isActive("blockquote")}
                  >
                    <Quote className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                    title="Code Block"
                    active={editor?.isActive("codeBlock")}
                  >
                    <Code className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                    title="Divider"
                  >
                    <Minus className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton onClick={addLink} title="Insert Link" active={editor?.isActive("link")}>
                    <LinkIcon className="h-4 w-4" />
                  </ToolbarButton>
                </div>
                {editor && (
                  <EditorContent
                    editor={editor}
                    className="flex-1 cursor-text"
                    onClick={() => editor.chain().focus().run()}
                  />
                )}
              </div>
              <style>{`
                .ProseMirror { min-height: 220px; }
                .ProseMirror:focus { outline: none; }
                .ProseMirror h1 { font-size: 1.875rem; font-weight: 800; margin: 0.75rem 0; }
                .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0; }
                .ProseMirror p { margin: 0.5rem 0; }
                .ProseMirror ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
                .ProseMirror li { margin: 0.25rem 0; }
                .ProseMirror a { color: hsl(var(--primary)); text-decoration: underline; }
                .ProseMirror blockquote { border-left: 4px solid hsl(var(--primary)); padding-left: 1rem; font-style: italic; margin: 1rem 0; }
                .ProseMirror pre { background: hsl(var(--muted)/0.5); padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem; }
              `}</style>
            </div>
          </div>

          {/* ── Right column: meta fields ── */}
          <div className="flex flex-col gap-4">
            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Author */}
            <div className="space-y-1.5">
              <Label htmlFor="art-author">Author</Label>
              <Input
                id="art-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
              />
            </div>

            {/* Cover image */}
            <div className="space-y-1.5">
              <Label htmlFor="art-cover">Cover Image URL</Label>
              <Input
                id="art-cover"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Image alt */}
            <div className="space-y-1.5">
              <Label htmlFor="art-alt">Image Alt Text</Label>
              <Input
                id="art-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Describe the image"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="art-tags">Tags (comma-separated)</Label>
              <Input
                id="art-tags"
                value={tagsRaw}
                onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="vanuatu, tours, adventure"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Related products */}
            <div className="space-y-1.5">
              <Label>Related Products</Label>
              <div className="border border-input rounded-md p-2 max-h-40 overflow-y-auto space-y-1 bg-background">
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">No products found</p>
                ) : (
                  products.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`rp-${p.id}`}
                        checked={relatedProductIds.includes(p.id)}
                        onCheckedChange={() => toggleProduct(p.id)}
                      />
                      <label
                        htmlFor={`rp-${p.id}`}
                        className="text-xs cursor-pointer leading-tight"
                      >
                        {p.title}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SEO settings */}
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-semibold text-foreground">SEO settings</p>
              <div className="space-y-1.5">
                <Label htmlFor="art-seo-title">SEO Title</Label>
                <Input
                  id="art-seo-title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Override page title"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="art-seo-desc">SEO Description</Label>
                <Textarea
                  id="art-seo-desc"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Meta description (150-160 chars)"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="art-seo-kw">SEO Keywords</Label>
                <Input
                  id="art-seo-kw"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="keyword1, keyword2"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
            type="button"
          >
            {saveMutation.isPending ? "Saving…" : article ? "Save Changes" : "Create Article"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
