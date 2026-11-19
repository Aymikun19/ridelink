export const APP_NAME = "RideLink";

/** Drivers see requests whose pickup is within this radius. */
export const DRIVER_REQUEST_RADIUS_KM = 15;

/** How long a driver has to respond to the incoming request popup. */
export const REQUEST_POPUP_SECONDS = 30;

/** Driver location is written at most this often (ms) unless they moved far. */
export const LOCATION_WRITE_INTERVAL_MS = 8000;
export const LOCATION_WRITE_MIN_METERS = 25;

export const MAX_VOICE_NOTE_MS = 120_000;

export const VOICE_BUCKET = "voice-notes";
