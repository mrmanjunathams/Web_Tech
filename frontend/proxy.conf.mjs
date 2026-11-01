// Dev-server proxy: forwards API calls from "ng serve" to the Express backend.
const target = `http://localhost:${process.env.BACKEND_PORT || 3000}`;
const apiPaths = [
  '/blogs', '/cate', '/BAdd', '/posts', '/adduser', '/loginuser', '/logout', '/myacc', '/addblog',
  '/subscribe', '/stats', '/leaderboard', '/health',
];

export default Object.fromEntries(apiPaths.map((p) => [p, { target, secure: false }]));
