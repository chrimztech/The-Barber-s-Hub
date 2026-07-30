import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  label?: string;
};

export function ImageUpload({ value, onChange, folder = "uploads", label = "Image" }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Image uploaded");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="" className="h-40 w-40 object-cover border border-border" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center h-40 w-40 border-2 border-dashed border-border hover:border-primary cursor-pointer transition group">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="text-center text-muted-foreground group-hover:text-primary">
            <Upload className="h-6 w-6 mx-auto mb-2" />
            <div className="text-xs">{uploading ? "Uploading…" : "Click to upload"}</div>
          </div>
        </label>
      )}
    </div>
  );
}
