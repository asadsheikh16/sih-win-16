# NIRAMAY — Digital Government Health Network

SIH demonstration application for a state-government hospital workflow. All people, records and identifiers in this repository are fictional **DEMO DATA**.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` if you need to change the port.
3. Run `npm.cmd start` from this folder.
4. Open `http://localhost:3000`.

No package install is necessary: the server uses Node's standard library and writes persistent demo data to `data/niramay-demo.json` at first start. Reset the demo database with `npm.cmd run seed`.

## Phase 2 architecture preview

The legacy demo remains the safest runnable path while the migration is validated. The target architecture is scaffolded in `apps/web`, `apps/api`, `prisma`, and `packages/shared`:

1. Start PostgreSQL with `docker compose up -d postgres`.
2. Install dependencies with `npm.cmd install`.
3. Generate the Prisma client with `npm.cmd run prisma:generate`.
4. Apply the schema with `npx prisma migrate dev --name init` and seed with `npm.cmd run prisma:seed`.
5. Run the API with `npm.cmd run api:dev` and the React app with `npm.cmd run web:dev`.

The React/API migration is marked demo-only and does not claim live government integrations. The original `npm.cmd start` path remains available until PostgreSQL-backed workflows are verified.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Doctor | doctor@niramay.demo | Demo@123 |
| Registration operator | operator@niramay.demo | Demo@123 |
| Pharmacist | pharmacy@niramay.demo | Demo@123 |
| Hospital administrator | admin@niramay.demo | Demo@123 |

## API

All protected endpoints expect `Authorization: Bearer <token>` from `POST /api/auth/login`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Role-aware demo login |
| GET | `/api/dashboard` | Command-centre counts and queue |
| GET/POST | `/api/patients` | Search/create patient records |
| GET | `/api/patients/:identifier` | Longitudinal patient profile |
| GET/POST | `/api/queue` | Read/create OPD tokens |
| POST | `/api/consultations` | Close clinical consultation |
| GET/POST | `/api/prescriptions` | Pharmacy-ready prescriptions |
| POST | `/api/prescriptions/:id/dispense` | Dispense and issue receipt |
| GET | `/api/audit-logs` | Admin audit trail |

## Architecture and security

The demo data model includes facilities, users, patients, queue tokens, consultations, investigations, prescriptions, and audit logs. The UI models State → District → Facility scope. Production deployment should swap JSON persistence for PostgreSQL with encrypted managed storage, use a vetted identity provider, hashed passwords, TLS, signed QR references, rate-limited OTP delivery, and immutable central audit logging. Government scheme integrations remain mock adapters in this demo; no government API is impersonated.
