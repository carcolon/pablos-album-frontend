# Pablo's Album Frontend

React + TypeScript viewer and Admin Studio for Pablo's private family album.

The app uses the backend's native cookie login. Requests include credentials, and unsafe requests fetch/send the backend CSRF token with `X-CSRF-TOKEN`.

## Run

```powershell
npm install
npm run dev
```

The development server opens at `http://localhost:5173` and proxies `/api` to `http://localhost:5152`.

For Render, set:

```text
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

Local development can keep this empty and use the Vite proxy, or copy `.env.example` to `.env.local`.

Suggested Render frontend settings:

- Service type: Static Site
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL=https://your-backend-service.onrender.com`

## Verify

```powershell
npm run build
```

## Included

- Page flip album viewer.
- Editorial photo and letter layouts.
- Native login/create-owner screen.
- Admin Studio prototype for layouts, timeline, security indicators, invitations and Drive uploads.
- TanStack Query, Zustand, React Hook Form, Zod, GSAP and lucide icons.
