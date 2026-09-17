import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	utimes,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { inspect } from "node:util";
import { mediaPath } from "@costura-pro/api/media/files";
import { mediaLimits } from "@costura-pro/domain/media";

import {
	completeWizard,
	forceInstallationState,
	manualClock,
	rpc,
	type ServerOptions,
	sessionCookie,
	signIn,
	startTestServer,
	type TestServer,
} from "./support";

const hour = 60 * 60 * 1000;
const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function ownerSetup(options: ServerOptions = {}) {
	const server = await startTestServer(options);
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { cookie, server };
}

function sha256(bytes: Uint8Array) {
	return createHash("sha256").update(bytes).digest("hex");
}

function jpeg(seed: string, length = 2048) {
	const bytes = new Uint8Array(length);
	bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
	bytes.set(new TextEncoder().encode(seed), 8);
	return bytes;
}

function webp(length = 64, declared = length - 8) {
	const bytes = new Uint8Array(length);
	bytes.set([0x52, 0x49, 0x46, 0x46], 0);
	new DataView(bytes.buffer).setUint32(4, declared, true);
	bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20], 8);
	return bytes;
}

type PutOptions = {
	headers?: Record<string, string>;
	host?: string;
	origin?: string;
};

function put(
	server: TestServer,
	cookie: string,
	bytes: RequestInit["body"],
	hash: string,
	options: PutOptions = {}
) {
	return server.send(`/api/media/${hash}`, {
		cookie,
		headers: options.headers,
		host: options.host,
		method: "PUT",
		origin: options.origin,
		raw: bytes,
	});
}

function mediaRow(server: TestServer, hash: string) {
	return server
		.native()
		.query<{ byte_size: number; mime: string; uploaded_at: number }, [string]>(
			"SELECT byte_size, mime, uploaded_at FROM media_file WHERE hash = ?"
		)
		.get(hash);
}

async function temporaryEntries(server: TestServer) {
	const folder = join(server.mediaRoot, "tmp");
	return existsSync(folder) ? await readdir(folder) : [];
}

async function storedNames(server: TestServer) {
	if (!existsSync(server.mediaRoot)) {
		return [];
	}
	const entries = await readdir(server.mediaRoot, { recursive: true });
	return entries.filter(
		(entry) => entry.endsWith(".jpg") || entry.endsWith(".webp")
	);
}

