import type { Database } from "@costura-pro/db";
import * as schema from "@costura-pro/db/schema/auth";
import {
	passwordLength,
	usernameLength,
} from "@costura-pro/domain/credentials";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

export type AuthConfig = {
	BETTER_AUTH_SECRET: string;
	PORT: number;
};

export const ownerEmail = "owner@costura-pro.local";
export const signInUsernamePath = "/sign-in/username";

export function createAuth(
	env: AuthConfig,
	database: Database,
	canonicalOrigin?: URL
) {
	return betterAuth({
		advanced: {
			cookiePrefix: "costura-pro",
			ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
			useSecureCookies: false,
		},
		baseURL: `http://127.0.0.1:${env.PORT}`,
		database: drizzleAdapter(database, {
			provider: "sqlite",
			schema,
		}),
		databaseHooks: {
			user: {
				create: {
					before: async () =>
						(await database.$count(schema.user)) > 0 ? false : undefined,
				},
			},
		},
		emailAndPassword: {
			autoSignIn: false,
			enabled: true,
			maxPasswordLength: passwordLength.max,
			minPasswordLength: passwordLength.min,
		},
		plugins: [
			username({
				displayUsername: false,
				maxUsernameLength: usernameLength.max,
				minUsernameLength: usernameLength.min,
			}),
		],
		rateLimit: {
			customRules: { [signInUsernamePath]: { max: 5, window: 60 } },
			enabled: true,
			storage: "database",
		},
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [
			"http://127.0.0.1:*",
			"http://localhost:*",
			...(canonicalOrigin ? [canonicalOrigin.origin] : []),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
