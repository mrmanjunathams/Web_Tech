# Bloggerbytes mobile app

Flutter port of the Angular web app (`../frontend`). It runs on Android, iOS and the web, and talks to the same Express API (`../backend`).

## Features (same as the web app)

| Web route | Screen | What it does |
| --- | --- | --- |
| `/` | Home | Live stats, rotating headline, topic strip, trending stories, features, call to action |
| `/blog` | Stories | Featured editor's picks (hero card) + latest community posts |
| `/cate?q=` | Explore | Search across title, writer, topic, date and text · topic chips with counts · sort (newest, most loved, most viewed, A→Z) |
| `/post/:id` | Reader | Cover, byline, reading time and views, reading progress bar, like (optimistic), share, delete your own story, "More like this" |
| `/rewards` | Leaderboard | Podium (top 3), ranking list with you highlighted, badges |
| `/gallery` | Image Pool | Grid of covers, full-screen lightbox (swipe, arrows, keyboard), "Write with this" |
| `/aboutme` | About | Mission, timeline, contact email |
| `/login`, `/signup` | Auth | Display name + username, validation matching the API, show/hide password, strength meter |
| `/myacc` | Dashboard | Profile with editable display name, stat tiles, Published / Scheduled / Drafts tabs with edit and delete, log out |
| `/writeblog?id=&img=` | Studio | Rich-text editor (flutter_quill: headings, lists, quotes, code, links, undo), cover picker, topics with suggestions, checklist and card preview, preview mode, drafts that autosave (on the device until first saved, then to the server), publish now or schedule (date and time pickers), update, move to drafts, delete; asks before leaving unsaved edits |

Everywhere else: a search palette (pages, actions, stories), light/dark theme saved on the device, toasts, the newsletter sign-up and footer links, and pull-to-refresh. Lists refresh by themselves after you publish, like or delete. `/myacc` and `/writeblog` need you to be signed in, as on the web. The session (`bb.sid` cookie) is stored on the device, so you stay signed in between launches.

## Run

Start the API first (from the repo root): `npm run dev`, or `npm --prefix backend run dev:memory` if you only need the API.

```bash
flutter pub get
flutter run                     # Android emulator: API at http://10.0.2.2:3000, everything else: http://localhost:3000
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3000   # a real phone on your Wi-Fi
```

**Real phone over USB (most reliable):** forward the phone's port 3000 to your PC, then use localhost. This works regardless of Wi-Fi or firewall settings:

```bash
adb reverse tcp:3000 tcp:3000          # repeat after reconnecting the cable
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

`10.0.2.2` (the Android default) only exists inside the emulator. On a real phone it gives "Cannot reach the server at http://10.0.2.2:3000".

| `--dart-define` | Default | Meaning |
| --- | --- | --- |
| `API_BASE_URL` | `http://10.0.2.2:3000` (Android) / `http://localhost:3000` | Where the API is |
| `SITE_URL` | `API_BASE_URL` | Web app address used in share links (`<site>/#/post/<id>`) |

- Debug builds may use `http://`. Release builds need an `https://` API, except on iOS for local addresses.
- **Flutter web:** add the app's origin to `CORS_ORIGIN` in `backend/.env`, e.g. `CORS_ORIGIN=http://localhost:5000`.

## Build

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com
flutter build web --release --dart-define=API_BASE_URL=https://api.example.com
flutter build ios --release --dart-define=API_BASE_URL=https://api.example.com   # on macOS
```

The release APK is signed with the debug key (Flutter's default). Set up your own signing before publishing to Play.

## Test

```bash
flutter analyze
flutter test --coverage --exclude-tags backend   # unit + widget tests against an in-memory fake of the API
dart run tool/check_coverage.dart               # fails below 100% line coverage of lib/ (as CI does)

# Contract test against the real API (what CI runs):
PORT=3100 npm --prefix ../backend run dev:memory &
BACKEND_URL=http://localhost:3100 flutter test --tags backend
```

## Image Pool

`assets/picyourpic/` is a copy of `../frontend/public/picyourpic/manifest.json` and `opt/`, bundled so covers load instantly and work offline. After adding pictures (`npm --prefix frontend run images`), copy them again:

```bash
cp ../frontend/public/picyourpic/manifest.json assets/picyourpic/ && cp ../frontend/public/picyourpic/opt/*.webp assets/picyourpic/opt/
```

CI fails if the two copies drift apart.