describe("media upload", () => {
	test("stores JPEG and WebP by their hash and answers with the stored row", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("frente");
		const thumbnail = webp();
		const photoHash = sha256(photo);
		const thumbnailHash = sha256(thumbnail);
		const first = await put(server, cookie, photo, photoHash);
		expect(first.status).toBe(201);
		expect(await first.json()).toEqual({
			byteSize: photo.byteLength,
			hash: photoHash,
			mime: "image/jpeg",
		});
		expect((await put(server, cookie, thumbnail, thumbnailHash)).status).toBe(
			201
		);
		expect(
			new Uint8Array(
				await readFile(mediaPath(server.mediaRoot, photoHash, "image/jpeg"))
			)
		).toEqual(photo);
		expect(
			existsSync(mediaPath(server.mediaRoot, thumbnailHash, "image/webp"))
		).toBe(true);
		expect(mediaRow(server, thumbnailHash)?.mime).toBe("image/webp");
		expect(await temporaryEntries(server)).toEqual([]);
	});

	test("keeps an identical final file untouched when the row is missing", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("barra");
		const hash = sha256(photo);
		const target = mediaPath(server.mediaRoot, hash, "image/jpeg");
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, photo);
		const past = new Date("2026-01-01T00:00:00Z");
		await utimes(target, past, past);
		expect((await put(server, cookie, photo, hash)).status).toBe(201);
		expect((await stat(target)).mtime.getTime()).toBe(past.getTime());
		expect(mediaRow(server, hash)).not.toBeNull();
	});

	test("repeats with 200, renews the upload time and rewrites a missing file", async () => {
		const clock = manualClock();
		const { cookie, server } = await ownerSetup({ now: clock.now });
		const photo = jpeg("costas");
		const hash = sha256(photo);
		await put(server, cookie, photo, hash);
		const firstUpload = mediaRow(server, hash)?.uploaded_at ?? 0;
		clock.advance(25 * hour);
		expect((await put(server, cookie, photo, hash)).status).toBe(200);
		expect(mediaRow(server, hash)?.uploaded_at).toBe(firstUpload + 25 * hour);
		await rm(mediaPath(server.mediaRoot, hash, "image/jpeg"));
		expect((await server.send(`/api/media/${hash}`, { cookie })).status).toBe(
			404
		);
		expect((await put(server, cookie, photo, hash)).status).toBe(201);
		expect((await server.send(`/api/media/${hash}`, { cookie })).status).toBe(
			200
		);
	});

	test("refuses a wrong hash, a PNG, a WebP with the wrong size and an invalid hash", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("manga");
		expect(
			(await put(server, cookie, photo, sha256(jpeg("outra")))).status
		).toBe(422);
		const png = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
		expect((await put(server, cookie, png, sha256(png))).status).toBe(415);
		const broken = webp(64, 100);
		expect((await put(server, cookie, broken, sha256(broken))).status).toBe(
			415
		);
		const invalid = await put(server, cookie, photo, "ABC");
		expect(invalid.status).toBe(400);
		expect(await invalid.json()).toEqual({ message: "Hash inválido" });
		expect(server.native().query("SELECT hash FROM media_file").all()).toEqual(
			[]
		);
		expect(await storedNames(server)).toEqual([]);
	});

	test("accepts exactly 4 MB and refuses more, by the declared length and by counting the stream", async () => {
		const { cookie, server } = await ownerSetup();
		const exact = new Uint8Array(mediaLimits.maxBytes);
		exact.set([0xff, 0xd8, 0xff], 0);
		expect((await put(server, cookie, exact, sha256(exact))).status).toBe(201);
		const chunk = 64 * 1024;
		const counted = () => {
			const state = { produced: 0 };
			const stream = new ReadableStream<Uint8Array>({
				pull(controller) {
					if (state.produced >= 64 * 1024 * 1024) {
						controller.close();
						return;
					}
					state.produced += chunk;
					controller.enqueue(new Uint8Array(chunk).fill(0xff));
				},
			});
			return { state, stream };
		};
		const declared = counted();
		const refusedByLength = await put(
			server,
			cookie,
			declared.stream,
			"a".repeat(64),
			{ headers: { "content-length": String(mediaLimits.maxBytes + 1) } }
		);
		expect(refusedByLength.status).toBe(413);
		expect(await refusedByLength.json()).toEqual({
			message: "Arquivo maior que 4 MB",
		});
		expect(declared.state.produced).toBeLessThanOrEqual(chunk);
		const streamed = counted();
		const refusedByCount = await put(
			server,
			cookie,
			streamed.stream,
			"a".repeat(64)
		);
		expect(refusedByCount.status).toBe(413);
		expect(streamed.state.produced).toBeLessThanOrEqual(
			mediaLimits.maxBytes + 2 * chunk
		);
	});

	test("replaces a corrupted final file and never writes a final path it cannot read", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("corrompida", 4096);
		const hash = sha256(photo);
		const target = mediaPath(server.mediaRoot, hash, "image/jpeg");
		await put(server, cookie, photo, hash);
		await writeFile(target, photo.slice(0, 1000));
		expect((await put(server, cookie, photo, hash)).status).toBe(201);
		expect(new Uint8Array(await readFile(target))).toEqual(photo);
		const sameSize = jpeg("mesmo-tamanho", 4096);
		const sameSizeHash = sha256(sameSize);
		const sameSizeTarget = mediaPath(
			server.mediaRoot,
			sameSizeHash,
			"image/jpeg"
		);
		await mkdir(dirname(sameSizeTarget), { recursive: true });
		await writeFile(sameSizeTarget, jpeg("outro-conteudo", 4096));
		expect((await put(server, cookie, sameSize, sameSizeHash)).status).toBe(
			201
		);
		expect(new Uint8Array(await readFile(sameSizeTarget))).toEqual(sameSize);
		const blocked = jpeg("bloqueada");
		const blockedHash = sha256(blocked);
		const blockedTarget = mediaPath(
			server.mediaRoot,
			blockedHash,
			"image/jpeg"
		);
		await mkdir(blockedTarget, { recursive: true });
		await writeFile(join(blockedTarget, "dentro"), "x");
		const spy = spyOn(console, "error").mockImplementation(() => undefined);
		try {
			expect((await put(server, cookie, blocked, blockedHash)).status).toBe(
				500
			);
			const printed = inspect(spy.mock.calls, { depth: 10 });
			expect(printed).not.toContain(blockedHash);
			expect(printed).not.toContain(server.mediaRoot);
		} finally {
			spy.mockRestore();
		}
		expect(mediaRow(server, blockedHash)).toBeNull();
		expect(await temporaryEntries(server)).toEqual([]);
	});

	test("needs the owner session and a ready installation, from any access", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("remoto");
		const hash = sha256(photo);
		const anonymous = await put(server, "", photo, hash);
		expect(anonymous.status).toBe(401);
		expect(await anonymous.json()).toEqual({ message: "Sessão necessária" });
		const remoteCookie = sessionCookie(
			await signIn(server, { access: "remote", ip: "203.0.113.51" })
		);
		const remote = await put(server, remoteCookie, photo, hash, {
			headers: { "cf-connecting-ip": "203.0.113.51" },
			host: "costura.exemplo.com.br",
		});
		expect(remote.status).toBe(201);
		const foreign = jpeg("origem");
		expect(
			(
				await put(server, cookie, foreign, sha256(foreign), {
					origin: "https://malicioso.exemplo",
				})
			).status
		).toBe(403);
		forceInstallationState(server, "backup");
		const wizard = jpeg("wizard");
		const refused = await put(server, cookie, wizard, sha256(wizard));
		expect(refused.status).toBe(412);
		expect(await refused.json()).toEqual({
			message: "Instalação ainda no wizard",
		});
	});

	test("two simultaneous uploads of the same bytes leave one file and no temporary", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("simultaneo");
		const hash = sha256(photo);
		const statuses = (
			await Promise.all([
				put(server, cookie, photo, hash),
				put(server, cookie, photo, hash),
			])
		)
			.map((response) => response.status)
			.sort();
		expect(statuses).toEqual([200, 201]);
		expect(await temporaryEntries(server)).toEqual([]);
	});

	test("a write failure answers 500 without a row and logs only the error code", async () => {
		const { cookie, server } = await ownerSetup();
		await mkdir(server.mediaRoot, { recursive: true });
		await writeFile(join(server.mediaRoot, "tmp"), "não é pasta");
		const photo = jpeg("falha");
		const hash = sha256(photo);
		const spy = spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const failed = await put(server, cookie, photo, hash);
			expect(failed.status).toBe(500);
			expect(await failed.json()).toEqual({
				message: "Não foi possível gravar a foto",
			});
			const printed = inspect(spy.mock.calls, { depth: 10 });
			expect(printed).not.toContain(hash);
			expect(printed).not.toContain(server.mediaRoot);
		} finally {
			spy.mockRestore();
		}
		expect(mediaRow(server, hash)).toBeNull();
	});
});

