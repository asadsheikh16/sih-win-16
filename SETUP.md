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

Open Supabase Dashboard → SQL Editor and run `supabase/migrations/0001_niramay.sql`. It creates the NIRAMAY tables, indexes, RLS policies, helper functions, and Storage buckets/policies.

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
