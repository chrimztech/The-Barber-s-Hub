# The Barber's Hub

Website and admin dashboard for Deepcuts Hair Studio: service bookings, a grooming-equipment
shop, customer accounts, reviews, and enquiries.

| Folder | What it is |
| --- | --- |
| `src/` | The website: React + TanStack Start + Tailwind |
| `server/` | The API: Express + TypeScript + PostgreSQL ([server/README.md](server/README.md)) |
| `e2e/` | Browser test of the whole site |

## Running it locally

1. Set up the API. See [server/README.md](server/README.md) for the database and `server/.env`.
2. Install the website dependencies once with `npm install`, and set
   `VITE_API_URL=http://localhost:4000` in `.env` (see `.env.example`).
3. Start both, in two terminals:
   ```sh
   npm run api:dev   # API on http://localhost:4000
   npm run dev       # website on http://localhost:8080 (add -- --port 8095 if 8080 is taken)
   ```
4. Sign in with the admin account from `server/.env` and open **Admin dashboard** to add
   categories, barbers, services, and products.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` | Website dev server / production build |
| `npm run api:dev`, `api:migrate`, `api:seed` | Run the API, apply migrations, create the admin |
| `npm run api:test` | API test suite (in-memory database, no setup needed) |
| `npm run test:e2e` | Browser test against the running site and API; needs `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and `APP_URL` if not on port 8080 |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Deploying

- **API:** `render.yaml` deploys the API (Docker), a Postgres database, and a persistent disk
  for uploads to Render. Any host that runs Docker or Node 20+ with a persistent disk works.
- **Website:** Vercel (the build targets it automatically). Set `VITE_API_URL` to the API's
  public URL, and add the website's URL to the API's `CORS_ORIGIN`.

If the project folder name contains an apostrophe (like `The Barber's Hub`), `npm run build`
fails locally because the server bundler doesn't escape it in import paths. Builds on Vercel are
unaffected. To build locally, use a folder without one, or map it to a drive letter
(`subst B: "F:\The Barber's Hub"`, then build from `B:\`).
