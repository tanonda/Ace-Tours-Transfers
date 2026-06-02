import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash, Loader2, FileText, Eye, EyeOff } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArticleEditorDialog } from "@/components/admin/article-editor-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Article } from "@shared/schema";

export default function AdminBlog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [deleteState, setDeleteState] = useState<{ open: boolean; id: string | null; title: string }>({
    open: false,
    id: null,
    title: "",
  });

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["admin-articles"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/articles")).json(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-articles"] });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  };

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/articles/${id}`, { status: newStatus });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Article status updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update article status.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/articles/${id}`);
      if (!res.ok) throw new Error("Failed to delete article");
    },
    onSuccess: () => {
      invalidate();
      setDeleteState({ open: false, id: null, title: "" });
      toast({ title: "Article deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete article.", variant: "destructive" });
    },
  });

  const openNew = () => {
    setSelectedArticle(null);
    setEditorOpen(true);
  };

  const openEdit = (article: Article) => {
    setSelectedArticle(article);
    setEditorOpen(true);
  };

  const confirmDelete = (id: string, title: string) => {
    setDeleteState({ open: true, id, title });
  };

  const formatDate = (d: Date | string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Blog Articles</h1>
            <p className="text-sm text-muted-foreground">Create and manage SEO blog content</p>
          </div>
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> New Article
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-20 text-center bg-card rounded-xl border border-dashed">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">Loading articles…</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground bg-card rounded-xl border border-border border-dashed">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p>No articles yet — click "New Article" to create one.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="p-4">Title</th>
                    <th className="p-4 uppercase text-[10px] tracking-wider font-bold">Status</th>
                    <th className="p-4">Author</th>
                    <th className="p-4">Published</th>
                    <th className="p-4">Updated</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {articles.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium max-w-xs">
                        <span
                          className="block font-semibold cursor-pointer hover:text-primary transition-colors line-clamp-1"
                          onClick={() => openEdit(a)}
                        >
                          {a.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{a.slug}</span>
                      </td>
                      <td className="p-4">
                        {a.status === "published" ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-500/10 text-green-600 border-0 hover:bg-green-500/20 px-2 py-0.5 font-bold uppercase text-[9px]"
                          >
                            Published
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-muted text-muted-foreground border-0 px-2 py-0.5 font-bold uppercase text-[9px]"
                          >
                            Draft
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">{a.author ?? "—"}</td>
                      <td className="p-4 text-muted-foreground whitespace-nowrap">{formatDate(a.publishedAt)}</td>
                      <td className="p-4 text-muted-foreground whitespace-nowrap">{formatDate(a.updatedAt)}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* Publish/Unpublish toggle */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={a.status === "published" ? "Unpublish" : "Publish"}
                            disabled={toggleStatusMutation.isPending}
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: a.id,
                                newStatus: a.status === "published" ? "draft" : "published",
                              })
                            }
                          >
                            {a.status === "published" ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(a)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => confirmDelete(a.id, a.title)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Editor dialog */}
      <ArticleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        article={selectedArticle}
        onSaved={invalidate}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={deleteState.open}
        onOpenChange={(o) => !o && setDeleteState({ open: false, id: null, title: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>"{deleteState.title}"</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteState({ open: false, id: null, title: "" })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteState.id && deleteMutation.mutate(deleteState.id)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
