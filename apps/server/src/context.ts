import type { Context as ApiContext } from "@costura-pro/api/context";
import type { Auth } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";
import type { EvlogVariables } from "evlog/hono";
import type { Context as HonoContext } from "hono";

import packageJson from "../package.json";
import { classifyAccess } from "./access";

export const deviceIdHeader = "x-costura-device-id";
export const deviceSecretHeader = "x-costura-device-secret";

export type CreateContextOptions = {
	auth: Auth;
	context: HonoContext<EvlogVariables>;
	db: Database;
	now: () => Date;
};

export async function createContext({
	auth,
	context,
	db,
	now,
}: CreateContextOptions): Promise<ApiContext> {
	const { headers } = context.req.raw;
	const session = await auth.api.getSession({ headers });
	const { access, ip } = classifyAccess(headers);
	const deviceId = headers.get(deviceIdHeader);
	const deviceSecret = headers.get(deviceSecretHeader);
	return {
		access,
		auth,
		db,
		device:
			deviceId && deviceSecret ? { id: deviceId, secret: deviceSecret } : null,
		ip,
		log: (fields) => {
			context.get("log").set(fields);
		},
		now,
		serverVersion: packageJson.version,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
