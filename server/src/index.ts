import { Hono } from "hono";
import { cors } from "hono/cors";
import { runTick } from "./cron/tick";
import type { Env } from "./env";
import auth from "./routes/auth";
import health from "./routes/health";
import users from "./routes/users";

const app = new Hono<{ Bindings: Env }>();

// 미니앱이 다른 출처에서 fetch — CORS 허용 (MVP는 모두 허용, 추후 origin 제한 가능)
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.route("/api/auth", auth);
app.route("/api/users", users);
app.route("/api/health", health);

app.get("/", (c) => c.text("bible-mini-noti-api"));

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runTick(env, event));
  },
} satisfies ExportedHandler<Env>;
