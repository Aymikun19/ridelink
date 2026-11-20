import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Camera, Car, CheckCircle2, Circle, ExternalLink, FileText, IdCard, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { removePublicImage, uploadPublicImage } from "@/lib/uploads";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { PhotoEditor } from "@/components/ui/PhotoEditor";
import { VEHICLE_TYPES, type DriverDocuments, type VehicleType } from "@/types";
import {
  documentUrl,
  driverChecklist,
  getDriverDocuments,
  removeDriverDocument,
  saveDriverDocuments,
  uploadDriverDocument,
} from "./documentsApi";

const statusCopy = {
  incomplete: { tone: "neutral" as const, label: "Incomplete", body: "Finish the checklist below to start receiving ride requests." },
  submitted: { tone: "gold" as const, label: "Submitted", body: "You can go online now. Your documents are waiting for review; approved drivers get a Verified badge." },
  approved: { tone: "success" as const, label: "Verified", body: "Your documents are approved. Customers see a Verified badge on your profile." },
  rejected: { tone: "danger" as const, label: "Needs changes", body: "Your documents need changes. Update them below and they will be reviewed again." },
};

const thisYear = new Date().getFullYear();

export function DriverDocumentsPage() {
  const { profile, updateProfile } = useAuth();
  const toast = useToast();
  const [docs, setDocs] = useState<DriverDocuments | null | undefined>(undefined);

  useEffect(() => {
    if (!profile) return;
    getDriverDocuments(profile.id)
      .then(setDocs)
      .catch(() => setDocs(null));
  }, [profile]);

  if (!profile || docs === undefined) return <FullPageSpinner />;
  if (profile.role !== "driver") return <p className="p-8 text-center text-muted">This page is for drivers.</p>;

  const checklist = driverChecklist(profile, docs);
  const doneCount = checklist.filter((c) => c.done).length;
  const status = docs?.status ?? "incomplete";
  const copy = statusCopy[status];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-8 sm:px-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Driver</p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Vehicle <span className="font-serif font-normal italic text-gold">and</span> documents
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Like other ride-hailing apps, RideLink needs your vehicle and licence details before you can drive. No bank or payment details
          are needed: riders pay you directly.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className={cn("h-6 w-6", status === "approved" ? "text-success" : "text-gold")} />
            <div>
              <p className="font-semibold">Status</p>
              <p className="text-sm text-muted">{copy.body}</p>
            </div>
          </div>
          <Badge tone={copy.tone}>{copy.label}</Badge>
        </div>
        {docs?.review_note && status === "rejected" && (
          <p className="mt-4 rounded-2xl bg-danger/10 p-3 text-sm">Reviewer note: {docs.review_note}</p>
        )}
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs text-muted">
            <span>Checklist</span>
            <span>
              {doneCount} of {checklist.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-sm">
                {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-subtle" />}
                <span className={c.done ? "text-fg" : "text-muted"}>{c.label}</span>
              </li>
            ))}
          </ul>
          {!profile.avatar_url && (
            <p className="mt-4 text-sm text-muted">
              Add your profile photo on the{" "}
              <Link to="/profile" className="font-medium text-fg hover:text-gold">
                Profile page
              </Link>
              . Customers use it to recognise you.
            </p>
          )}
          {docs?.submitted_at && <p className="mt-3 text-xs text-subtle">Last submitted {formatDateTime(docs.submitted_at)}</p>}
        </div>
      </Card>

      <VehicleSection
        onSaved={async (patch) => {
          await updateProfile(patch);
          // Re-read: the database recalculates the status when the vehicle changes.
          setDocs(await getDriverDocuments(profile.id));
        }}
      />

      <DocumentsSection
        docs={docs}
        onSaved={(d) => {
          setDocs(d);
          toast({
            tone: "success",
            title: d.status === "incomplete" ? "Saved" : "Documents submitted",
            body: d.status === "incomplete" ? "Finish the checklist to start driving." : "You can go online now.",
          });
        }}
      />
    </div>
  );
}

