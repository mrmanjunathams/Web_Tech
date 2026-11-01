# CLAUDE.md

Reference for working in this repo. Bloggerbytes is a blogging site: users sign up, write stories with a cover picture from a fixed "Image Pool", and readers like, search and explore them.

## Layout

```
backend/              Express 5 + Mongoose 9 API (CommonJS, plain JS, no build step)
  src/app.js          createApp(): all routes, sessions, static serving of the built frontend
  src/models.js       User (scrypt password hash), Blog (+likedBy, views), Subscriber, serializeBlog()
  src/index.js        start(): connect MongoDB, seed blogs, MongoStore sessions, listen
  src/local-db.js     persistent local MongoDB (data in backend/.data/db) — no MongoDB install needed
  src/dev-memory.js   start() against a throwaway in-memory MongoDB
  src/mailer.js       optional welcome email (no-op unless SMTP_USER/SMTP_PASS set)
  data/               blogs.json (featured, GET /blogs), seed-blogs.json (seeded into an empty DB)
  test/api.test.js    node:test + supertest + in-memory MongoDB
frontend/             Angular 22 (standalone components, signals, zoneless)
  src/app/app.*       shell: glass navbar, account menu, mobile sheet, footer, palette, toasts, confirm dialog
  src/app/core/       Auth, Posts (API calls), Theme, Toast, Confirm services; authGuard; apiInterceptor; api.ts helpers
  src/app/pages/      one lazy-loaded component per route (post.ts = story reader)
  src/app/shared/     PostCard, Avatar, CommandPalette, Newsletter, AuthArt, ConfirmDialog, Toasts, effects.ts (Reveal/Tilt/CountUp)
  src/styles.css      the whole design system ("Aurora Editorial"): tokens, light/dark, components, pages
  public/picyourpic/  Image Pool originals + opt/ (web-sized .webp) + manifest.json
  scripts/            optimize-images.mjs (npm run images), check-icons.mjs (runs before build)
  proxy.conf.mjs      ng serve -> backend proxy (BACKEND_PORT, default 3000)
mobile/               Flutter app (Android/iOS/web): port of every frontend page, same API — see mobile/README.md
  lib/src/api/        ApiClient (keeps the bb.sid cookie on mobile), models, PostsApi (port of core/posts.ts)
  lib/src/ui/         shell (app bar, drawer, bottom nav), screens/ (one per web route), widgets/
  lib/src/router.dart go_router with the web's paths (/cate?q=, /post/:id, /writeblog?img=) + auth guard
  assets/picyourpic/  copy of frontend/public/picyourpic/{manifest.json,opt/} (CI checks they match)
  test/               unit + widget tests (fake API in test/support/), backend_contract_test.dart (live API)
scripts/dev.js        local MongoDB + backend + frontend together (npm run dev)
.github/workflows/    api.yml (backend tests + smoke test + package), mobile.yml (Flutter checks, contract test, APK/web)
Report/               original project report (PDF), not code
```

## Commands (run from the repo root)

