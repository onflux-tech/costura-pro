import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AppRouterClient } from "@costura-pro/api/routers/index";
import { type Auth, createAuth } from "@costura-pro/auth";
import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
} from "@costura-pro/db";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { createApp } from "../src/app";

export const port = 3000;
export const loopbackHost = `127.0.0.1:${port}`;
export const loopbackOrigin = `http://${loopbackHost}`;
export const canonicalOrigin = new URL("https://costura.exemplo.com.br");

const testSecret = "segredo-so-para-bun-test-0000000000";

export type RequestOptions = {
	body?: unknown;
	cookie?: string;
	host?: string;
	method?: string;
	origin?: string;
};

export type TestServer = {
	app: ReturnType<typeof createApp>;
	auth: Auth;
	close: () => Promise<void>;
	db: Database;
	directory: string;
	send: (path: string, options?: RequestOptions) => Promise<Response>;
};

export async function startTestServer(
	webFiles?: Record<string, string>
): Promise<TestServer> {
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-server-"));
	const webRoot = webFiles ? join(directory, "web") : undefined;
	if (webRoot && webFiles) {
		await Promise.all(
			Object.entries(webFiles).map(async ([path, content]) => {
				const file = join(webRoot, path);
				await mkdir(dirname(file), { recursive: true });
				await writeFile(file, content);
			})
		);
	}
	const db = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	applyMigrations(db);
	const auth = createAuth(
		{ BETTER_AUTH_SECRET: testSecret, PORT: port },
		db,
		canonicalOrigin
	);
	const app = createApp({ auth, canonicalOrigin, db, webRoot });

	return {
		app,
		auth,
		close: async () => {
			closeDb(db);
			await rm(directory, { force: true, recursive: true });
		},
		db,
		directory,
		send: async (
			path,
			{ body, cookie, host = loopbackHost, method = "GET", origin } = {}
		) => {
			const headers = new Headers({ host });
			if (origin) {
				headers.set("origin", origin);
			}
			if (cookie) {
				headers.set("cookie", cookie);
			}
			if (body !== undefined) {
				headers.set("content-type", "application/json");
			}
			return await app.request(path, {
				body: body === undefined ? undefined : JSON.stringify(body),
				headers,
				method,
			});
		},
	};
}

export function rpcClient(
	server: TestServer,
	headers: Record<string, string>
): AppRouterClient {
	return createORPCClient(
		new RPCLink({
			fetch: async (request) => await server.app.fetch(request),
			headers,
			url: `${loopbackOrigin}/rpc`,
		})
	);
}
