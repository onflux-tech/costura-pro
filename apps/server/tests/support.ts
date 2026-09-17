import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AppRouterClient } from "@costura-pro/api/routers/index";
import { type Auth, createAuth, ownerEmail } from "@costura-pro/auth";
import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
	getNativeDatabase,
} from "@costura-pro/db";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { type AppOptions, createApp } from "../src/app";
import { mediaRootFor } from "../src/media";

export const port = 3000;
export const loopbackHost = `127.0.0.1:${port}`;
export const loopbackOrigin = `http://${loopbackHost}`;
export const canonicalOrigin = new URL("https://costura.exemplo.com.br");
export const ownerUsername = "dona.atelie";
export const ownerPassword = "senha-forte-123";
export const remoteIp = "203.0.113.10";

const testSecret = "segredo-so-para-bun-test-0000000000";
const sessionCookieName = /^costura-pro\.session_token=/;

export type Access = "local" | "remote";

export type DeviceCredential = { id: string; secret: string };

export type RequestOptions = {
	body?: unknown;
	cookie?: string;
	headers?: Record<string, string>;
	host?: string;
	method?: string;
	origin?: string;
	raw?: RequestInit["body"];
};

export type ServerOptions = {
	drain?: AppOptions["drain"];
	now?: () => Date;
	webFiles?: Record<string, string>;
};

export type TestServer = {
	app: ReturnType<typeof createApp>;
	auth: Auth;
	close: () => Promise<void>;
	db: Database;
	directory: string;
	mediaRoot: string;
	native: () => ReturnType<typeof getNativeDatabase>;
	reopen: () => void;
	send: (path: string, options?: RequestOptions) => Promise<Response>;
};

export async function startTestServer({
	drain,
	now,
	webFiles,
}: ServerOptions = {}): Promise<TestServer> {
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
	const databaseFile = join(directory, "atelier.db");
	const mediaRoot = mediaRootFor(databaseFile);

	function build() {
		const db = createDb({ DATABASE_FILE: databaseFile });
		applyMigrations(db);
		const auth = createAuth(
			{ BETTER_AUTH_SECRET: testSecret, PORT: port },
			db,
			canonicalOrigin
		);
		const app = createApp({
			auth,
			canonicalOrigin,
			db,
			drain,
			mediaRoot,
			now,
			webRoot,
		});
		return { app, auth, db };
	}

	const server: TestServer = {
		...build(),
		close: async () => {
			closeDb(server.db);
			await rm(directory, { force: true, recursive: true });
		},
		directory,
		mediaRoot,
		native: () => getNativeDatabase(server.db),
		reopen: () => {
			closeDb(server.db);
			Object.assign(server, build());
		},
		send: async (
			path,
			{
				body,
				cookie,
				headers: extraHeaders = {},
				host = loopbackHost,
				method = "GET",
				origin,
				raw,
			} = {}
		) => {
			const headers = new Headers({ ...extraHeaders, host });
			if (origin) {
				headers.set("origin", origin);
			}
			if (cookie) {
				headers.set("cookie", cookie);
			}
			if (body !== undefined) {
				headers.set("content-type", "application/json");
			}
			const payload =
				raw ?? (body === undefined ? undefined : JSON.stringify(body));
			return await server.app.request(path, {
				body: payload,
				duplex: "half",
				headers,
				method,
			} as RequestInit);
		},
	};
	return server;
}

export function accessHeaders(
	access: Access,
	ip = remoteIp
): Record<string, string> {
	return access === "local"
		? { host: loopbackHost }
		: { "cf-connecting-ip": ip, host: canonicalOrigin.host };
}

export type ClientOptions = {
	access?: Access;
	cookie?: string;
	device?: DeviceCredential;
	ip?: string;
};

export function rpc(
	server: TestServer,
	{ access = "local", cookie, device, ip }: ClientOptions = {}
): AppRouterClient {
	const headers: Record<string, string> = accessHeaders(access, ip);
	if (cookie) {
		headers.cookie = cookie;
	}
	if (device) {
		headers["x-costura-device-id"] = device.id;
		headers["x-costura-device-secret"] = device.secret;
	}
	return createORPCClient(
		new RPCLink({
			fetch: async (request) => await server.app.fetch(request),
			headers,
			url: `${loopbackOrigin}/rpc`,
		})
	);
}