- `npm run install:all` — install both packages (there are no root dependencies)
- `npm run dev` — persistent local MongoDB :27017 + backend :3000 + `ng serve` :4200. `-- --memory` for a throwaway DB, `-- --no-db` to use `MONGODB_URI` from `backend/.env` as-is
- `npm test` — backend tests; always run after backend changes. **Coverage is gated at 100% in all three parts** (CI fails otherwise): `npm --prefix backend run test:coverage`, `npm --prefix frontend run test:coverage`, and in `mobile/` `flutter test --coverage --exclude-tags backend && dart run tool/check_coverage.dart`. New code needs tests.
- `npm run build` — frontend production build (type-checks templates, checks the icon font list)
- `npm start` — backend serving API + `frontend/dist/frontend/browser`
- In `mobile/`: `flutter analyze` and `flutter test` (skips the live-API test); `BACKEND_URL=http://localhost:3100 flutter test --tags backend` against `PORT=3100 npm --prefix backend run dev:memory`. Run after mobile or API changes
- `npm --prefix frontend run images` — after adding Image Pool pictures (writes opt/*.webp + manifest.json)

## Conventions and gotchas

- **API paths are unprefixed and public contract**: `/blogs`, `/cate`, `/BAdd`, `/posts/:id` (GET, PATCH, DELETE), `/posts/:id/like`, `/adduser`, `/loginuser`, `/logout`, `/myacc` (GET, PATCH), `/addblog`, `/subscribe`, `/stats`, `/leaderboard`, `/health`. A new path must also go in `frontend/proxy.conf.mjs`, and must not be a prefix of a static folder (an `/images` endpoint once hijacked `/images/*.png` in dev).
- **Hash routing** (`withHashLocation`) is deliberate: the page `/#/cate` and the API `/cate` would clash otherwise.
- **Zoneless Angular**: state the template reads must be a signal, or call `ChangeDetectorRef.markForCheck()` after changing it from a non-Angular callback.
- **`inject()` only before the first `await`** in guards/functions (NG0203 otherwise) — see `core/auth.guard.ts`.
- Frontend API calls use paths starting with `/` (`'/myacc'`); `apiInterceptor` adds `environment.apiBaseUrl` and `withCredentials`. Asset fetches use relative paths (`picyourpic/manifest.json`) and are left alone.
- Auth is cookie sessions (`bb.sid`). `/myacc` returns 401 when signed out; `Auth.load()` turns that into `user() === null`.
- Users have a display `name` (required at sign-up, 1-60 chars; empty for pre-2026 accounts, so clients show `name || username`). Blogs carry `authName` for display; `auth` stays the username (identity, ownership, likes).
- **Stories**: `status` is `draft` | `published`; `publishAt` in the future = scheduled. Visibility is computed per request (`liveFilter()` / `statusOf()` in models.js) — every public query must use `liveFilter()`; drafts/scheduled are visible only to their author. Validation lives in `blogFields()` (drafts may be incomplete). `blogp2` is HTML: sanitized by `content.js` on write (allowlist) and plain-text legacy bodies become `<p>` on read; `blogp1` stays plain text (the excerpt). Old docs are upgraded by `migrateBlogs()` at start-up.
- The studio (`pages/write.ts`) is reused by the router when only the query changes (`?id=`); it follows `queryParamMap` and saves/asks before switching stories. Leaving is guarded by `canLeave()`.
- Blogs: author comes from the session, never the body. `img` is a picture name (no extension) from `frontend/public/picyourpic`; a backend test asserts `manifest.json` matches that folder. Never expose `likedBy` — use `serializeBlog()` (gives `likes` + `liked`). Dates are display strings like `01-NOV-2026`. Featured blogs have ids `featured-<no>` and cannot be liked.
- **Images**: always render via `imageUrl(name, 'sm' | 'lg')` (web-sized webp), never the multi-MB originals. Builds exclude originals and the unused 2018 media (`videos/`, `para/`, `bgs/`) — see `angular.json` assets.
- **Icons**: Material Symbols via `<span class="ms">name</span>`. The font in `src/index.html` is subset with `icon_names=` (alphabetical); `scripts/check-icons.mjs` fails the build and prints the list to use if a new icon is missing.
- **Performance**: avoid `filter: blur()` on large/animated layers and SVG filter backgrounds (they repaint every frame — the home page once ran at 2 fps). Use radial gradients; keep `backdrop-filter` to the elements listed next to `.glass` in styles.css. Respect `prefers-reduced-motion` (handled globally).
- Logo: `images/logo-transparent.png` (white background removed from `logoalt.png`); dark theme inverts it with `filter: invert(1) hue-rotate(180deg)`.
- Use the `Confirm` service, not `window.confirm()`, and `Toast` for feedback.
- **Flutter app** (`mobile/`) uses the same API contract: API changes must keep `mobile/test/backend_contract_test.dart` passing. New Image Pool pictures must also be copied to `mobile/assets/picyourpic/`. Widget tests use a wide test font, so layouts must not overflow (Flexible/Wrap, fixed `mainAxisExtent` in grids).
- Bootstrap 5.3.8 provides only reboot/grid/utilities CSS (6.x was alpha-only when written). No Bootstrap JS.
- Secrets live in `backend/.env` (git-ignored); local DB data in `backend/.data/` (git-ignored). The original code leaked a DB and Gmail password, which are in git history.
