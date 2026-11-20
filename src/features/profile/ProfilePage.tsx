import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Camera, KeyRound, LogOut, Mail, MapPin, Trash2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError, supabase } from "@/lib/supabase";
import { passwordProblem } from "@/lib/password";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/format";
import { PasswordField } from "@/features/auth/components/PasswordField";
import { deleteSavedPlace, listSavedPlaces } from "@/features/places/placesApi";
import type { SavedPlace } from "@/types";
import { ProfileForm, cleanFields, toFields } from "./ProfileForm";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Downscales to at most 512 px on the long side and re-encodes as JPEG. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image"))), "image/jpeg", 0.85),
  );
}

export function ProfilePage() {
  const { profile, updateProfile, signOut } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!profile?.role) return null;

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ tone: "error", title: "Choose an image file" });
      return;
    }
    setUploading(true);
    try {
      const blob = await resizeImage(file);
      if (blob.size > MAX_PHOTO_BYTES) throw new Error("That image is too large. Try a smaller one.");
      const path = `${profile.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const old = profile.avatar_url?.split("/avatars/")[1];
      await updateProfile({ avatar_url: data.publicUrl });
      if (old) void supabase.storage.from("avatars").remove([old]);
      toast({ tone: "success", title: "Photo updated" });
    } catch (err) {
      toast({ tone: "error", title: "Could not update photo", body: readableError(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-10 px-4 py-8 sm:px-6">
      <Card className="flex items-center gap-4 p-5">
        <div className="relative">
          <Avatar name={profile.full_name} src={profile.avatar_url} className="h-16 w-16 text-lg" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-gold text-[#0b0b0b] transition hover:scale-105"
            aria-label="Change photo"
          >
            {uploading ? <Spinner className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhoto} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">{profile.full_name || "Your profile"}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <Mail className="h-3.5 w-3.5" /> {profile.email}
          </p>
          <p className="mt-1 text-xs text-subtle">Member since {formatDateTime(profile.created_at)}</p>
        </div>
        <Badge tone="gold">{profile.role === "driver" ? "Driver" : "Customer"}</Badge>
      </Card>

      <section>
        <SectionTitle title="Edit details" />
        <ProfileForm
          key={profile.updated_at}
          role={profile.role}
          initial={toFields(profile)}
          submitLabel="Save changes"
          onSubmit={async (f) => {
            try {
              await updateProfile(cleanFields(f, profile.role!));
              toast({ tone: "success", title: "Profile updated" });
            } catch (err) {
              toast({ tone: "error", title: "Could not save", body: readableError(err) });
            }
          }}
        />
      </section>

      {profile.role === "customer" && <SavedPlacesSection />}

      <ChangePasswordSection email={profile.email} />

      <Button variant="danger" block onClick={signOut} icon={<LogOut className="h-4 w-4" />}>
        Log out
      </Button>
    </div>
  );
}

function SavedPlacesSection() {
  const toast = useToast();
  const [places, setPlaces] = useState<SavedPlace[] | null>(null);

  useEffect(() => {
    listSavedPlaces().then(setPlaces).catch(() => setPlaces([]));
  }, []);

  const remove = async (p: SavedPlace) => {
    try {
      await deleteSavedPlace(p.id);
      setPlaces((list) => list?.filter((x) => x.id !== p.id) ?? null);
    } catch (err) {
      toast({ tone: "error", title: "Could not remove", body: readableError(err) });
    }
  };

  return (
    <section>
      <SectionTitle title="Saved places" />
      {!places ? (
        <Spinner />
      ) : places.length === 0 ? (
        <p className="text-sm text-muted">
          No saved places yet. When you choose a drop-off on the{" "}
          <Link to="/app" className="font-medium text-fg hover:text-gold">
            booking screen
          </Link>
          , tap "Save this place".
        </p>
      ) : (
        <div className="space-y-2">
          {places.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-4">
              <MapPin className="h-4 w-4 shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="truncate text-xs text-muted">{p.address}</p>
              </div>
              <button onClick={() => remove(p)} className="rounded-full p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove ${p.label}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function ChangePasswordSection({ email }: { email: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = passwordProblem(next);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (problem) return;
    setSaving(true);
    try {
      // Confirm the current password before changing it.
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new Error("Your current password is incorrect.");
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      setCurrent("");
      setNext("");
      setTouched(false);
      toast({ tone: "success", title: "Password changed" });
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <SectionTitle title="Change password" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField
          name="current-password"
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <PasswordField
          name="new-password"
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          showStrength
          error={touched ? problem : null}
          required
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="secondary" block loading={saving} disabled={!current || !next} icon={<KeyRound className="h-4 w-4" />}>
          Update password
        </Button>
        <p className="text-center text-xs text-subtle">
          Signed up with an email code and never set a password?{" "}
          <Link to="/forgot-password" state={{ email }} className="font-medium text-muted hover:text-gold">
            Set one here
          </Link>
          .
        </p>
      </form>
    </section>
  );
}
