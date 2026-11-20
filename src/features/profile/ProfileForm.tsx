import { useState, type FormEvent } from "react";
import { Car, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Profile, Role } from "@/types";

export interface ProfileFields {
  full_name: string;
  phone: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  plate_number: string;
}

export function toFields(p: Profile | null): ProfileFields {
  return {
    full_name: p?.full_name ?? "",
    phone: p?.phone ?? "",
    vehicle_make: p?.vehicle_make ?? "",
    vehicle_model: p?.vehicle_model ?? "",
    vehicle_color: p?.vehicle_color ?? "",
    plate_number: p?.plate_number ?? "",
  };
}

export function cleanFields(f: ProfileFields, role: Role) {
  const trim = (s: string) => s.trim() || null;
  return {
    full_name: trim(f.full_name),
    phone: trim(f.phone),
    ...(role === "driver"
      ? {
          vehicle_make: trim(f.vehicle_make),
          vehicle_model: trim(f.vehicle_model),
          vehicle_color: trim(f.vehicle_color),
          plate_number: f.plate_number.trim().toUpperCase() || null,
        }
      : {}),
  };
}

interface Props {
  role: Role;
  initial: ProfileFields;
  submitLabel: string;
  /** Vehicle fields are edited on the driver documents page instead */
  hideVehicle?: boolean;
  onSubmit: (fields: ProfileFields) => Promise<void>;
}

export function ProfileForm({ role, initial, submitLabel, hideVehicle, onSubmit }: Props) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ProfileFields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(f);
    } finally {
      setSaving(false);
    }
  };

  const driver = role === "driver";
  const showVehicle = driver && !hideVehicle;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Full name" value={f.full_name} onChange={set("full_name")} required maxLength={80} leading={<User className="h-4 w-4" />} placeholder="Your name" autoComplete="name" />
      <Input
        label="Phone number"
        type="tel"
        value={f.phone}
        onChange={set("phone")}
        maxLength={20}
        leading={<Phone className="h-4 w-4" />}
        placeholder="+234 800 000 0000"
        autoComplete="tel"
        hint={driver ? "Customers can call you during a ride." : "Your driver can call you during a ride."}
        required={driver}
      />
      {showVehicle && (
        <div className="space-y-4 rounded-3xl border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Car className="h-4 w-4 text-gold" /> Vehicle
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Make" value={f.vehicle_make} onChange={set("vehicle_make")} required maxLength={40} placeholder="Toyota" />
            <Input label="Model" value={f.vehicle_model} onChange={set("vehicle_model")} required maxLength={40} placeholder="Corolla" />
            <Input label="Colour" value={f.vehicle_color} onChange={set("vehicle_color")} required maxLength={30} placeholder="Silver" />
            <Input label="Plate number" value={f.plate_number} onChange={set("plate_number")} required maxLength={15} placeholder="ABC 123 XY" className="uppercase" />
          </div>
        </div>
      )}
      <Button type="submit" size="lg" block loading={saving}>
        {submitLabel}
      </Button>
    </form>
  );
}
