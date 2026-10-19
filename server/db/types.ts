import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema.js";
export interface StudioDatabase { db: PgDatabase<PgQueryResultHKT, typeof schema> }
