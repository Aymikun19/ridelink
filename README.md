# RideLink

A modular ride-hailing app for customers and drivers, without a payment gateway (payment is settled between rider and driver).

**Stack:** React 19, TypeScript, Tailwind CSS v4, Vite · Node.js + Express API (runs as a Vercel serverless function) · Supabase (Postgres, Auth sessions, Realtime, Storage) · Resend (email OTP and ride emails) · Leaflet + OpenStreetMap.

## Features

| Area | What it does |
| --- | --- |
| Sign in | Passwordless email OTP sent via Resend. Codes are HMAC-hashed, expire in 10 min, single use, max 5 attempts, 60 s resend cooldown, 5 sends per hour. A verified code is exchanged for a normal Supabase session. |
| Roles | Customer or driver, chosen once at onboarding. Drivers add vehicle and plate. |
| Booking | Pickup from GPS, address search or a tap on the map. Route preview with distance and time. Optional note for the driver. |
| Driver alerts | Online/offline toggle. New requests within 15 km open a popup with a 30 s countdown, a chime, vibration and a system notification when the tab is in the background. An open-requests list is also shown. |
| Live trip | Status flow: requested, accepted, arrived, on trip, completed. Customer sees the driver's car move on the map with a live ETA. Driver gets a one-tap Google Maps navigation link. |
| Messaging | Per-ride chat with read receipts, voice notes (record, preview, send), and one-tap quick replies. |
| Templates | Users create their own text templates and record reusable voice-note templates. Built-in quick replies ship per role. |
| Popups | In-app toasts for new messages and ride status changes anywhere in the app, plus browser notifications. |
| Email | Customer gets an email when a driver accepts, arrives and completes. |
| Other | Cancel with reasons (a driver cancelling puts the ride back in the pool), rating and feedback, trip history with filters, profile editing, light and dark themes, mobile layout with bottom navigation. |

All numbers shown in the app (trip counts, distances, times) come from the database or routing service. There is no seeded or placeholder data apart from the built-in quick-reply templates.

## Project structure

```
api/index.ts                 Vercel entry, mounts the Express app
server/
  app.ts                     Express app, routes, error handling
  routes/auth.ts             POST /api/auth/request-otp, /api/auth/verify-otp
  routes/notify.ts           POST /api/notify/ride/:id (ride emails, driver only)
  lib/                       env, Supabase admin client, Resend emails, auth middleware
  dev.ts                     Local API server on :3001
supabase/migrations/0001_init.sql   Tables, RLS policies, ride functions, storage bucket, realtime
src/
  lib/                       Supabase client, API client, geo (search, routing), sound, notifications
  providers/                 Auth, theme, toasts
  components/ui, layout/     Design system, app shell, global alerts, route guards
  features/
    auth/                    Login (OTP), onboarding
    map/                     MapView, markers, place search, geolocation hook
    rides/                   Customer home, ride page, history, rating, data access
    driver/                  Driver provider (presence, location, request popup), dashboard
    chat/                    Chat panel, recorder, audio player, templates page
    profile/                 Profile form and page
    landing/                 Public landing page
```

## Security model

Every table has row level security. Clients cannot update rides directly; all state changes go through `security definer` Postgres functions that check who is calling and enforce valid transitions (`accept_ride`, `advance_ride`, `cancel_ride`, `rate_ride`, `decline_ride`). Accepting is atomic, so two drivers cannot take the same ride. Unique partial indexes allow only one active ride per customer and per driver. Messages and voice notes are only readable by the two people on that ride; voice templates only by their owner. The service role key is only used on the server.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql` and run it. It creates the tables, policies, functions, the private `voice-notes` bucket and enables realtime on `rides`, `messages` and `driver_status`.
3. Copy the project URL, `anon` key and `service_role` key from **Project Settings > API**.

You do not need to configure Supabase email templates: codes are sent by this app through Resend.

### 2. Resend
1. Create an API key at resend.com.
2. Verify a sending domain and use an address on it for `RESEND_FROM`. Until a domain is verified, Resend only delivers to your own account email.

### 3. Run locally
```bash
npm install
cp .env.example .env      # fill in the values
npm run dev               # web on http://localhost:5173, API on :3001 (proxied at /api)
```
Location, microphone and notifications need `localhost` or HTTPS. To test both roles at once, use two browsers (or a private window) with two different emails.

### 4. Deploy to Vercel
1. Push the repo to GitHub and import it in Vercel. The included `vercel.json` builds the Vite app and serves `api/index.ts` for every `/api/*` route.
2. Add all variables from `.env.example` in **Settings > Environment Variables**, with `APP_URL` set to your Vercel URL.
3. Deploy.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Public anon key |
| `SUPABASE_URL` | server | Same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Service role key, server only |
| `RESEND_API_KEY` | server | Resend API key |
| `RESEND_FROM` | server | Sender, e.g. `RideLink <no-reply@yourdomain.com>` |
| `OTP_SECRET` | server | Random secret for hashing codes (`openssl rand -hex 32`) |
| `APP_URL` | server | Public app URL, used for email links and CORS |
| `VITE_GEOCODE_COUNTRIES` | browser, optional | Limit address search, e.g. `ng` |
| `VITE_NOMINATIM_URL`, `VITE_OSRM_URL` | browser, optional | Self-hosted geocoding / routing |

## Maps and routing in production

Address search uses OpenStreetMap Nominatim, routing uses the public OSRM server, and tiles come from CARTO. They are free and keyless, which is ideal for development and small pilots, but the public servers have fair-use limits (Nominatim allows about 1 request per second). For real traffic, point `VITE_NOMINATIM_URL` / `VITE_OSRM_URL` at your own instances or swap `src/lib/geo.ts` for a paid provider such as Mapbox or Google. If routing is unreachable the app falls back to straight-line distance instead of failing.

## Configuration

`src/lib/config.ts` holds the request radius (15 km), popup countdown (30 s), location write throttling and maximum voice-note length (2 min).

## Testing notes

The build was verified with a two-browser end-to-end run (customer and driver) against local Supabase Auth and PostgREST: sign-up by OTP, onboarding for both roles, booking by map tap, driver popup and accept, live driver location, text messages, quick replies, voice notes, read receipts, the full status flow, rating, custom text and voice templates, history, mobile layout and light theme. The database policies and ride functions were also tested directly, including blocked access for an unrelated user.
