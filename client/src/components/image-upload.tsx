import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
}

export function ImageUpload({ value, onChange, folder = "ace-tours", label = "Image" }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`/api/admin/upload?folder=${folder}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      onChange(data.url);
      toast({
        title: "Upload successful",
        description: "Image has been uploaded to Cloudinary.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-4">
        {value ? (
          <div className="relative h-24 w-32 bg-muted rounded-md overflow-hidden border border-border">
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-1 right-1 h-6 w-6 rounded-full"
              onClick={() => onChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="h-24 w-32 bg-muted rounded-md flex flex-col items-center justify-center border border-dashed border-border text-muted-foreground">
            <ImageIcon className="h-8 w-8 mb-1 opacity-20" />
            <span className="text-[10px]">No Image</span>
          </div>
        )}

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {value ? "Replace Image" : "Upload Image"}
                </>
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Max 5MB. JPEGs, PNGs preferred. URL:
          </p>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Or enter URL directly..."
            className="h-8 text-xs"
            disabled={uploading}
          />
        </div>
      </div>
    </div>
  );
}
