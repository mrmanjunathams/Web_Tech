# Bloggerbytes

Where bloggers can write their own blogs and post them on Bloggerbytes.

- **Frontend:** AngularJS 1.8.3 + ngRoute, Materialize 1.0.0, Font Awesome 4.7 (loaded from CDN): `index.html`, `js/app.js`, `templets/`
- **Backend:** Node.js (22.9+), Express 5, Mongoose 9 / MongoDB, express-session with a MongoDB session store: `server/`

One Express server serves both the frontend and the JSON API on the same port.

## Setup

```bash
npm install
cp .env.example .env      # then edit the values
```

### Run

| Command | What it does |
| --- | --- |
| `npm run dev:memory` | No MongoDB needed: starts a throwaway in-memory MongoDB (data is lost on exit) |
| `npm run dev` | Uses `MONGODB_URI` from `.env`, restarts on file changes |
| `npm start` | Production start (set `NODE_ENV=production` and `SESSION_SECRET`) |
| `npm test` | API tests against an in-memory MongoDB |

Open http://localhost:3000. On first start an empty database is seeded with the sample blogs in `server/data/seed-blogs.json`.

`MONGODB_URI` can point to a local MongoDB, Docker (`docker run -p 27017:27017 mongo`) or MongoDB Atlas.
The welcome email on sign-up is optional: set `SMTP_USER` / `SMTP_PASS` (for Gmail, use an App Password).

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/blogs` | - | Featured blogs (static JSON) |
| GET | `/BAdd` | - | All published blogs, newest first |
| POST | `/adduser` | - | Sign up `{username, email, password}` and start a session |
| POST | `/loginuser` | - | Sign in `{username, password}` |
| POST | `/logout` | - | End the session |
| GET | `/myacc` | yes | Current user and their blogs |
| POST | `/addblog` | yes | Publish `{title, cate, date, img, blogp1, blogp2}`. `img` is an Image Pool name such as `img5` |
| GET | `/health` | - | Health check |