function VehicleSection({ onSaved }: { onSaved: (patch: Record<string, unknown>) => Promise<void> }) {
  const { profile } = useAuth();
  const toast = useToast();
  const p = profile!;
  const [type, setType] = useState<VehicleType | null>(p.vehicle_type);
  const [make, setMake] = useState(p.vehicle_make ?? "");
  const [model, setModel] = useState(p.vehicle_model ?? "");
  const [color, setColor] = useState(p.vehicle_color ?? "");
  const [year, setYear] = useState(p.vehicle_year ? String(p.vehicle_year) : "");
  const [seats, setSeats] = useState(p.vehicle_seats ? String(p.vehicle_seats) : "");
  const [plate, setPlate] = useState(p.plate_number ?? "");
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const yearNum = Number(year);
  const yearError = year && (yearNum < 1980 || yearNum > thisYear + 1) ? `Enter a year between 1980 and ${thisYear + 1}` : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (yearError) return;
    setSaving(true);
    try {
      await onSaved({
        vehicle_type: type,
        vehicle_make: make.trim() || null,
        vehicle_model: model.trim() || null,
        vehicle_color: color.trim() || null,
        vehicle_year: year ? yearNum : null,
        vehicle_seats: seats ? Number(seats) : null,
        plate_number: plate.trim().toUpperCase() || null,
      });
      toast({ tone: "success", title: "Vehicle saved" });
    } catch (err) {
      toast({ tone: "error", title: "Could not save vehicle", body: readableError(err) });
    } finally {
      setSaving(false);
    }
  };

  const savePhoto = async (blob: Blob) => {
    setPhotoSaving(true);
    try {
      const url = await uploadPublicImage("vehicles", p.id, blob);
      const old = p.vehicle_photo_url;
      await onSaved({ vehicle_photo_url: url });
      removePublicImage("vehicles", old);
      setPhotoFile(null);
      toast({ tone: "success", title: "Vehicle photo updated" });
    } catch (err) {
      toast({ tone: "error", title: "Could not upload photo", body: readableError(err) });
    } finally {
      setPhotoSaving(false);
    }
  };

  return (
    <section>
      <SectionTitle eyebrow="Step 1" title="Your vehicle" />
      <form onSubmit={submit} className="space-y-5">
        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Vehicle type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {VEHICLE_TYPES.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => {
                  setType(v.value);
                  if (!seats) setSeats(String(v.seats));
                }}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-left text-sm transition",
                  type === v.value ? "border-gold bg-gold/10 text-fg" : "border-line text-muted hover:border-fg/30 hover:text-fg",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Vehicle photo</span>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-elevated">
              {p.vehicle_photo_url ? (
                <img src={p.vehicle_photo_url} alt="Your vehicle" className="h-full w-full object-cover" />
              ) : (
                <Car className="h-8 w-8 text-subtle" />
              )}
            </div>
            <div className="space-y-2">
              <Button type="button" variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                {p.vehicle_photo_url ? "Change photo" : "Add photo"}
              </Button>
              <p className="text-xs text-subtle">A clear photo of the outside, plate visible.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setPhotoFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Make" value={make} onChange={(e) => setMake(e.target.value)} maxLength={40} placeholder="Toyota" required />
          <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={40} placeholder="Corolla" required />
          <Input label="Colour" value={color} onChange={(e) => setColor(e.target.value)} maxLength={30} placeholder="Silver" required />
          <Input
            label="Year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2015"
            error={yearError}
          />
          <Input
            label="Seats for riders"
            inputMode="numeric"
            value={seats}
            onChange={(e) => setSeats(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="4"
          />
          <Input
            label="Plate number"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            maxLength={15}
            placeholder="ABC 123 XY"
            className="uppercase"
            required
          />
        </div>
        <Button type="submit" block loading={saving}>
          Save vehicle
        </Button>
      </form>
      <PhotoEditor
        file={photoFile}
        title="Vehicle photo"
        aspect={4 / 3}
        outputSize={1200}
        saving={photoSaving}
        onCancel={() => setPhotoFile(null)}
        onSave={savePhoto}
      />
    </section>
  );
}

function DocumentsSection({ docs, onSaved }: { docs: DriverDocuments | null; onSaved: (d: DriverDocuments) => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const driverId = profile!.id;
  const [licenseNumber, setLicenseNumber] = useState(docs?.license_number ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(docs?.license_expiry ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(docs?.registration_number ?? "");
  const [paths, setPaths] = useState({
    license_photo_path: docs?.license_photo_path ?? null,
    registration_doc_path: docs?.registration_doc_path ?? null,
    insurance_doc_path: docs?.insurance_doc_path ?? null,
  });
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const expiryError = licenseExpiry && licenseExpiry <= today ? "This licence has expired. Renew it before driving." : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveDriverDocuments(driverId, {
        license_number: licenseNumber.trim().toUpperCase() || null,
        license_expiry: licenseExpiry || null,
        registration_number: registrationNumber.trim().toUpperCase() || null,
        ...paths,
      });
      onSaved(saved);
    } catch (err) {
      toast({ tone: "error", title: "Could not save documents", body: readableError(err) });
    } finally {
      setSaving(false);
    }
  };

  const setPath = (key: keyof typeof paths) => (path: string | null) => {
    removeDriverDocument(paths[key]);
    setPaths((p) => ({ ...p, [key]: path }));
  };

  return (
    <section>
      <SectionTitle eyebrow="Step 2" title="Licence and registration" />
      <p className="-mt-2 mb-5 text-sm text-muted">These stay private. Only you and the RideLink team can see them.</p>
      <form onSubmit={submit} className="space-y-5">
        <Card className="space-y-4 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <IdCard className="h-4 w-4 text-gold" /> Driver's licence
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Licence number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} maxLength={40} className="uppercase" />
            <Input label="Expiry date" type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} error={expiryError} />
          </div>
          <DocUpload driverId={driverId} kind="licence" label="Photo of your licence (front)" path={paths.license_photo_path} onChange={setPath("license_photo_path")} />
        </Card>

        <Card className="space-y-4 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-gold" /> Vehicle papers
          </p>
          <Input
            label="Vehicle registration number"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            maxLength={40}
            className="uppercase"
          />
          <DocUpload driverId={driverId} kind="registration" label="Vehicle registration document" path={paths.registration_doc_path} onChange={setPath("registration_doc_path")} />
          <DocUpload driverId={driverId} kind="insurance" label="Insurance certificate (optional)" path={paths.insurance_doc_path} onChange={setPath("insurance_doc_path")} />
        </Card>

        <Button type="submit" variant="gold" size="lg" block loading={saving} disabled={Boolean(expiryError)}>
          Save and submit
        </Button>
      </form>
    </section>
  );
}

function DocUpload({
  driverId,
  kind,
  label,
  path,
  onChange,
}: {
  driverId: string;
  kind: string;
  label: string;
  path: string | null;
  onChange: (path: string | null) => void;
}) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadDriverDocument(driverId, kind, file));
    } catch (err) {
      toast({ tone: "error", title: "Upload failed", body: readableError(err) });
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    if (!path) return;
    try {
      window.open(await documentUrl(path), "_blank", "noopener");
    } catch (err) {
      toast({ tone: "error", title: "Could not open file", body: readableError(err) });
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", path ? "bg-success/15 text-success" : "bg-fg/5 text-subtle")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : path ? <CheckCircle2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-subtle">{path ? "Uploaded" : "Photo or PDF, up to 5 MB"}</p>
      </div>
      {path && (
        <button type="button" onClick={view} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted hover:text-fg">
          View <ExternalLink className="h-3 w-3" />
        </button>
      )}
      <Button type="button" size="sm" variant="secondary" onClick={() => ref.current?.click()} disabled={busy}>
        {path ? "Replace" : "Upload"}
      </Button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={pick} />
    </div>
  );
}
