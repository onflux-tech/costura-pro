import { createAuth } from "@costura-pro/auth";
import { createDb } from "@costura-pro/db";

import { env } from "./env.server";
import { parseCanonicalOrigin } from "./origin";

export const canonicalOrigin = parseCanonicalOrigin(env.CANONICAL_ORIGIN);
export const db = createDb(env);
export const auth = createAuth(env, db, canonicalOrigin);
