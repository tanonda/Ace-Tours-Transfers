import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { uploadImage } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onUploadSuccess: (url: string) => void;
  currentImageUrl?: string;
}

export function FileUpload({ onUploadSuccess, currentImageUrl }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const result = await uploadImage(selectedFile);
      onUploadSuccess(result.url);
      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
      setSelectedFile(null);
      setPreview(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-dashed">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-lg font-medium text-primary">Drop the image here...</p>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">
                    Drag & drop an image here, or click to select
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports JPG, PNG, WebP (max 5MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded border"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0"
                  onClick={clearSelection}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{selectedFile?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile?.size || 0) / 1024 / 1024 < 1
                    ? `${Math.round((selectedFile?.size || 0) / 1024)} KB`
                    : `${((selectedFile?.size || 0) / 1024 / 1024).toFixed(1)} MB`}
                </p>
              </div>
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="shrink-0"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentImageUrl && !preview && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={currentImageUrl}
                  alt="Current image"
                  className="w-20 h-20 object-cover rounded border"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const fallback = parent.querySelector('.fallback-icon') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }
                  }}
                />
                <div className="fallback-icon w-20 h-20 bg-muted rounded flex items-center justify-center" style={{ display: 'none' }}>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Current Image</p>
                <p className="text-xs text-muted-foreground truncate">{currentImageUrl}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}