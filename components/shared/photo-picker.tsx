"use client";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const KEY = "profile-photo";
const EVT = "profile-photo-changed";
const MAX_BYTES = 2 * 1024 * 1024;

/** The saved profile photo (stored in this browser), kept in sync across components. */
export function useProfilePhoto() {
  const [src, setSrc] = React.useState<string | undefined>();
  React.useEffect(() => {
    const read = () => { try { setSrc(localStorage.getItem(KEY) ?? undefined); } catch { /* storage blocked */ } };
    read();
    window.addEventListener(EVT, read);
    return () => window.removeEventListener(EVT, read);
  }, []);
  return src;
}

/** Working "Change photo" button: validates, square-crops to 256px and saves. */
export function ChangePhotoButton() {
  const { toast } = useToast();
  const input = React.useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Choose an image file", description: "PNG, JPG or WebP." }); return; }
    if (file.size > MAX_BYTES) { toast({ title: "Image is too large", description: "Please pick one under 2 MB." }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = 256, canvas = document.createElement("canvas");
        canvas.width = s; canvas.height = s;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, s, s);
        try {
          localStorage.setItem(KEY, canvas.toDataURL("image/jpeg", 0.85));
          window.dispatchEvent(new Event(EVT));
          toast({ title: "Photo updated", description: "Saved in this browser.", variant: "success" });
        } catch {
          toast({ title: "Could not save the photo", description: "Browser storage is unavailable." });
        }
      };
      img.onerror = () => toast({ title: "Could not read that image" });
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input ref={input} type="file" accept="image/*" className="sr-only" aria-label="Upload profile photo" onChange={onFile} />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>Change photo</Button>
    </>
  );
}

export function PhotoAvatar({ name, size }: { name: string; size?: number }) {
  return <Avatar name={name} src={useProfilePhoto()} size={size} />;
}
