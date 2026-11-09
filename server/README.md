# Barber's Hub API

Express + TypeScript + PostgreSQL REST API behind the Deepcuts Hair Studio storefront and admin
dashboard.

## Quick start (local)

1. Create an empty Postgres database, e.g. `createdb barbers_hub`.
2. Configure and start the API:
   ```sh
   cd server
   cp .env.example .env   # set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
   npm install
   npm run migrate        # creates/updates the tables and default settings
   npm run seed           # creates (or promotes) the admin account from ADMIN_EMAIL
   npm run dev            # http://localhost:4000
   ```
3. In the project root, set `VITE_API_URL=http://localhost:4000` in `.env` and run the site with
   `npm run dev`. The site's URL must be listed in `CORS_ORIGIN`.

`GET /health` reports whether the API can reach the database.

## Tests

```sh
npm test
```

Runs the API test suite against an in-memory Postgres (PGlite), so no database setup is needed.
It covers auth and session revocation, booking hours and capacity, orders and stock, payments,
reviews, enquiries, admin, settings, and uploads. The browser test for the whole site lives in
`../e2e` (`npm run test:e2e` from the project root).

## Production

The included `Dockerfile` builds the API and, on start, applies migrations, ensures the admin
account exists, and runs the server. `../render.yaml` deploys it to Render together with a
Postgres database and a persistent disk for uploads.

Without Docker:

```sh
npm ci && npm run build
npm run migrate:prod && npm run seed:prod
npm start
```

- Uploaded images are written to `UPLOAD_DIR`, which must survive restarts and redeploys (a
  persistent disk or volume). Serverless hosts such as Vercel functions lose files.
- Use any managed Postgres. Set `DATABASE_SSL=true` when the provider requires TLS.
- Set `NODE_ENV=production`, a long random `JWT_SECRET`, `PUBLIC_API_URL` (this API's public
  URL), `APP_URL` (the storefront URL, used in emails), and `CORS_ORIGIN`.
- On the storefront's host (e.g. Vercel), set `VITE_API_URL` to this API's URL and redeploy.

### Email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. For Gmail, use
`smtp.gmail.com`, port 587, and an [app password](https://myaccount.google.com/apppasswords).
Without SMTP, every email is printed to the server log instead. The API sends:

- password reset links;
- booking received (customer + studio) and booking confirmed/cancelled/rejected/completed;
- order received with payment instructions (customer + studio), order status changes, and an
  alert to the studio when a customer submits a payment reference.

Studio alerts go to `STUDIO_NOTIFY_EMAIL`, or the business email in Admin → Settings.

### Google sign-in (optional)

Create an OAuth client of type "Web application" in the Google Cloud console, add
`<PUBLIC_API_URL>/api/auth/google/callback` as an authorised redirect URI, and set
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The "Continue with Google" button appears on the
sign-in page once both are set. A Google login with the same verified email as an existing
account signs into that account.

## Endpoints

All routes are under `/api`. Authenticated routes need `Authorization: Bearer <token>`. Errors
are returned as `{ "error": "..." }`.

| Area | Method & path | Access |
| --- | --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login` | public (rate limited) |
| | `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout-everywhere` | signed in |
| | `POST /auth/forgot-password`, `POST /auth/reset-password` | public (rate limited) |
| | `GET /auth/providers`, `GET /auth/google`, `GET /auth/google/callback` | public |
| Catalogue | `GET /settings`, `/services`, `/services/:slug`, `/service-categories` | public |
| | `GET /products`, `/products/:slug`, `/product-categories`, `/barbers` | public |
| Reviews | `GET /reviews?product_id=` or `?service_id=` (approved only) | public |
| | `POST /reviews` (held as pending until approved) | signed in |
| Bookings | `GET /bookings/availability?date=&service_id=&barber_id=` | public |
| | `POST /bookings` | public or signed in |
| Orders | `POST /orders` | signed in |
| Contact | `POST /contact` | public (rate limited) |
| My account | `GET/PATCH /me/profile`, `POST /me/deactivate` | signed in |
| | `GET /me/bookings`, `POST /me/bookings/:id/cancel` | signed in |
| | `GET /me/orders`, `GET /me/orders/:id`, `POST /me/orders/:id/payment-reference` | signed in |
| | `GET /me/reviews`, `DELETE /me/reviews/:id` | signed in |
| Admin | `GET /admin/stats` | admin |
| | `GET /admin/bookings`, `PATCH/DELETE /admin/bookings/:id` | admin |
| | `GET /admin/orders`, `GET /admin/orders/:id/items`, `PATCH /admin/orders/:id` | admin |
| | `GET /admin/customers`, `PATCH /admin/customers/:id`, `POST /admin/customers/:id/password-reset` | admin |
| | `GET /admin/reviews`, `PATCH/DELETE /admin/reviews/:id` | admin |
| | `GET /admin/messages`, `PATCH/DELETE /admin/messages/:id` | admin |
| | `GET/POST /admin/services`, `PUT/DELETE /admin/services/:id` | admin |
| | `GET/POST /admin/products`, `PUT/DELETE /admin/products/:id` | admin |
| | `GET/POST /admin/categories/:type`, `PUT/DELETE /admin/categories/:type/:id` (`service` or `product`) | admin |
| | `GET/POST /admin/barbers`, `PUT/DELETE /admin/barbers/:id` | admin |
| | `PUT /admin/settings` | admin |
| | `POST /admin/uploads` (multipart: `folder`, then `file`) | admin |

## Business rules

- **Sessions:** changing or resetting a password, deactivating an account, or an admin
  suspending it signs that account out on every device.
- **Bookings:** only within the opening hours set in Admin → Settings (studio time zone,
  `TIMEZONE`), never in the past, and a service must finish by closing time. A slot takes at most
  one pending/confirmed booking per active barber, and a chosen barber can't be double-booked.
  Concurrent requests for a slot are serialised with a Postgres advisory lock. Admins can still
  move bookings to any time.
- **Orders:** names, prices, and the delivery fee come from the database, never the browser.
  Stock is reserved in the same transaction. Cancelling returns stock; reopening a cancelled
  order needs the stock to still be there.
- **Payments:** mobile money and bank transfer are manual. Checkout shows the details from
  Admin → Settings, the customer submits their transaction ID on the order page, and staff
  verify it and mark the order paid. There's no payment gateway.
- **Suspended accounts** can sign in and view their history, but can't book, order, or review.
- Admins can't remove their own admin role or suspend themselves.
- **Uploads:** images no record refers to (replaced or deleted ones) are removed automatically
  an hour after upload, checked every 6 hours.