describe("media read", () => {
	test("a read failure answers 500 and logs only the error code", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("leitura-falha");
		const hash = sha256(photo);
		await put(server, cookie, photo, hash);
		const target = mediaPath(server.mediaRoot, hash, "image/jpeg");
		await rm(target);
		await mkdir(target);
		await writeFile(join(target, "dentro"), "x");
		const spy = spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const failed = await server.send(`/api/media/${hash}`, { cookie });
			expect(failed.status).toBe(500);
			expect(await failed.json()).toEqual({
				message: "Não foi possível ler a foto",
			});
			const printed = inspect(spy.mock.calls, { depth: 10 });
			expect(printed).not.toContain(hash);
			expect(printed).not.toContain(server.mediaRoot);
		} finally {
			spy.mockRestore();
		}
	});

	test("serves the file with private immutable cache, ETag and nosniff", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("leitura");
		const hash = sha256(photo);
		await put(server, cookie, photo, hash);
		const response = await server.send(`/api/media/${hash}`, { cookie });
		expect(response.status).toBe(200);
		expect(Object.fromEntries(response.headers)).toMatchObject({
			"cache-control": "private, max-age=31536000, immutable",
			"content-disposition": "inline",
			"content-length": String(photo.byteLength),
			"content-type": "image/jpeg",
			etag: `"${hash}"`,
			"x-content-type-options": "nosniff",
		});
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(photo);
		const download = await server.send(`/api/media/${hash}?download=1`, {
			cookie,
		});
		expect(download.headers.get("content-disposition")).toBe(
			`attachment; filename="foto-${hash.slice(0, 12)}.jpg"`
		);
	});

	test("answers 304 only with session and row, 404 without row or file, 412 in the wizard", async () => {
		const { cookie, server } = await ownerSetup();
		const photo = jpeg("etag");
		const hash = sha256(photo);
		await put(server, cookie, photo, hash);
		const etag = { "if-none-match": `"${hash}"` };
		const cached = await server.send(`/api/media/${hash}`, {
			cookie,
			headers: etag,
		});
		expect(cached.status).toBe(304);
		expect(cached.headers.get("etag")).toBe(`"${hash}"`);
		expect(
			(await server.send(`/api/media/${hash}`, { headers: etag })).status
		).toBe(401);
		const unknown = "b".repeat(64);
		expect(
			(
				await server.send(`/api/media/${unknown}`, {
					cookie,
					headers: { "if-none-match": `"${unknown}"` },
				})
			).status
		).toBe(404);
		expect((await server.send("/api/media/nao-hash", { cookie })).status).toBe(
			404
		);
		await rm(mediaPath(server.mediaRoot, hash, "image/jpeg"));
		const missing = await server.send(`/api/media/${hash}`, { cookie });
		expect(missing.status).toBe(404);
		expect(await missing.json()).toEqual({ message: "Foto não encontrada" });
		forceInstallationState(server, "backup");
		expect((await server.send(`/api/media/${hash}`, { cookie })).status).toBe(
			412
		);
	});

	test("keeps the hash and the media folder out of the request log", async () => {
		const events: unknown[] = [];
		const { cookie, server } = await ownerSetup({
			drain: (context) => {
				events.push(context.event);
			},
		});
		const photo = jpeg("log");
		const hash = sha256(photo);
		await put(server, cookie, photo, hash);
		await server.send(`/api/media/${hash}`, { cookie });
		await server.send(`/api/media/${hash}?download=1`, { cookie });
		await rpc(server, { cookie }).healthCheck();
		await delay(50);
		const logged = JSON.stringify(events);
		expect(logged).toContain("/rpc/healthCheck");
		expect(logged).not.toContain(hash);
		expect(logged).not.toContain("/api/media");
	});
});
