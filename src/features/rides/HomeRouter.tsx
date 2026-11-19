import { useAuth } from "@/providers/AuthProvider";
import { DriverHome } from "@/features/driver/DriverHome";
import { CustomerHome } from "./CustomerHome";

export function HomeRouter() {
  const { profile } = useAuth();
  return profile?.role === "driver" ? <DriverHome /> : <CustomerHome />;
}
