import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/admin/ImageUpload";

export function GalleryEditor({
  value,
  onChange,
  folder,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  folder: string;
}) {
  return (
    <div>
      <Label>Gallery</Label>
      {value.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="group relative aspect-square overflow-hidden border border-border"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                title="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Remove image</span>
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 border border-dashed border-border p-3">
        <ImageUpload
          value={null}
          onChange={(url) => {
            if (url) onChange([...value, url]);
          }}
          folder={folder}
          label="Add gallery image"
        />
      </div>
    </div>
  );
}

export type Specification = { key: string; value: string };

export function SpecificationEditor({
  value,
  onChange,
}: {
  value: Specification[];
  onChange: (value: Specification[]) => void;
}) {
  const update = (index: number, field: keyof Specification, nextValue: string) => {
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: nextValue } : item,
      ),
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Label>Specifications</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...value, { key: "", value: "" }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <div className="mt-2 space-y-2">
        {value.map((item, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_36px] gap-2">
            <Input
              value={item.key}
              onChange={(event) => update(index, "key", event.target.value)}
              placeholder="Name"
              aria-label={`Specification ${index + 1} name`}
            />
            <Input
              value={item.value}
              onChange={(event) => update(index, "value", event.target.value)}
              placeholder="Value"
              aria-label={`Specification ${index + 1} value`}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              title="Remove specification"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="sr-only">Remove specification</span>
            </Button>
          </div>
        ))}
        {value.length === 0 && (
          <p className="text-xs text-muted-foreground">No specifications added.</p>
        )}
      </div>
    </div>
  );
}
