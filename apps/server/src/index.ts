import { resolve } from "node:path";
import { initLogger } from "evlog";
import { createFsDrain } from "evlog/fs";

import { createApp } from "./app";
import { env } from "./env.server";
import { auth, canonicalOrigin, db } from "./services";

initLogger({
	env: { service: "costura-pro-server" },
});

const isProduction = env.NODE_ENV === "production";

const app = createApp({
	auth,
	canonicalOrigin,
	db,
	drain: isProduction ? undefined : createFsDrain(),
	webRoot: isProduction
		? resolve(import.meta.dirname, "../../web/dist")
		: undefined,
});

export default {
	fetch: app.fetch,
	hostname: "127.0.0.1",
	port: env.PORT,
};
