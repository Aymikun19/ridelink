/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_NOMINATIM_URL?: string;
  readonly VITE_OSRM_URL?: string;
  readonly VITE_GEOCODE_COUNTRIES?: string;
  readonly VITE_TILE_URL?: string;
  readonly VITE_TILE_URL_DARK?: string;
  readonly VITE_TILE_ATTRIBUTION?: string;
  readonly VITE_SATELLITE_URL?: string;
  readonly VITE_SATELLITE_ATTRIBUTION?: string;
}
