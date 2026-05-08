import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function getDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}
