import {
	recordSignInAttempt,
	reserveRemoteAttempt,
} from "@costura-pro/api/sign-in-guard";
import { type Auth, signInUsernamePath } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";
import type { EvlogVariables } from "evlog/hono";
import type { Handler, MiddlewareHandler } from "hono";

import { classifyAccess } from "./access";

export const authBasePath = "/api/auth";
export const signInUsernameRoute = `${authBasePath}${signInUsernamePath}`;

export const authPathAllowlist: ReadonlySet<string> = new Set([
	"/change-password",
	"/get-session",
	"/list-sessions",
	"/ok",
	"/revoke-other-sessions",
	"/revoke-session",
	signInUsernamePath,
	"/sign-out",
]);

export function authRoutes(auth: Auth): Handler {
	return (c) => {
		const path = c.req.path.slice(authBasePath.length);
		if (!authPathAllowlist.has(path)) {
			return c.notFound();
		}
		return auth.handler(c.req.raw);
	};
}

export function signInGuard({
	db,
	now,
}: {
	db: Database;
	now: () => Date;
}): MiddlewareHandler<EvlogVariables> {
	return async (c, next) => {
		const { access, ip } = classifyAccess(c.req.raw.headers);
		const log = (fields: Record<string, unknown>) => {
			c.get("log").set(fields);
		};
		if (access === "remote") {
			const reservation = reserveRemoteAttempt(db, { ip, log, now: now() });
			if (!reservation.reserved) {
				return c.json(
					{ message: "Muitas tentativas. Tente de novo mais tarde." },
					429,
					{ "Retry-After": String(reservation.retryAfter) }
				);
			}
		}
		await next();
		recordSignInAttempt(db, {
			access,
			ip,
			log,
			now: now(),
			status: c.res.status,
		});
	};
}
