/**
 * Admin → CMS → Home Page → Hero video. Four English-only settings (shared/hero-video.ts):
 * background loop upload, Short link, optional Short cover, and "Also show on" pages.
 * Kept out of the generic field list because these rows must not get translate buttons.
 */
import { useState } from "react";
import { Loader2, Trash2, Upload, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { uploadHeroVideo, uploadImage, HERO_VIDEO_TYPES } from "@/lib/api";
import {
  HERO_VIDEO_EXTRA_PAGES,
  HERO_VIDEO_KEYS,
  SHORT_PLATFORM_NAME,
  cloudinaryLoopSources,
  heroVideoPages,
  parseShortUrl,
  type HeroVideoExtraPage,
} from "@shared/hero-video";

type Item = { id?: string; key: string; value: string };

const PAGE_LABEL: Record<HeroVideoExtraPage, string> = { tours: "Tours", transfers: "Transfers", about: "About" };

export function HeroVideoSettings({
  getContent,
  onSave,
  saving = false,
}: {
  getContent: (key: string) => Item;
  onSave: (item: Item, value: string) => void;
  /** A CMS save is in flight: controls are disabled so a second click can't build on stale data. */
  saving?: boolean;
}) {
  const { toast } = useToast();
  const videoItem = getContent(HERO_VIDEO_KEYS.video);
  const shortItem = getContent(HERO_VIDEO_KEYS.shortUrl);
  const coverItem = getContent(HERO_VIDEO_KEYS.shortCover);
  const pagesItem = getContent(HERO_VIDEO_KEYS.pages);

  const [progress, setProgress] = useState<number | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [shortDraft, setShortDraft] = useState<string | null>(null);
  // The ticks the admin last chose, shown until the saved value catches up.
  const [pagesDraft, setPagesDraft] = useState<string | null>(null);

  const loop = cloudinaryLoopSources(videoItem.value);
  const shortValue = shortDraft ?? shortItem.value ?? "";
  const parsed = parseShortUrl(shortValue);
  const shortInvalid = shortValue.trim() !== "" && !parsed;
  const pages = heroVideoPages(pagesDraft ?? pagesItem.value);

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProgress(0);
    try {
      const url = await uploadHeroVideo(file, setProgress);
      onSave(videoItem, url);
    } catch (err: any) {
      toast({ title: "Video upload failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setProgress(null);
    }
  };

  const onCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverUploading(true);
    try {
      onSave(coverItem, (await uploadImage(file)).url);
    } catch {
      toast({ title: "Cover upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setCoverUploading(false);
    }
  };

  const togglePage = (page: HeroVideoExtraPage, on: boolean) => {
    const next = new Set(pages);
    if (on) next.add(page);
    else next.delete(page);
    const value = HERO_VIDEO_EXTRA_PAGES.filter((p) => next.has(p)).join(",");
    setPagesDraft(value);
    onSave(pagesItem, value);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" /> Hero video
        </CardTitle>
        <CardDescription>
          Shown on the Home page hero, and on the pages ticked below. These settings apply to every language.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Background loop */}
        <section className="space-y-2">
          <Label className="font-semibold">Background video</Label>
          <p className="text-xs text-muted-foreground">
            Plays muted and looped behind the headline (first 15 seconds) on tablets and computers. Phones show the photo. Use a
            landscape clip with nothing important at the very top or bottom. MP4, WebM or MOV, up to 100 MB.
          </p>
          {loop && (
            <video src={loop.mp4} poster={loop.poster} muted loop autoPlay playsInline className="aspect-video w-full max-w-md rounded-lg bg-black object-cover" />
          )}
          {progress !== null ? (
            <div className="max-w-md space-y-1">
              <Progress value={Math.round(progress * 100)} />
              <p className="text-xs text-muted-foreground">Uploading… {Math.round(progress * 100)}%</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <label className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {loop ? "Replace video" : "Upload video"}
                  <input type="file" accept={HERO_VIDEO_TYPES.join(",")} className="hidden" onChange={onVideo} />
                </label>
              </Button>
              {videoItem.value && (
                <Button size="sm" variant="outline" onClick={() => onSave(videoItem, "")}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remove video
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Short */}
        <section className="space-y-2">
          <Label htmlFor="hero-short-url" className="font-semibold">Short (YouTube, Instagram or Facebook)</Label>
          <div className="flex max-w-xl gap-2">
            <Input
              id="hero-short-url"
              value={shortValue}
              placeholder="https://www.youtube.com/shorts/…"
              onChange={(e) => setShortDraft(e.target.value)}
            />
            <Button
              size="sm"
              disabled={saving || shortInvalid || shortDraft === null || shortDraft === (shortItem.value ?? "")}
              onClick={() => {
                onSave(shortItem, shortValue.trim());
                setShortDraft(null);
              }}
            >
              Save
            </Button>
          </div>
          <p className={shortInvalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {parsed
              ? `${SHORT_PLATFORM_NAME[parsed.platform]} video detected. Visitors click to play it.`
              : shortInvalid
                ? "Not a YouTube, Instagram or Facebook video link. For Facebook, open the video and copy the full facebook.com address."
                : "Leave empty for no Short."}
          </p>
        </section>

        {/* Cover */}
        <section className="space-y-2">
          <Label className="font-semibold">Short cover image (optional)</Label>
          <p className="text-xs text-muted-foreground">
            YouTube supplies its own. Instagram and Facebook don't, so upload a portrait image or a branded card is shown.
          </p>
          {coverItem.value && <img src={coverItem.value} alt="" className="aspect-[9/16] w-24 rounded-lg object-cover" />}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" disabled={coverUploading}>
              <label className="cursor-pointer">
                {coverUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {coverItem.value ? "Replace cover" : "Upload cover"}
                <input type="file" accept="image/*" className="hidden" onChange={onCover} disabled={coverUploading} />
              </label>
            </Button>
            {coverItem.value && (
              <Button size="sm" variant="outline" onClick={() => onSave(coverItem, "")}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove cover
              </Button>
            )}
          </div>
        </section>

        {/* Pages */}
        <section className="space-y-2">
          <Label className="font-semibold">Also show on</Label>
          <div className="flex flex-wrap gap-5">
            {HERO_VIDEO_EXTRA_PAGES.map((page) => (
              <label key={page} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={pages.has(page)} disabled={saving} onCheckedChange={(v) => togglePage(page, v === true)} />
                {PAGE_LABEL[page]}
              </label>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
