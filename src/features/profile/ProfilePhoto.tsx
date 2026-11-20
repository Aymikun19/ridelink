import { useRef, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { removePublicImage, uploadPublicImage } from "@/lib/uploads";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PhotoEditor } from "@/components/ui/PhotoEditor";
import { Spinner } from "@/components/ui/Spinner";

/** Tappable avatar: change (with crop and zoom) or remove the profile photo. */
export function ProfilePhoto({ size = "h-16 w-16" }: { size?: string }) {
  const { profile, updateProfile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const choose = () => fileRef.current?.click();

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ tone: "error", title: "Choose an image file" });
      return;
    }
    setMenu(false);
    setFile(f);
  };

  const save = async (blob: Blob) => {
    setBusy(true);
    try {
      const url = await uploadPublicImage("avatars", profile.id, blob);
      const old = profile.avatar_url;
      await updateProfile({ avatar_url: url });
      removePublicImage("avatars", old);
      setFile(null);
      toast({ tone: "success", title: "Photo updated" });
    } catch (err) {
      toast({ tone: "error", title: "Could not update photo", body: readableError(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const old = profile.avatar_url;
      await updateProfile({ avatar_url: null });
      removePublicImage("avatars", old);
      setMenu(false);
      toast({ tone: "success", title: "Photo removed" });
    } catch (err) {
      toast({ tone: "error", title: "Could not remove photo", body: readableError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (profile.avatar_url ? setMenu(true) : choose())}
        className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        aria-label={profile.avatar_url ? "Edit profile photo" : "Add profile photo"}
      >
        <Avatar name={profile.full_name} src={profile.avatar_url} className={`${size} text-lg`} />
        <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/45 text-white group-hover:flex">
          <Camera className="h-5 w-5" />
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-gold text-[#0b0b0b]">
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />

      <Modal open={menu} onClose={() => setMenu(false)} title="Profile photo">
        <div className="flex flex-col items-center gap-5">
          <Avatar name={profile.full_name} src={profile.avatar_url} className="h-40 w-40 text-4xl" />
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" onClick={remove} loading={busy} icon={<Trash2 className="h-4 w-4" />}>
              Remove
            </Button>
            <Button variant="gold" onClick={choose} disabled={busy} icon={<ImagePlus className="h-4 w-4" />}>
              Change photo
            </Button>
          </div>
          {profile.role === "driver" && (
            <p className="text-center text-xs text-subtle">Drivers need a clear photo of their face so customers can recognise them.</p>
          )}
        </div>
      </Modal>

      <PhotoEditor file={file} title="Position your photo" round outputSize={512} saving={busy} onCancel={() => setFile(null)} onSave={save} />
    </>
  );
}
