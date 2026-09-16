import type { Database } from "@costura-pro/db";
import * as schema from "@costura-pro/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export type AuthConfig = {
	BETTER_AUTH_SECRET: string;
	PORT: number;
};

export function createAuth(
	env: AuthConfig,
	database: Database,
	canonicalOrigin?: URL
) {
	return betterAuth({
		advanced: {
			cookiePrefix: "costura-pro",
			useSecureCookies: false,
		},
		baseURL: `http://127.0.0.1:${env.PORT}`,
		database: drizzleAdapter(database, {
			provider: "sqlite",
			schema,
		}),
		emailAndPassword: { enabled: true },
		plugins: [],
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [
			"http://127.0.0.1:*",
			"http://localhost:*",
			...(canonicalOrigin ? [canonicalOrigin.origin] : []),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
