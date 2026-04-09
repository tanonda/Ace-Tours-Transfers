import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSiteSettings, updateSiteSetting, fetchFeatureFlags, updateFeatureFlag } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Clock, Globe, CreditCard, Star, ExternalLink, CheckCircle2, AlertCircle, ImagePlus, GripVertical, ChevronUp, ChevronDown, Monitor, Eye, Smartphone, Save, Mail, Users, Download, Trash2, CheckCircle, Flag, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, LayoutDashboard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

function SettingItem({
  itemKey,
  label,
  value,
  placeholder,
  onChange,
  onSave
}: {
  itemKey: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  onSave: () => Promise<any>;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex gap-4 items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor={itemKey}>{label}</Label>
        <Input
          id={itemKey}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        />
      </div>
      <Button onClick={handleSaveClick} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function SettingList({
  itemKey,
  label,
  description,
  values,
  placeholder,
  onSave
}: {
  itemKey: string;
  label: string;
  description?: string;
  values: string[];
  placeholder?: string;
  onSave: (newValues: string[]) => Promise<void>;
}) {
  const [list, setList] = useState<string[]>(values);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setList(values);
  }, [values]);

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(list.filter(v => v.trim() !== ""));
    } finally {
      setIsSaving(false);
    }
  };

  const addRow = () => setList([...list, ""]);

  const updateRow = (index: number, val: string) => {
    const newList = [...list];
    newList[index] = val;
    setList(newList);
  };

  const removeRow = (index: number) => {
    const newList = list.filter((_, i) => i !== index);
    setList(newList);
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <Label className="text-base">{label}</Label>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <Button onClick={handleSaveClick} disabled={isSaving || list.every(v => v.trim() === '')} size="sm">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save List
        </Button>
      </div>

      <div className="space-y-2 mt-4">
        {list.map((val, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={val}
              onChange={(e) => updateRow(i, e.target.value)}
              placeholder={placeholder || "Enter value..."}
              className="flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => removeRow(i)} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-2 text-center border border-dashed rounded-md">No items added yet.</p>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="mt-2 w-full text-muted-foreground hover:text-foreground">
        + Add New Item
      </Button>
    </div>
  );
}

// ─── Coming Soon Tab Component ────────────────────────────────────────────────
const CS_DEFAULTS = {
  cs_tagline: "Port Vila · Vanuatu",
  cs_headline: "Ace Tours &",
  cs_headline2: "Transfers",
  cs_description: "Something extraordinary is on the horizon. We're putting the finishing touches on your next great Vanuatu adventure.",
  cs_show_countdown: "true",
  cs_show_signup: "true",
  cs_signup_placeholder: "Your email address",
  cs_signup_button: "Notify Me",
  cs_signup_success: "We'll let you know when we launch",
  cs_contact_email: "acetoursvanuatu@outlook.com",
  cs_contact_phone: "+678 7114045",
  cs_bg_images: "[]",
  cs_bg_interval: "5000",
  cs_bg_overlay: "0.55",
  cs_show_reviews: "true",
  cs_reviews_count: "3",
  launch_date: "2026-05-01",
};

type CSKey = keyof typeof CS_DEFAULTS;

function StarPreview({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width="10" height="10" viewBox="0 0 24 24" fill={s <= rating ? "#f59e0b" : "rgba(255,255,255,0.2)"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

function ComingSoonTab({
  formData,
  flags,
  onChange,
  onSave,
  toggleFlagMutation,
  isSaving,
}: {
  formData: Record<string, string>;
  flags: any[];
  onChange: (key: string, val: string) => void;
  onSave: (key: string) => Promise<any>;
  toggleFlagMutation: any;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewBg, setPreviewBg] = useState(0);

  const { data: approvedReviews = [] } = useQuery<any[]>({
    queryKey: ["approved-reviews"],
    queryFn: () => fetch("/api/reviews/approved").then(r => r.json()),
    staleTime: 300_000,
  });

  const comingSoonFlag = flags.find((f: any) => f.slug === "coming-soon");
  const isOn = comingSoonFlag?.enabled ?? false;

  const get = (key: CSKey) => formData[key] ?? CS_DEFAULTS[key];

  const save = async (key: string) => {
    setSavingKey(key);
    try { await onSave(key); } finally { setSavingKey(null); }
  };

  const bgImages: string[] = (() => { try { return JSON.parse(get("cs_bg_images") || "[]"); } catch { return []; } })();
  const setImages = (imgs: string[]) => onChange("cs_bg_images", JSON.stringify(imgs));

  const uploadImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB per image.", variant: "destructive" }); return;
    }
    setUploadingIdx(bgImages.length);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await fetch("/api/admin/upload?folder=ace-tours-coming-soon", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      const newImgs = [...bgImages, url];
      setImages(newImgs);
      // auto-save
      await onSave("cs_bg_images");
      toast({ title: "Image uploaded", description: "Background image added." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingIdx(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => setImages(bgImages.filter((_, i) => i !== idx));
  const moveImage = (idx: number, dir: -1 | 1) => {
    const n = [...bgImages]; const t = idx + dir;
    if (t < 0 || t >= n.length) return;
    [n[idx], n[t]] = [n[t], n[idx]]; setImages(n);
  };

  // countdown for preview
  const [liveTime, setLiveTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const tick = () => {
      const d = Math.max(0, new Date(`${get("launch_date")}T00:00:00`).getTime() - Date.now());
      setLiveTime({ days: Math.floor(d/86400000), hours: Math.floor((d%86400000)/3600000), minutes: Math.floor((d%3600000)/60000), seconds: Math.floor((d%60000)/1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [formData["launch_date"]]);

  // bg slideshow in preview
  useEffect(() => {
    if (!bgImages.length) return;
    const interval = parseInt(get("cs_bg_interval")) || 5000;
    const id = setInterval(() => setPreviewBg(p => (p + 1) % bgImages.length), interval);
    return () => clearInterval(id);
  }, [bgImages.length, formData["cs_bg_interval"]]);

  const overlayOpacity = parseFloat(get("cs_bg_overlay")) || 0.55;
  const showCountdown = get("cs_show_countdown") === "true";
  const showSignup = get("cs_show_signup") === "true";
  const showReviews = get("cs_show_reviews") === "true";
  const reviewCount = parseInt(get("cs_reviews_count")) || 3;
  const previewReviews = approvedReviews.slice(0, reviewCount);

  const FieldRow = ({ label, csKey, type = "text", placeholder }: { label: string; csKey: CSKey; type?: string; placeholder?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex gap-2">
        {type === "date" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "flex-1 h-8 justify-start text-left font-normal text-sm px-3",
                  !get(csKey) && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {get(csKey) ? format(new Date(get(csKey)), "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={get(csKey) ? new Date(get(csKey)) : undefined}
                onSelect={(date) => {
                  if (date) {
                    onChange(csKey, format(date, "yyyy-MM-dd"));
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        ) : type === "textarea" ? (
          <Textarea value={get(csKey)} onChange={e => onChange(csKey, e.target.value)} placeholder={placeholder || CS_DEFAULTS[csKey as CSKey]} className="flex-1 text-sm resize-none h-20" />
        ) : (
          <Input type={type} value={get(csKey)} onChange={e => onChange(csKey, e.target.value)} placeholder={placeholder || CS_DEFAULTS[csKey as CSKey]} className="flex-1 h-8 text-sm" />
        )}
        <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={() => save(csKey)} disabled={savingKey === csKey}>
          {savingKey === csKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );

  const ToggleRow = ({ label, csKey, description }: { label: string; csKey: CSKey; description?: string }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch
        checked={get(csKey) === "true"}
        onCheckedChange={async v => { onChange(csKey, v ? "true" : "false"); setSavingKey(csKey); try { await onSave(csKey); } finally { setSavingKey(null); } }}
        disabled={savingKey === csKey}
      />
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">

      {/* ── Left Controls ── */}
      <div className="w-[380px] shrink-0 overflow-y-auto space-y-4 pr-2">

        {/* Status */}
        <Card className={isOn ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "border-green-400 bg-green-50 dark:bg-green-950/20"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isOn ? "bg-amber-400 animate-pulse" : "bg-green-500"}`} />
                <div>
                  <p className="font-semibold text-sm">{isOn ? "🚧 Coming Soon Mode is ON" : "🟢 Site is LIVE"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{isOn ? "Public sees coming soon page. Staff can still log in." : "Site fully accessible to all visitors."}</p>
                </div>
              </div>
              <Switch checked={isOn} onCheckedChange={checked => toggleFlagMutation.mutate({ slug: "coming-soon", enabled: checked })} disabled={toggleFlagMutation.isPending} />
            </div>
          </CardContent>
        </Card>

        {/* Launch date */}
        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Launch Date</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="Target Launch Date" csKey="launch_date" type="date" />
            <ToggleRow label="Show Countdown Timer" csKey="cs_show_countdown" description="Display days/hours/minutes/seconds" />
          </CardContent>
        </Card>

        {/* Text content */}
        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Text Content</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="Location Tagline" csKey="cs_tagline" />
            <FieldRow label="Headline Line 1" csKey="cs_headline" />
            <FieldRow label="Headline Line 2 (accent colour)" csKey="cs_headline2" />
            <FieldRow label="Description" csKey="cs_description" type="textarea" />
          </CardContent>
        </Card>

        {/* Email signup */}
        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Email Sign-up</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow label="Show Email Sign-up" csKey="cs_show_signup" />
            <FieldRow label="Input Placeholder" csKey="cs_signup_placeholder" />
            <FieldRow label="Button Label" csKey="cs_signup_button" />
            <FieldRow label="Success Message" csKey="cs_signup_success" />
          </CardContent>
        </Card>

        {/* Contact info */}
        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Contact Info on Page</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="Email Address" csKey="cs_contact_email" type="email" />
            <FieldRow label="Phone Number" csKey="cs_contact_phone" />
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4" /> Reviews Section</CardTitle>
            <CardDescription className="text-xs">Shows approved reviews below the sign-up form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow label="Show Reviews" csKey="cs_show_reviews" description="Display guest review cards on the page" />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Number of Reviews to Show</Label>
              <div className="flex gap-2">
                <Select value={get("cs_reviews_count")} onValueChange={async v => { onChange("cs_reviews_count", v); setSavingKey("cs_reviews_count"); try { await onSave("cs_reviews_count"); } finally { setSavingKey(null); } }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n} review{n > 1 ? "s" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {approvedReviews.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠ No approved reviews yet — reviews section will be hidden automatically.</p>
              )}
              {approvedReviews.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">✓ {approvedReviews.length} approved review{approvedReviews.length > 1 ? "s" : ""} available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Background images */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Background Slideshow</CardTitle>
            <CardDescription className="text-xs">Images slide behind the entire page. A dark overlay keeps text readable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overlay Darkness</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="range" min="0.2" max="0.85" step="0.05"
                  value={overlayOpacity}
                  onChange={e => onChange("cs_bg_overlay", e.target.value)}
                  onMouseUp={() => save("cs_bg_overlay")}
                  onTouchEnd={() => save("cs_bg_overlay")}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(overlayOpacity * 100)}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Higher = darker overlay, easier to read text</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Slide Duration</Label>
              <Select value={get("cs_bg_interval")} onValueChange={async v => { onChange("cs_bg_interval", v); setSavingKey("cs_bg_interval"); try { await onSave("cs_bg_interval"); } finally { setSavingKey(null); } }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3000">3 seconds</SelectItem>
                  <SelectItem value="4000">4 seconds</SelectItem>
                  <SelectItem value="5000">5 seconds</SelectItem>
                  <SelectItem value="6000">6 seconds</SelectItem>
                  <SelectItem value="8000">8 seconds</SelectItem>
                  <SelectItem value="10000">10 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Image list */}
            <div className="space-y-2">
              {bgImages.map((url, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveImage(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                    <button onClick={() => moveImage(idx, 1)} disabled={idx === bgImages.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                  </div>
                  <img src={url} alt="" className="h-14 w-20 object-cover rounded border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Photo {idx + 1}</p>
                    <p className="text-[10px] text-muted-foreground/50 truncate">{url.split("/").pop()}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeImage(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {bgImages.length === 0 && (
                <div className="border border-dashed rounded-md p-4 text-center text-muted-foreground text-xs">No background images yet. Without images, a dark blue gradient is shown.</div>
              )}
            </div>

            {bgImages.length < 12 && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={async e => { for (const f of Array.from(e.target.files || []).slice(0, 12 - bgImages.length)) await uploadImage(f); }} />
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploadingIdx !== null}>
                  {uploadingIdx !== null ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><ImagePlus className="h-4 w-4 mr-2" />Add Background Photos ({bgImages.length}/12)</>}
                </Button>
                {bgImages.length > 0 && (
                  <Button size="sm" className="w-full" onClick={() => save("cs_bg_images")} disabled={savingKey === "cs_bg_images"}>
                    {savingKey === "cs_bg_images" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Photo Order
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Right: Live Preview ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Live Preview</span>
            <Badge variant="secondary" className="text-xs">Updates as you type</Badge>
          </div>
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <button onClick={() => setPreviewDevice("desktop")} className={`p-1.5 rounded transition-colors ${previewDevice === "desktop" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Monitor className="h-3.5 w-3.5" /></button>
            <button onClick={() => setPreviewDevice("mobile")} className={`p-1.5 rounded transition-colors ${previewDevice === "mobile" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Smartphone className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="flex-1 border rounded-xl overflow-hidden bg-muted/20 flex items-start justify-center p-4">
          <div
            className="overflow-y-auto rounded-lg shadow-2xl transition-all duration-300"
            style={{ width: previewDevice === "mobile" ? "375px" : "100%", maxHeight: "100%", background: "#001a2e", position: "relative" }}
          >
            {/* Background slideshow preview */}
            {bgImages.length > 0 && (
              <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", borderRadius: "inherit" }}>
                {bgImages.map((url, idx) => (
                  <div key={idx} style={{ position: "absolute", inset: 0, opacity: idx === previewBg % bgImages.length ? 1 : 0, transition: "opacity 1.5s ease" }}>
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
                <div style={{ position: "absolute", inset: 0, background: `rgba(0,26,46,${overlayOpacity})` }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,26,46,0.7) 100%)" }} />
              </div>
            )}
            {bgImages.length === 0 && (
              <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: "radial-gradient(circle at 25% 35%, #00a8e0 0%, transparent 60%), radial-gradient(circle at 75% 70%, #0077b6 0%, transparent 55%)", zIndex: 0 }} />
            )}

            {/* Content */}
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px 28px", minHeight: "560px" }}>
              <div style={{ width: "100%", maxWidth: 460, borderTop: "1px solid rgba(255,255,255,0.15)", marginBottom: 28 }} />

              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <p style={{ color: "#5bb8d4", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", fontWeight: 600, margin: "0 0 12px" }}>{get("cs_tagline")}</p>
                <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 400, lineHeight: 1.1, margin: "0 0 4px", fontFamily: "Georgia, serif", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>{get("cs_headline")}</h1>
                <h1 style={{ color: "#5bb8d4", fontSize: 26, fontWeight: 400, lineHeight: 1.1, margin: "0 0 20px", fontFamily: "Georgia, serif" }}>{get("cs_headline2")}</h1>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, width: "100%", maxWidth: 320 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.6 }}><path d="M12 2L13.09 8.26L19 7L15.45 12L19 17L13.09 15.74L12 22L10.91 15.74L5 17L8.55 12L5 7L10.91 8.26L12 2Z" fill="#5bb8d4"/></svg>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
              </div>

              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", maxWidth: 320, lineHeight: 1.7, fontStyle: "italic", margin: "0 0 24px", fontFamily: "Georgia, serif" }}>{get("cs_description")}</p>

              {showCountdown && (
                <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
                  {[{ value: liveTime.days, label: "Days" }, { value: liveTime.hours, label: "Hours" }, { value: liveTime.minutes, label: "Min" }, { value: liveTime.seconds, label: "Sec" }].map(({ value, label }, i) => (
                    <div key={label} style={{ textAlign: "center", position: "relative" }}>
                      {i > 0 && <span style={{ position: "absolute", left: -9, top: "38%", color: "rgba(255,255,255,0.2)", fontSize: 16, fontFamily: "Arial, sans-serif" }}>:</span>}
                      <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "8px 10px", minWidth: 40 }}>
                        <span style={{ display: "block", color: "#fff", fontSize: 20, fontWeight: 300, fontFamily: "Georgia, serif", lineHeight: 1 }}>{String(value).padStart(2, "0")}</span>
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 7, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", margin: "5px 0 0" }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {showSignup && (
                <div style={{ width: "100%", maxWidth: 340, marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 5, padding: "9px 12px", color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "Arial, sans-serif" }}>{get("cs_signup_placeholder")}</div>
                    <div style={{ background: "#5bb8d4", borderRadius: 5, padding: "9px 14px", color: "#001a2e", fontSize: 11, fontWeight: 700, fontFamily: "Arial, sans-serif", whiteSpace: "nowrap" }}>{get("cs_signup_button")}</div>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textAlign: "center", margin: "7px 0 0", fontFamily: "Arial, sans-serif" }}>{get("cs_signup_success")}</p>
                </div>
              )}

              {/* Reviews preview */}
              {showReviews && previewReviews.length > 0 && (
                <div style={{ width: "100%", maxWidth: 460, marginBottom: 22 }}>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", textAlign: "center", marginBottom: 12 }}>What our guests say</p>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(previewReviews.length, 3)}, 1fr)`, gap: 10 }}>
                    {previewReviews.map((r: any) => (
                      <div key={r.id} style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "14px 14px 12px" }}>
                        <StarPreview rating={r.rating} />
                        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, lineHeight: 1.6, fontStyle: "italic", fontFamily: "Georgia, serif", margin: "0 0 10px" }}>"{r.comment?.slice(0, 80)}{r.comment?.length > 80 ? "…" : ""}"</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(91,184,212,0.2)", border: "1px solid rgba(91,184,212,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "#5bb8d4", fontSize: 9, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>{(r.authorName || "?")[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, margin: 0, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>{r.authorName}</p>
                            {r.tourTitle && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, margin: 0, fontFamily: "Arial, sans-serif" }}>{r.tourTitle}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showReviews && previewReviews.length === 0 && (
                <div style={{ width: "100%", maxWidth: 460, marginBottom: 22, padding: "12px", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8, textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "Arial, sans-serif", margin: 0 }}>Reviews section hidden — no approved reviews yet</p>
                </div>
              )}

              <div style={{ display: "flex", gap: 18, marginBottom: 22, justifyContent: "center" }}>
                {[{ icon: "✉", text: get("cs_contact_email") }, { icon: "✆", text: get("cs_contact_phone") }].map(({ icon, text }) => (
                  <div key={text} style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "Arial, sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#5bb8d4" }}>{icon}</span>{text}
                  </div>
                ))}
              </div>

              <div style={{ width: "100%", maxWidth: 460, borderTop: "1px solid rgba(255,255,255,0.08)" }} />
              <p style={{ color: "rgba(255,255,255,0.12)", fontSize: 8, fontFamily: "Arial, sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 14 }}>© {new Date().getFullYear()} Ace Tours & Transfers Vanuatu</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function AdminSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [whatsappSettings, setWhatsappSettings] = useState({
    phoneNumber: "",
    greeting: "",
    enabled: true,
    position: "bottom-right" as "bottom-right" | "bottom-left"
  });

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSiteSettings,
  });

  // Initialize form data from settings
  useEffect(() => {
    if (settings.length > 0) {
      const newFormData: Record<string, string> = {};
      settings.forEach(s => {
        const val = s.value;
        newFormData[s.key] = typeof val === 'string' ? val : JSON.stringify(val);
      });
      setFormData(prev => ({ ...prev, ...newFormData }));

      const ws = settings.find(s => s.key === "whatsapp")?.value;
      if (ws && typeof ws === 'object') {
        setWhatsappSettings(prev => ({ ...prev, ...ws }));
      }
    }
  }, [settings]);

  const { data: flags = [], isLoading: isFlagsLoading } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: fetchFeatureFlags,
  });

  const { data: newsletterData, isLoading: isNewsletterLoading, refetch: refetchNewsletter } = useQuery({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: async () => {
      const res = await fetch("/api/newsletter/subscribers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscribers");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) => updateSiteSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: t("cms.updated"), description: "Setting saved successfully." });
    },
    onError: () => {
      toast({ title: t("common.error"), description: "Failed to save setting.", variant: "destructive" });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) => updateFeatureFlag(slug, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast({ title: t("cms.updated"), description: "Feature flag updated." });
    },
    onError: () => {
      toast({ title: t("common.error"), description: "Failed to update feature flag.", variant: "destructive" });
    },
  });

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    updateMutation.mutate({ key, value: formData[key] || "" });
  };

  const handleSaveWhatsapp = async () => {
    updateMutation.mutate({ key: "whatsapp", value: whatsappSettings });
    // Keep legacy field in sync for footer compatibility
    updateMutation.mutate({ key: "whatsapp_number", value: whatsappSettings.phoneNumber });
  };

  const SETTING_GROUPS = {
    contact: [
      { key: "contact_email", label: t("contact.email"), icon: "Mail" },
      { key: "contact_phone", label: t("contact.phone"), icon: "Phone" },
      { key: "contact_address", label: t("footer.address"), icon: "MapPin" },
      { key: "launch_date", label: "Launch Date (Coming Soon countdown)", icon: "Calendar", placeholder: "YYYY-MM-DD e.g. 2026-05-01" },
    ],
    social: [
      { key: "social_facebook", label: "Facebook URL", icon: "Facebook" },
      { key: "social_instagram", label: "Instagram URL", icon: "Instagram" },
    ],
    email: [
      { key: "admin_email", label: "Admin Notification Email", placeholder: "email to receive booking notifications" },
      { key: "email_from_name", label: "From Name", placeholder: "e.g. Ace Tours & Transfers" },
      { key: "app_url", label: "Website URL", placeholder: "e.g. https://acetours.vu" },
    ],
  };

  if (isLoading || isFlagsLoading) {
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
          <h1 className="text-2xl font-bold text-foreground">{t("dashboard.settings")}</h1>
          <p className="text-sm text-muted-foreground">Manage general site configuration</p>
        </div>

        <Tabs defaultValue="contact">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="contact">{t("footer.contactInfo")}</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-1.5 font-semibold text-primary">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp Widget
            </TabsTrigger>
            <TabsTrigger value="email">Email Config</TabsTrigger>
            {/* Newsletter moved to its own dedicated page: /admin/newsletter */}
            <TabsTrigger value="payments">Payment Instructions</TabsTrigger>
            <TabsTrigger value="seo">SEO / GEO</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="flags">Feature Flags</TabsTrigger>
            <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
            <TabsTrigger value="coming-soon" className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
              🚧 Coming Soon
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("footer.contactInfo")}</CardTitle>
                <CardDescription>
                  Update the contact details displayed in the footer and contact page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SETTING_GROUPS.contact.map((item) => (
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={`Enter ${item.label.toLowerCase()}`}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <CardDescription>
                  Manage social media profiles and integrations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SETTING_GROUPS.social.map((item) => (
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={`Enter ${item.label.toLowerCase()}`}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}

                <div className="pt-4 mt-6 border-t">
                  <SettingList
                    itemKey="social_custom_links"
                    label="Additional Links"
                    description="Add any other custom links (e.g., TripAdvisor, YouTube). One URL per line."
                    placeholder="https://..."
                    values={formData["social_custom_links"] ? JSON.parse(formData["social_custom_links"]) : []}
                    onSave={async (newValues) => {
                      const valueString = JSON.stringify(newValues);
                      handleChange("social_custom_links", valueString);
                      await updateMutation.mutateAsync({ key: "social_custom_links", value: valueString });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4">
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  WhatsApp Widget Settings
                </CardTitle>
                <CardDescription>
                  Configure the floating WhatsApp contact button and its behavior.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Widget</Label>
                    <p className="text-sm text-muted-foreground">Show the floating WhatsApp button on all pages.</p>
                  </div>
                  <Switch
                    checked={whatsappSettings.enabled}
                    onCheckedChange={(checked) => setWhatsappSettings(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wa_phone">WhatsApp Phone Number</Label>
                    <Input
                      id="wa_phone"
                      value={whatsappSettings.phoneNumber}
                      onChange={(e) => setWhatsappSettings(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="+678 7114045"
                    />
                    <p className="text-xs text-muted-foreground">Include country code (e.g., +678 for Vanuatu).</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wa_pos">Widget Position</Label>
                    <Select
                      value={whatsappSettings.position}
                      onValueChange={(val) => setWhatsappSettings(prev => ({ ...prev, position: val as any }))}
                    >
                      <SelectTrigger id="wa_pos">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa_greeting">Greeting Message</Label>
                  <Textarea
                    id="wa_greeting"
                    value={whatsappSettings.greeting}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, greeting: e.target.value }))}
                    placeholder="Hello! How can we help you today?"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">The message that appears when someone opens the widget.</p>
                </div>

                <div className="pt-4 border-t flex justify-end">
                  <Button
                    onClick={handleSaveWhatsapp}
                    disabled={updateMutation.isPending}
                    className="w-full md:w-auto"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save WhatsApp Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>
                  Configure where admin booking notifications are sent. SMTP is configured via environment variables (GMAIL_USER, GMAIL_APP_PASSWORD).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SETTING_GROUPS.email.map((item) => (
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={item.placeholder}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Instructions Tab */}
          <TabsContent value="payments" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Offline Payment Instructions
                </CardTitle>
                <CardDescription>
                  Configure guest-facing instructions for offline payment methods. These are shown to customers on their booking confirmation page and emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Bank Transfer */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">🏦 Bank Transfer</h3>
                  <SettingItem
                    itemKey="bank_transfer_account_name"
                    label="Account Name"
                    value={formData["bank_transfer_account_name"] || ""}
                    placeholder="e.g. Ace Tours & Transfers Vanuatu Ltd"
                    onChange={(val) => handleChange("bank_transfer_account_name", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_account_name", value: formData["bank_transfer_account_name"] || "" })}
                  />
                  <SettingItem
                    itemKey="bank_transfer_account_number"
                    label="Account Number"
                    value={formData["bank_transfer_account_number"] || ""}
                    placeholder="e.g. 1234567"
                    onChange={(val) => handleChange("bank_transfer_account_number", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_account_number", value: formData["bank_transfer_account_number"] || "" })}
                  />
                  <SettingItem
                    itemKey="bank_transfer_bank_name"
                    label="Bank Name"
                    value={formData["bank_transfer_bank_name"] || ""}
                    placeholder="e.g. BSP · ANZ · BRED"
                    onChange={(val) => handleChange("bank_transfer_bank_name", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_bank_name", value: formData["bank_transfer_bank_name"] || "" })}
                  />
                  <SettingItem
                    itemKey="bank_transfer_reference_format"
                    label="Reference Format"
                    value={formData["bank_transfer_reference_format"] || ""}
                    placeholder="e.g. Use your Booking ID as reference (e.g. ACT-XXXX)"
                    onChange={(val) => handleChange("bank_transfer_reference_format", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_reference_format", value: formData["bank_transfer_reference_format"] || "" })}
                  />
                </div>

                {/* Cash on Delivery */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">💵 Cash on Delivery</h3>
                  <SettingItem
                    itemKey="cash_instructions"
                    label="Cash Payment Instructions"
                    value={formData["cash_instructions"] || ""}
                    placeholder="e.g. Pay your driver in cash (VUV preferred). Please bring exact change."
                    onChange={(val) => handleChange("cash_instructions", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "cash_instructions", value: formData["cash_instructions"] || "" })}
                  />
                  <SettingItem
                    itemKey="cash_accepted_currencies"
                    label="Accepted Currencies"
                    value={formData["cash_accepted_currencies"] || ""}
                    placeholder="e.g. VUV, AUD, NZD"
                    onChange={(val) => handleChange("cash_accepted_currencies", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "cash_accepted_currencies", value: formData["cash_accepted_currencies"] || "" })}
                  />
                </div>

                {/* E-Wallets */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">📱 E-Wallets (WanTok · Digicel · KwikPay)</h3>
                  <SettingItem
                    itemKey="ewallet_phone_number"
                    label="Merchant Phone Number"
                    value={formData["ewallet_phone_number"] || ""}
                    placeholder="e.g. +678 7342389"
                    onChange={(val) => handleChange("ewallet_phone_number", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "ewallet_phone_number", value: formData["ewallet_phone_number"] || "" })}
                  />
                  <SettingItem
                    itemKey="ewallet_reference_format"
                    label="Payment Reference"
                    value={formData["ewallet_reference_format"] || ""}
                    placeholder="e.g. Send your Booking ID as the payment reference"
                    onChange={(val) => handleChange("ewallet_reference_format", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "ewallet_reference_format", value: formData["ewallet_reference_format"] || "" })}
                  />
                  <SettingItem
                    itemKey="ewallet_instructions"
                    label="Additional Instructions"
                    value={formData["ewallet_instructions"] || ""}
                    placeholder="e.g. Screenshot your payment receipt and email/WhatsApp to us for faster confirmation."
                    onChange={(val) => handleChange("ewallet_instructions", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "ewallet_instructions", value: formData["ewallet_instructions"] || "" })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="newsletter-removed" className="mt-4">
            {/* Newsletter management has moved to its own dedicated page */}
            <div className="flex flex-col gap-4">
              {/* Enable/disable newsletter toggle */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Newsletter Settings</CardTitle>
                  <CardDescription>Control your subscriber list and newsletter feature visibility.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Newsletter feature flag toggle */}
                  {flags.filter((f: any) => f.slug === "newsletter").length > 0 ? (
                    flags.filter((f: any) => f.slug === "newsletter").map((flag: any) => (
                      <div key={flag.slug} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-semibold">Newsletter Enabled</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Show the newsletter signup form in the footer and site-wide. Disabling hides the form and stops new subscriptions.</p>
                        </div>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(checked) => toggleFlagMutation.mutate({ slug: flag.slug, enabled: checked })}
                          disabled={toggleFlagMutation.isPending}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div>
                        <p className="text-sm font-semibold">Newsletter Enabled</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Add a <code className="text-xs bg-muted px-1 rounded">newsletter</code> feature flag in Feature Flags tab to control visibility.</p>
                      </div>
                      <Switch checked={true} disabled />
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Subscribers", value: newsletterData?.length ?? "—", icon: <Users className="h-4 w-4" />, color: "text-blue-500" },
                      { label: "Confirmed", value: newsletterData?.filter((s: any) => s.confirmed).length ?? "—", icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500" },
                      { label: "Unconfirmed", value: newsletterData?.filter((s: any) => !s.confirmed && !s.unsubscribedAt).length ?? "—", icon: <Clock className="h-4 w-4" />, color: "text-yellow-500" },
                      { label: "Unsubscribed", value: newsletterData?.filter((s: any) => s.unsubscribedAt).length ?? "—", icon: <Trash2 className="h-4 w-4" />, color: "text-red-500" },
                    ].map(stat => (
                      <div key={stat.label} className="p-3 rounded-lg border border-border bg-card text-center">
                        <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
                        <div className="text-xl font-bold">{isNewsletterLoading ? "…" : stat.value}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Export button */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Download subscriber list as CSV for use in email platforms.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!newsletterData?.length) return;
                        const rows = [
                          ["Email", "Name", "Locale", "Source", "Confirmed", "Subscribed At", "Unsubscribed At"],
                          ...newsletterData.map((s: any) => [
                            s.email, s.name ?? "", s.locale ?? "en", s.source ?? "website",
                            s.confirmed ? "yes" : "no",
                            s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "",
                            s.unsubscribedAt ? new Date(s.unsubscribedAt).toLocaleDateString() : "",
                          ])
                        ];
                        const csv = rows.map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url;
                        a.download = `subscribers-${new Date().toISOString().split("T")[0]}.csv`;
                        a.click(); URL.revokeObjectURL(url);
                      }}
                      disabled={!newsletterData?.length}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Subscribers table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Subscribers</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isNewsletterLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                  ) : !newsletterData?.length ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No subscribers yet. The newsletter signup form will collect emails automatically.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Locale</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {newsletterData.map((sub: any) => (
                            <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-foreground">{sub.email}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">{sub.name ?? "—"}</td>
                              <td className="py-2.5 px-4">
                                <span className="px-2 py-0.5 rounded-full text-xs bg-muted border border-border">{sub.source ?? "website"}</span>
                              </td>
                              <td className="py-2.5 px-4 hidden sm:table-cell">
                                <span className="flex items-center gap-1 text-muted-foreground"><Globe className="h-3 w-3" />{sub.locale ?? "en"}</span>
                              </td>
                              <td className="py-2.5 px-4">
                                {sub.unsubscribedAt ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-500 border border-red-500/20">Unsubscribed</span>
                                ) : sub.confirmed ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-600 border border-green-500/20">Confirmed</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">Pending</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground hidden md:table-cell text-xs">
                                {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="seo" className="mt-4 space-y-4">
            {/* H: SEO Control Surface */}
            <Card>
              <CardHeader>
                <CardTitle>SEO &amp; Metadata</CardTitle>
                <CardDescription>
                  Control page titles, meta descriptions, and Open Graph tags. Changes take effect on next page load.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "seo_site_name", label: "Site Name", placeholder: "Ace Tours & Transfers Vanuatu" },
                  { key: "seo_title_template", label: "Title Template", placeholder: "{page} | Ace Tours Vanuatu" },
                  { key: "seo_default_description", label: "Default Meta Description", placeholder: "Experience the best of Vanuatu with Ace Tours & Transfers..." },
                  { key: "seo_default_keywords", label: "Default Keywords", placeholder: "vanuatu tours, port vila transfers, efate island" },
                  { key: "seo_canonical_url", label: "Canonical URL Prefix", placeholder: "https://acetours.vu" },
                  { key: "seo_og_image", label: "Default OG Image URL", placeholder: "https://res.cloudinary.com/..." },
                ].map((item) => (
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={item.placeholder}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schema.org Markup</CardTitle>
                <CardDescription>
                  Structured data helps search engines and AI assistants understand your business. These settings are injected as JSON-LD.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "schema_business_name", label: "Business Name", placeholder: "Ace Tours & Transfers" },
                  { key: "schema_business_type", label: "Business Type", placeholder: "TouristInformationCenter" },
                  { key: "schema_phone", label: "Business Phone", placeholder: "+678 12345" },
                  { key: "schema_address", label: "Street Address", placeholder: "Port Vila, Efate, Vanuatu" },
                  { key: "schema_price_range", label: "Price Range", placeholder: "$$" },
                ].map((item) => (
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={item.placeholder}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4 space-y-4">
            {/* I: Analytics — GA4 + GTM (both 100% free, no monthly fees) */}
            <Card>
              <CardHeader>
                <CardTitle>Google Analytics 4 (GA4)</CardTitle>
                <CardDescription>
                  GA4 is completely free — no monthly fees, no usage caps for standard use.
                  Create a free account at <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">analytics.google.com</a>,
                  create a property, and paste your Measurement ID below. The tracking script loads automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingItem
                  itemKey="ga4_measurement_id"
                  label="GA4 Measurement ID"
                  value={formData["ga4_measurement_id"] || ""}
                  placeholder="G-XXXXXXXXXX"
                  onChange={(val) => handleChange("ga4_measurement_id", val)}
                  onSave={() => updateMutation.mutateAsync({ key: "ga4_measurement_id", value: formData["ga4_measurement_id"] || "" })}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Format: <code className="bg-muted px-1 rounded text-xs">G-XXXXXXXXXX</code> — found in GA4 → Admin → Data Streams → your stream
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Google Tag Manager (GTM)</CardTitle>
                <CardDescription>
                  GTM is also free. Use it to manage GA4, Facebook Pixel, and other tags without code changes.
                  Create a free container at <a href="https://tagmanager.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">tagmanager.google.com</a>.
                  If you use GTM, you can manage GA4 from inside it — you don't need both fields filled in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingItem
                  itemKey="gtm_container_id"
                  label="GTM Container ID"
                  value={formData["gtm_container_id"] || ""}
                  placeholder="GTM-XXXXXXX"
                  onChange={(val) => handleChange("gtm_container_id", val)}
                  onSave={() => updateMutation.mutateAsync({ key: "gtm_container_id", value: formData["gtm_container_id"] || "" })}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Format: <code className="bg-muted px-1 rounded text-xs">GTM-XXXXXXX</code> — found in GTM → Admin → Container Settings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uptime Monitoring (BetterStack)</CardTitle>
                <CardDescription>
                  BetterStack Uptime is free — unlimited monitors, 3-minute check intervals, no credit card required.
                  Sign up free at <a href="https://betterstack.com/uptime" target="_blank" rel="noopener noreferrer" className="text-primary underline">betterstack.com/uptime</a>,
                  create a monitor for your site, then add the credentials to your server environment.
                  These values go in your <code className="bg-muted px-1 rounded text-xs">.env</code> / Render environment variables — not stored in the database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-amber-800">Environment Variables Required (set in Render Dashboard → Environment)</p>
                  <div className="font-mono text-xs bg-white border border-amber-200 rounded p-3 space-y-1">
                    <p><span className="text-blue-600">BETTERSTACK_API_KEY</span>=your_api_key_here</p>
                    <p><span className="text-blue-600">BETTERSTACK_MONITOR_ID</span>=your_monitor_id_here</p>
                  </div>
                  <p className="text-amber-700 text-xs">
                    API Key: BetterStack → Account → API tokens. Monitor ID: visible in the URL when viewing your monitor.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Integrations Tab ────────────────────────────────────────────── */}
          <TabsContent value="integrations" className="mt-4 space-y-4">

            {/* Review Provider Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  Review Provider
                </CardTitle>
                <CardDescription>
                  Choose which external review platform appears above the booking CTA and below guest reviews on all detail pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {(["trustpilot", "google", "none"] as const).map(option => {
                    const current = formData["review_provider"] ?? "trustpilot";
                    const isActive = current === option;
                    const labels: Record<string, string> = {
                      trustpilot: "Trustpilot",
                      google: "Google Reviews",
                      none: "None",
                    };
                    return (
                      <button
                        key={option}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, review_provider: option }));
                          updateMutation.mutate({ key: "review_provider", value: option });
                        }}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}
                      >
                        {labels[option]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: <code className="bg-muted px-1 rounded">{formData["review_provider"] ?? "trustpilot"}</code>.
                  Changes take effect immediately.
                </p>
              </CardContent>
            </Card>

            {/* Google Reviews */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-white flex items-center justify-center border border-border/50">
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  Google Reviews API
                </CardTitle>
                <CardDescription>
                  Fetches your latest ratings directly from Google Places.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                  <p className="font-semibold text-xs tracking-wider text-muted-foreground uppercase">Configure Environment</p>
                  <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                    <p><span className="text-blue-500">GOOGLE_PLACES_API_KEY</span>=<span className="text-green-600">AIzaSy...</span></p>
                    <p><span className="text-blue-500">GOOGLE_PLACE_ID</span>=<span className="text-green-600">ChIJ...</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Get your key from Google Cloud Console (Places API) and find your ID with Google's <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-primary underline">Finder</a>.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Trustpilot TrustBox Widget */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#00b67a] flex items-center justify-center">
                    <Star className="h-3.5 w-3.5 text-white fill-white" />
                  </div>
                  Trustpilot TrustBox Widget
                </CardTitle>
                <CardDescription>
                  Displays a live Trustpilot rating bar on every tour detail page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Status badge */}
                {(() => {
                  const buId = import.meta.env.VITE_TRUSTPILOT_BU_ID;
                  return buId ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-green-500/30 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">Widget Active</p>
                        <p className="text-xs text-muted-foreground">Business Unit ID: <code className="bg-muted px-1 rounded text-xs">{buId}</code></p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-400/30 bg-amber-50 dark:bg-amber-900/20">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Widget Inactive — Business Unit ID not set</p>
                        <p className="text-xs text-muted-foreground">The fallback static link is shown to guests until you add the env var.</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                  <p className="font-semibold text-xs tracking-wider text-muted-foreground uppercase">Required Environment Variables</p>
                  <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                    <p><span className="text-blue-500">VITE_TRUSTPILOT_BU_ID</span>=<span className="text-green-600">bu_id</span></p>
                    <p><span className="text-blue-500">VITE_TRUSTPILOT_URL</span>=<span className="text-green-600">https://www.trustpilot.com/review/acetours.vu</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Obtain your Business Unit ID from <strong>Integrations → TrustBox Library</strong> in your Trustpilot Business account.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payments & SMS Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stripe */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Stripe Payments
                  </CardTitle>
                  <CardDescription>
                    Secure credit and debit card processing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">STRIPE_PUBLISHABLE_KEY</span>=<span className="text-green-600">pk_...</span></p>
                      <p><span className="text-blue-500">STRIPE_SECRET_KEY</span>=<span className="text-green-600">sk_...</span></p>
                    </div>
                  </div>
                  <Button variant="outline" asChild size="sm" className="w-full">
                    <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                      Open Stripe Dashboard <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* SMS Gateway */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    SMS Notifications
                  </CardTitle>
                  <CardDescription>
                    Send booking alerts via Android SMS Gateway or Twilio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">SMS_PROVIDER</span>=<span className="text-green-600">android_gateway</span> | <span className="text-green-600">twilio</span></p>
                      <p><span className="text-blue-500">SMS_GATEWAY_URL</span>=<span className="text-green-600">http://ip:port</span></p>
                      <p><span className="text-blue-500">TWILIO_ACCOUNT_SID</span>=<span className="text-green-600">AC...</span></p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set provider to <code className="bg-muted px-1 rounded">android_gateway</code> for local Vanuatu SIM integration.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Email & Media Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cloudinary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#3448c5] flex items-center justify-center">
                      <span className="text-white font-bold text-xs">C</span>
                    </div>
                    Cloudinary Assets
                  </CardTitle>
                  <CardDescription>
                    Image optimization and cloud storage for tour photos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                      <p><span className="text-blue-500">VITE_CLOUDINARY_CLOUD_NAME</span>=<span className="text-green-600">name</span></p>
                    </div>
                  </div>
                  <Button variant="outline" asChild size="sm" className="w-full">
                    <a href="https://cloudinary.com/console" target="_blank" rel="noopener noreferrer">
                      Open Cloudinary Console <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Email Gateway (Nodemailer) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-red-500" />
                    Google SMTP (Gmail)
                  </CardTitle>
                  <CardDescription>
                    Transaction emails for booking confirmations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                      <p><span className="text-blue-500">GMAIL_USER</span>=<span className="text-green-600">your-email@gmail.com</span></p>
                      <p><span className="text-blue-500">GMAIL_APP_PASSWORD</span>=<span className="text-green-600">16-char-code</span></p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use "App Passwords" in Google Security settings. Standard passwords will not work.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Infra Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Redis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#d82c20] flex items-center justify-center">
                      <span className="text-white font-bold text-xs">R</span>
                    </div>
                    Redis Cache
                  </CardTitle>
                  <CardDescription>
                    Session storage and high-performance caching.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">REDIS_URL</span>=<span className="text-green-600">redis://...</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sentry */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#362d59] flex items-center justify-center">
                      <span className="text-white font-bold text-xs text-[10px]">S</span>
                    </div>
                    Sentry Monitoring
                  </CardTitle>
                  <CardDescription>
                    Error tracking and performance monitoring.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">SENTRY_DSN</span>=<span className="text-green-600">https://...</span></p>
                      <p><span className="text-blue-500">VITE_SENTRY_DSN</span>=<span className="text-green-600">https://...</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Render Dashboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-black flex items-center justify-center">
                    <span className="text-white font-bold text-xs">R</span>
                  </div>
                  Render Hosting
                </CardTitle>
                <CardDescription>
                  Access your server logs, redeploy the application, and manage environment variables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-sm">Log in to the Render dashboard to monitor your web service performance, view deployment logs, or update environment variables (like adding API keys).</p>
                  <Button variant="outline" asChild size="sm">
                    <a href="https://dashboard.render.com" target="_blank" rel="noopener noreferrer">
                      Open Render Dashboard <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Neon Database */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#00e599] flex items-center justify-center">
                    <span className="text-black font-bold text-xs text-[10px]">Neon</span>
                  </div>
                  Neon Database
                </CardTitle>
                <CardDescription>
                  Manage your PostgreSQL database, view branches, and execute raw SQL queries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-sm">Neon hosts your application data. Use the Neon console to manage backups, view storage limits, or check database connection string credentials.</p>
                  <Button variant="outline" asChild size="sm">
                    <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer">
                      Open Neon Console <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* BetterStack */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  BetterStack Monitoring
                </CardTitle>
                <CardDescription>
                  24/7 uptime monitoring and incident alerting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
                  <p className="text-muted-foreground leading-relaxed italic">
                    Configure environment variables <code className="bg-muted px-1 rounded text-xs">BETTERSTACK_API_KEY</code> and <code className="bg-muted px-1 rounded text-xs">BETTERSTACK_MONITOR_ID</code> in Render to enable.
                  </p>
                  <Button variant="outline" asChild size="sm" className="w-full">
                    <a href="https://betterstack.com" target="_blank" rel="noopener noreferrer">
                      Open BetterStack <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>


            {/* Banks Payment Gateways */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-600" />
                  Local Bank Gateways
                </CardTitle>
                <CardDescription>
                  Configure instructions for offline payments (BSP, ANZ, BRED, E-Wallets).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm">
                  <p className="text-blue-800">
                    Guest instructions for bank transfers and e-wallets are managed in the <strong>Payment Instructions</strong> tab.
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
                  <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Switching Providers</p>
                  <p className="text-muted-foreground">
                    To enable/disable specific payment methods (like "Pay by Card" vs "Manual Bank Transfer"), go to the <strong>Feature Flags</strong> tab.
                  </p>
                </div>
              </CardContent>
            </Card>


          </TabsContent>

          <TabsContent value="flags" className="mt-4 space-y-4">
            {/* ── Coming Soon Toggle — prominent card at top ── */}
            {(() => {
              const comingSoonFlag = flags.find((f: any) => f.slug === "coming-soon");
              if (!comingSoonFlag) return null;
              return (
                <Card className={comingSoonFlag.enabled ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "border-green-400 bg-green-50 dark:bg-green-950/20"}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${comingSoonFlag.enabled ? "bg-amber-400 animate-pulse" : "bg-green-500"}`} />
                        <CardTitle className="text-base">
                          {comingSoonFlag.enabled ? "🚧 Coming Soon Mode is ON" : "🟢 Site is LIVE"}
                        </CardTitle>
                      </div>
                      <Switch
                        id="coming-soon-toggle"
                        checked={comingSoonFlag.enabled}
                        onCheckedChange={(checked) => toggleFlagMutation.mutate({ slug: "coming-soon", enabled: checked })}
                        disabled={toggleFlagMutation.isPending}
                      />
                    </div>
                    <CardDescription className="mt-2">
                      {comingSoonFlag.enabled
                        ? "The public site is showing the Coming Soon page. Staff & admins can still log in via /staff-access."
                        : "The site is fully live and accessible to all visitors. Toggle ON to show the Coming Soon page instead."}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })()}

            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>
                  Enable or disable system features. Disabled features will be hidden from the public UI.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {flags
                  .filter((flag: any) => !flag.slug.startsWith('payment-') && flag.slug !== 'stripe' && flag.slug !== 'local-bank')
                  .map((flag: any) => (
                    <div key={flag.slug} className="flex items-center justify-between space-x-2">
                      <div className="flex flex-col space-y-1">
                        <Label htmlFor={flag.slug} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {flag.displayName}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {flag.description}
                        </p>
                      </div>
                      <Switch
                        id={flag.slug}
                        checked={flag.enabled}
                        onCheckedChange={(checked) => toggleFlagMutation.mutate({ slug: flag.slug, enabled: checked })}
                        disabled={toggleFlagMutation.isPending}
                      />
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Backlinks Tab ──────────────────────────────────────────────── */}
          <TabsContent value="backlinks" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Footer Backlinks & Partners</CardTitle>
                <CardDescription>
                  Manage the external links displayed in the website footer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingList
                  itemKey="footer_backlinks"
                  label="Footer Backlinks"
                  description="Enter links as 'Label | URL'. Example: 'Vanuatu Tourism | https://www.vanuatu.travel/'"
                  values={(formData["footer_backlinks"] || "").split("\n").filter(Boolean)}
                  onSave={async (newValues) => {
                    const str = newValues.join("\n");
                    setFormData(prev => ({ ...prev, footer_backlinks: str }));
                    await updateMutation.mutateAsync({ key: "footer_backlinks", value: str });
                  }}
                  placeholder="Label | URL"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coming-soon" className="mt-4">
            <ComingSoonTab
              formData={formData}
              flags={flags}
              onChange={handleChange}
              onSave={(key) => updateMutation.mutateAsync({ key, value: formData[key] || "" })}
              toggleFlagMutation={toggleFlagMutation}
              isSaving={updateMutation.isPending}
            />
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