export function sessionCookie(response: Response): string {
	const cookie = response.headers
		.getSetCookie()
		.find((value) => sessionCookieName.test(value));
	return cookie?.split(";")[0] ?? "";
}

export function signIn(
	server: TestServer,
	{
		access = "local",
		ip,
		password = ownerPassword,
		username = ownerUsername,
	}: {
		access?: Access;
		ip?: string;
		password?: string;
		username?: string;
	} = {}
): Promise<Response> {
	const { host, ...headers } = accessHeaders(access, ip);
	return server.send("/api/auth/sign-in/username", {
		body: { password, username },
		headers,
		host,
		method: "POST",
		origin: access === "local" ? loopbackOrigin : canonicalOrigin.origin,
	});
}

export async function createOwnerDirect(server: TestServer): Promise<void> {
	await server.auth.api.signUpEmail({
		body: {
			email: ownerEmail,
			name: ownerUsername,
			password: ownerPassword,
			username: ownerUsername,
		},
	});
}

export function forceInstallationState(server: TestServer, state: string) {
	server
		.native()
		.run("UPDATE installation SET state = ? WHERE singleton = 1", [state]);
}

export function newOpId(): string {
	return crypto.randomUUID();
}

export type ReadyInstallation = { codes: string[]; cookie: string };

export async function completeWizard(
	server: TestServer
): Promise<ReadyInstallation> {
	const local = rpc(server);
	const { version } = server
		.native()
		.query<{ version: number }, []>("SELECT version FROM installation")
		.get() ?? { version: 1 };
	await local.installation.setAtelierName({
		atelierName: "Ateliê da Dona",
		baseVersion: version,
		opId: newOpId(),
	});
	await local.installation.createOwner({
		opId: newOpId(),
		password: ownerPassword,
		username: ownerUsername,
	});
	const cookie = sessionCookie(await signIn(server));
	const owner = rpc(server, { cookie });
	const { codes } = await owner.installation.generateRecoveryCodes({
		opId: newOpId(),
	});
	await owner.installation.confirmRecoveryCodes({ opId: newOpId() });
	const backup = join(server.directory, "backup");
	await mkdir(backup, { recursive: true });
	await owner.installation.testBackupFolder({ opId: newOpId(), path: backup });
	await owner.installation.finish({ opId: newOpId() });
	return { codes, cookie };
}

export function manualClock(start = Date.parse("2026-09-16T12:00:00Z")) {
	let current = start;
	return {
		advance: (ms: number) => {
			current += ms;
		},
		now: () => new Date(current),
	};
}

export function times(count: number): number[] {
	return Array.from({ length: count }, (_, index) => index + 1);
}

export type SyncSetup = {
	device: DeviceCredential;
	epoch: string;
	local: AppRouterClient;
	remoteCookie: string;
	server: TestServer;
	sync: AppRouterClient;
};

export function currentEpoch(server: TestServer): string {
	return (
		server
			.native()
			.query<{ epoch: string }, []>("SELECT epoch FROM installation")
			.get()?.epoch ?? ""
	);
}

export async function syncSetup(servers: TestServer[]): Promise<SyncSetup> {
	const server = await startTestServer();
	servers.push(server);
	const { cookie } = await completeWizard(server);
	const remoteCookie = sessionCookie(
		await signIn(server, { access: "remote", ip: "203.0.113.30" })
	);
	const local = rpc(server, { cookie });
	const registered = await rpc(server, {
		access: "remote",
		cookie: remoteCookie,
	}).devices.register({ name: "Celular", opId: newOpId() });
	await local.devices.approve({
		deviceId: registered.deviceId,
		opId: newOpId(),
	});
	const device = {
		id: registered.deviceId,
		secret: registered.deviceSecret ?? "",
	};
	return {
		device,
		epoch: currentEpoch(server),
		local,
		remoteCookie,
		server,
		sync: rpc(server, { access: "remote", cookie: remoteCookie, device }),
	};
}

export function inSequence<T, R>(
	items: readonly T[],
	run: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	return items.reduce<Promise<R[]>>(
		async (previous, item, index) => [
			...(await previous),
			await run(item, index),
		],
		Promise.resolve([])
	);
}
