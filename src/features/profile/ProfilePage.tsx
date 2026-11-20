import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Car, ChevronRight, KeyRound, LogOut, Mail, MapPin, Trash2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError, supabase } from "@/lib/supabase";
import { passwordProblem } from "@/lib/password";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/format";
import { PasswordField } from "@/features/auth/components/PasswordField";
import { deleteSavedPlace, listSavedPlaces } from "@/features/places/placesApi";
import type { SavedPlace } from "@/types";
import { ProfileForm, cleanFields, toFields } from "./ProfileForm";
import { ProfilePhoto } from "./ProfilePhoto";

export function ProfilePage() {
  const { profile, updateProfile, signOut } = useAuth();
  const toast = useToast();
  if (!profile?.role) return null;

  return (
    <div className="mx-auto w-full max-w-xl space-y-10 px-4 py-8 sm:px-6">
      <Card className="flex items-center gap-4 p-5">
        <ProfilePhoto />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">{profile.full_name || "Your profile"}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <Mail className="h-3.5 w-3.5" /> {profile.email}
          </p>
          <p className="mt-1 text-xs text-subtle">Member since {formatDateTime(profile.created_at)}</p>
        </div>
        <Badge tone={profile.driver_verified ? "success" : "gold"}>
          {profile.role === "driver" ? (profile.driver_verified ? "Verified driver" : "Driver") : "Customer"}
        </Badge>
      </Card>

      {profile.role === "driver" && (
        <Link to="/driver/documents" className="block">
          <Card className="flex items-center gap-4 p-5 transition hover:border-gold/50">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line text-gold">
              <Car className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">Vehicle and documents</p>
              <p className="text-sm text-muted">Vehicle type, photo, licence and registration</p>
            </div>
            <ChevronRight className="h-5 w-5 text-subtle" />
          </Card>
        </Link>
      )}

      <section>
        <SectionTitle title="Edit details" />
        <ProfileForm
          key={profile.updated_at}
          role={profile.role}
          hideVehicle
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
