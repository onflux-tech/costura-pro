import { resolve } from "node:path";
import { startMediaCollection } from "@costura-pro/api/media/collect";
import { errorCode } from "@costura-pro/api/media/files";
import { initLogger } from "evlog";
import { createFsDrain } from "evlog/fs";

import { createApp } from "./app";
import { env } from "./env.server";
import { mediaRootFor } from "./media";
import { auth, canonicalOrigin, db } from "./services";

initLogger({
	env: { service: "costura-pro-server" },
});

const isProduction = env.NODE_ENV === "production";

const mediaRoot = mediaRootFor(env.DATABASE_FILE);

const app = createApp({
	auth,
	canonicalOrigin,
	db,
	drain: isProduction ? undefined : createFsDrain(),
	mediaRoot,
	webRoot: isProduction
		? resolve(import.meta.dirname, "../../web/dist")
		: undefined,
});

startMediaCollection({
	db,
	intervalMs: 60 * 60 * 1000,
	mediaRoot,
	onError: (error) => {
		console.error({
			code: errorCode(error),
			outcome: "failed",
			scope: "media.collect",
		});
	},
});

export default {
	fetch: app.fetch,
	hostname: "127.0.0.1",
	port: env.PORT,
};
