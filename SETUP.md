# NIRAMAY Supabase Setup

This project uses your Supabase project for PostgreSQL, Auth, Storage, and Row Level Security. The existing JSON demo remains untouched as a rollback path until this migration is verified.

## 1. Create the project

Create or select your own project at [supabase.com](https://supabase.com). In Project Settings → API, copy:

- Project URL → `VITE_SUPABASE_URL` and `SUPABASE_URL`
- Publishable/anon key → `VITE_SUPABASE_ANON_KEY`

Never put the `service_role` key in React or any `VITE_` variable. If server-side migration scripts are used, place it only in the local `.env` as `SUPABASE_SERVICE_ROLE_KEY` and never commit that file.

## 2. Configure local environment

Copy `.env.example` to `.env` and replace only the placeholder Supabase URL and publishable/anon key with values from your project. Keep `.env` private.

## 3. Create database objects

Open Supabase Dashboard → SQL Editor and run `supabase/migrations/0001_niramay.sql`, then `0002_fix_patient_rls.sql`, `0003_departments_staff_read.sql`, and `0004_seed_demo_staff_roles.sql`. The role migration only assigns roles to Auth users that already exist; it does not create demo patients. The second migration fixes authenticated patient queries without exposing `auth.users` to the client.

## 4. Configure Auth

Enable Email authentication in Authentication → Providers. Create demo users through the Supabase Auth dashboard or the server-only seed process. Do not store passwords in the frontend or in the JSON demo data.

## 5. Run locally

```text
npm.cmd install
npm.cmd run build:web
npm.cmd run build:api
npm.cmd run web:dev
```

The legacy `npm.cmd start` command remains available for rollback. Government identity, scheme, OCR, voice, and AI connections are explicitly DEMO/MOCK until an authorized provider is configured.

## 6. Live deployment for the SIH demo

This repository is configured for a small two-service deployment:

- **Frontend:** Vercel serves the Vite build from `dist/web` and rewrites every SPA route to `index.html`.
- **API:** Render runs the compiled Express service from `apps/api/dist/server.js`.
- **Data/Auth/Storage:** Your existing Supabase project remains the only application backend.

### Deploy the API first on Render

1. Create a Render **Web Service** from this repository.
2. Use the included `render.yaml`, or set:
   - Build command: `npm ci && npm run build:api`
   - Start command: `node apps/api/dist/server.js`
   - Health path: `/api/v1/health`
3. Add these Render environment variables:
   - `SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase publishable/anon key
   - `FRONTEND_ORIGIN` = the final Vercel origin, for example `https://aarogyavaani-demo.vercel.app`
4. Copy the deployed Render URL, for example `https://aarogyavaani-api.onrender.com`.

### Deploy the frontend on Vercel

1. Import the same repository into Vercel.
2. Keep the repository root as the project root. The included `vercel.json` sets the build/output and SPA fallback.
3. Add these Vercel environment variables for **Production**:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase publishable/anon key
   - `VITE_API_URL` = the deployed Render API URL, with no trailing slash
4. Deploy and copy the final Vercel URL.
5. If the Vercel URL differs from the value first entered in Render, update Render `FRONTEND_ORIGIN` and redeploy the API.

### Supabase Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: the final Vercel URL
- Additional Redirect URLs: the final Vercel URL and `https://your-vercel-domain.vercel.app/**`
- Keep local URLs only if local testing is still required, such as `http://localhost:5176/**`.

Do not add the Render API URL as an Auth redirect URL. Do not add service-role credentials to Vercel or the browser.

### Live smoke test

1. Open the Vercel URL and sign in with the existing Supabase Auth account.
2. Refresh `/dashboard`, `/patient`, `/patients`, `/verify`, and `/verify/<secure_ref>` directly.
3. Confirm dashboard data loads from the Render API and Supabase.
4. Confirm patient QR generation uses the Vercel origin, not localhost.
5. Verify the QR flow, case card, print view, OPD/queue, and consultation using authorized real records only.
6. Check Render `/api/v1/health`, browser Network, and browser Console.
