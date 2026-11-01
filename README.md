# Bloggerbytes

Where bloggers can write their own blogs and post them on Bloggerbytes.

**Highlights:** rich-text writing studio (headings, lists, quotes, code, links; keyboard and Markdown-style shortcuts) ·
drafts that save themselves · scheduled publishing · edit, unpublish or delete any story · display names ·
story reader with reading progress, likes and sharing · Explore with instant search, topic chips and sorting ·
writer leaderboard · Image Pool lightbox · dashboard with Published / Scheduled / Drafts · Ctrl/⌘+K command palette ·
light/dark themes · Flutter app for Android and iOS with the same features.

| Part | Stack | Folder |
| --- | --- | --- |
| Frontend | Angular 22 (standalone components, signals, zoneless), custom design system on Bootstrap 5.3 grid/utilities, Material Symbols | [`frontend/`](frontend/) |
| Backend | Node.js, Express 5, Mongoose 9 / MongoDB, express-session | [`backend/`](backend/) |
| Mobile app | Flutter 3.47 (Android, iOS, web), go_router — same features as the web app, same API | [`mobile/`](mobile/) |

## Requirements

- Node.js 22.22+ (or 24.15+ / 26+) — required by Angular CLI 22
- No MongoDB install needed: `npm run dev` runs a real, persistent local MongoDB (data in `backend/.data/`). For production use your own MongoDB or Atlas via `MONGODB_URI`.

## Setup

```bash
npm run install:all                 # installs backend/ and frontend/ dependencies
cp backend/.env.example backend/.env   # optional for dev, required for real data
```

## Run

| Command (from the repo root) | What it does |
| --- | --- |
| `npm run dev` | Local MongoDB (:27017, persistent) + backend (:3000) + Angular dev server (:4200). Open http://localhost:4200 |
| `npm run dev -- --memory` | Same, with a throwaway in-memory database |
| `npm run dev -- --no-db` | Don't start MongoDB; the backend uses `MONGODB_URI` from `backend/.env` (e.g. Atlas) |
| `npm --prefix backend run db` | Only the persistent local MongoDB |
| `npm run dev:backend` / `npm run dev:frontend` | Run either side on its own (backend expects MongoDB to be running) |
| `npm --prefix frontend run images` | After adding pictures to the Image Pool: builds web-sized copies + the manifest |
| `npm run build` | Production build of the frontend into `frontend/dist/frontend/browser` |
| `npm start` | Backend serving the API **and** the built frontend on one port (http://localhost:3000) |
| `npm test` | Backend API tests (in-memory MongoDB) |
| `npm --prefix backend run test:coverage` | Same, failing below 100% line/branch/function coverage |
| `npm --prefix frontend run test:coverage` | Web app unit tests (Vitest), failing below 100% coverage |

Custom ports: `BACKEND_PORT=3001 FRONTEND_PORT=4201 MONGO_PORT=27018 npm run dev`.

## How the two sides are wired

- **Development:** `ng serve` (port 4200) proxies API paths to the backend (see [`frontend/proxy.conf.mjs`](frontend/proxy.conf.mjs)), so the browser only talks to one origin and the session cookie just works.
- **Production:** `npm run build`, then `npm start`. The backend serves the built Angular app as static files, next to the API.
- **Separate hosting (optional):** host the frontend elsewhere, set `apiBaseUrl` in [`frontend/src/environments/environment.ts`](frontend/src/environments/environment.ts), and set `CORS_ORIGIN` in `backend/.env`.

Frontend routes use hash URLs (`/#/blog`, `/#/cate`) so they never clash with API paths such as `/cate`.

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/blogs` | - | Featured blogs (static JSON) |
| GET | `/BAdd` | - | All published blogs, newest first |
| POST | `/adduser` | - | Sign up `{username, name, email, password}` and start a session (`name` = display name, 1-60 chars) |
| POST | `/loginuser` | - | Sign in `{username, password}` |
| POST | `/logout` | - | End the session |
| GET | `/myacc` | yes | Current user and all their blogs, drafts and scheduled ones included |
| PATCH | `/myacc` | yes | Change your display name `{name}` |
| POST | `/addblog` | yes | `{title, cate, img, blogp1, blogp2, status?, publishAt?}`: publish now, schedule (future `publishAt`) or save a draft (`status: "draft"`, may be incomplete). `blogp2` is HTML (sanitized); `img` is an Image Pool name such as `img5` |
| GET | `/posts/:id` | - | One story (counts a view); featured ones are `featured-<no>`; drafts and scheduled stories only for their author |
| PATCH | `/posts/:id` | author | Edit content, publish, move back to drafts or reschedule |
| POST | `/posts/:id/like` | yes | Toggle your like → `{likes, liked}` |
| DELETE | `/posts/:id` | author | Delete your own story |
| GET | `/stats` | - | Site totals: blogs, writers, categories, likes |
| GET | `/leaderboard` | - | Top 10 writers by likes, posts, views |
| POST | `/subscribe` | - | Newsletter sign-up `{email}` |
| GET | `/health` | - | Health check |

## Mobile app

A Flutter port of the web app in [`mobile/`](mobile/) — see [`mobile/README.md`](mobile/README.md). Quick start with the backend running (`npm run dev`):

```bash
cd mobile
flutter run                                              # Android emulator reaches the API at 10.0.2.2:3000
flutter run --dart-define=API_BASE_URL=https://api.example.com   # any other API
```

## Continuous integration

GitHub Actions run on every push and pull request that touches the relevant folders:

- [`api.yml`](.github/workflows/api.yml): backend tests on Node 22 and 24 with a 100% coverage gate, a smoke test that boots the server, then packages the API (`bloggerbytes-api.tar.gz` artifact).
- [`frontend.yml`](.github/workflows/frontend.yml): web app unit tests with a 100% coverage gate, then the production build (artifact).
- [`mobile.yml`](.github/workflows/mobile.yml): Flutter format/analyze/tests with a 100% line-coverage gate, a contract test of the app against the real API, then release APK and web builds (artifacts). Set the repository variable `API_BASE_URL` to bake your deployed API into those builds.

## Configuration (`backend/.env`)

See [`backend/.env.example`](backend/.env.example): `PORT`, `MONGODB_URI`, `SESSION_SECRET`, `NODE_ENV`, optional SMTP settings for the welcome email, and optional `FRONTEND_DIST`, `IMAGE_DIR`, `CORS_ORIGIN`.
