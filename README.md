# LioranDB Studio (Template)

Next.js (App Router) template for the LioranDB Studio UI. Uses `@liorandb/driver` for all database + admin operations (CRUD, aggregates, indexes, maintenance, docs, users).

## Dev

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production deployment

Studio encrypts the connection URI stored in each session. Before deploying, add
`STUDIO_SESSION_SECRET` as a **server-only** environment variable in the hosting
provider's production environment. It must be a unique random value of at least
16 characters (32+ is recommended); do not use a `NEXT_PUBLIC_` prefix and do
not commit it to the repository.

Generate a suitable value locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Then set the generated value as `STUDIO_SESSION_SECRET` in the host dashboard
and redeploy. Studio validates this at production build time, preventing a
deployment that would otherwise fail only when a user connects.

The current session store is filesystem-based. For a hosted multi-instance
deployment, set `STUDIO_SESSION_DIR` to a mounted, persistent shared directory
so sessions survive requests and restarts. Serverless hosts without a shared
filesystem need a shared database/Redis session-store implementation instead.

## Login modes

- Credentials: `http(s)://host:port` + username/password
- URI: `lioran://user:pass@host:port` or `liorandb://dbUser:dbPass@host:port/database`
- Token: `http(s)://host:port` + JWT token

## Query editor

- **Find** expects a JSON object filter (example: `{"status":"active"}`)
- **Aggregate** expects a JSON array pipeline (example: `[{ "$match": {} }, { "$limit": 100 }]`)
