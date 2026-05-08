import { Hono } from "hono";
import type { Env } from "../env";

const route = new Hono<{ Bindings: Env }>();

route.get("/", (c) =>
  c.json({
    ok: true,
    service: "bible-mini-noti-api",
    ts: Date.now(),
    mode: c.env.TOSS_MODE,
  }),
);

export default route;
