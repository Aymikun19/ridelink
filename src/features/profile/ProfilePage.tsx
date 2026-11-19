import { LogOut, Mail } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import { ProfileForm, cleanFields, toFields } from "./ProfileForm";

export function ProfilePage() {
  const { profile, updateProfile, signOut } = useAuth();
  const toast = useToast();
  if (!profile?.role) return null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <Card className="mb-6 flex items-center gap-4 p-5">
        <Avatar name={profile.full_name} className="h-14 w-14 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">{profile.full_name || "Your profile"}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <Mail className="h-3.5 w-3.5" /> {profile.email}
          </p>
          <p className="mt-1 text-xs text-subtle">Member since {formatDateTime(profile.created_at)}</p>
        </div>
        <Badge tone="gold">{profile.role === "driver" ? "Driver" : "Customer"}</Badge>
      </Card>

      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight">Edit details</h1>
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

      <Button variant="danger" block className="mt-10" onClick={signOut} icon={<LogOut className="h-4 w-4" />}>
        Sign out
      </Button>
    </div>
  );
}
