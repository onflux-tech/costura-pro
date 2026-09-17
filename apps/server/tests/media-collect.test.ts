import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, utimes, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
	collectMedia,
	startMediaCollection,
} from "@costura-pro/api/media/collect";
import { mediaPath } from "@costura-pro/api/media/files";

import {
	canonicalOrigin,
	completeWizard,
	inSequence,
	manualClock,
	newOpId,
	rpc,
	type ServerOptions,
	type SyncSetup,
	startTestServer,
	syncSetup,
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
	return { cookie, owner: rpc(server, { cookie }), server };
}

function jpeg(seed: string) {
	const bytes = new Uint8Array(1024);
	bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
	bytes.set(new TextEncoder().encode(seed), 8);
	return { bytes, hash: createHash("sha256").update(bytes).digest("hex") };
}

async function upload(
	server: TestServer,
	cookie: string,
	seed: string,
	remote = false
) {
	const file = jpeg(seed);
	const response = await server.send(`/api/media/${file.hash}`, {
		cookie,
		headers: remote ? { "cf-connecting-ip": "203.0.113.30" } : undefined,
		host: remote ? canonicalOrigin.host : undefined,
		method: "PUT",
		raw: file.bytes,
	});
	expect([200, 201]).toContain(response.status);
	return file.hash;
}

function hasRow(server: TestServer, hash: string) {
	return (
		server
			.native()
			.query<{ hash: string }, [string]>(
				"SELECT hash FROM media_file WHERE hash = ?"
			)
			.get(hash) !== null
	);
}

function hasFile(server: TestServer, hash: string) {
	return existsSync(mediaPath(server.mediaRoot, hash, "image/jpeg"));
}

function collect(server: TestServer, now: Date) {
	return collectMedia({ db: server.db, mediaRoot: server.mediaRoot, now });
}

async function waitFor(
	check: () => boolean,
	timeoutMs = 3000,
	started = Date.now()
): Promise<boolean> {
	if (check()) {
		return true;
	}
	if (Date.now() - started > timeoutMs) {
		return false;
	}
	await delay(20);
	return waitFor(check, timeoutMs, started);
}

async function aged(path: string, now: Date, ageMs: number) {
	const when = new Date(now.getTime() - ageMs);
	await mkdir(dirname(path), { recursive: true });
	if (!existsSync(path)) {
		await writeFile(path, "x");
	}
	await utimes(path, when, when);
}

describe("media collection", () => {
	test("removes rows without reference after 24 h and keeps younger ones", async () => {
		const clock = manualClock();
		const { cookie, server } = await ownerSetup({ now: clock.now });
		const old = await upload(server, cookie, "antiga");
		clock.advance(2 * hour);
		const young = await upload(server, cookie, "nova");
		clock.advance(23 * hour);
		expect(await collect(server, clock.now())).toEqual({
			files: 0,
			rows: 1,
			temporary: 0,
		});
		expect([hasRow(server, old), hasFile(server, old)]).toEqual([false, false]);
		expect([hasRow(server, young), hasFile(server, young)]).toEqual([
			true,
			true,
		]);
	});

	test("a re-upload renews the grace period", async () => {
		const clock = manualClock();
		const { cookie, server } = await ownerSetup({ now: clock.now });
		const hash = await upload(server, cookie, "reenvio");
		clock.advance(25 * hour);
		await upload(server, cookie, "reenvio");
		await collect(server, clock.now());
		expect([hasRow(server, hash), hasFile(server, hash)]).toEqual([true, true]);
	});

	test("keeps photos and thumbnails of active, archived and returned items", async () => {
		const clock = manualClock();
		const { cookie, owner, server } = await ownerSetup({ now: clock.now });
		const clientId = crypto.randomUUID();
		await owner.clients.create({
			clientId,
			kind: "person",
			name: "Maria Beatriz Alencar",
			opId: newOpId(),
		});
		const seeds = ["ativa", "arquivada", "devolvida"];
		const hashes = await inSequence(seeds, async (seed) => ({
			photo: await upload(server, cookie, seed),
			thumbnail: await upload(server, cookie, `${seed}-miniatura`),
		}));
		const ids = await inSequence(hashes, async ({ photo, thumbnail }) => {
			const receivedItemId = crypto.randomUUID();
			await owner.receivedItems.create({
				clientId,
				condition: "good",
				description: "Vestido",
				opId: newOpId(),
				photos: [{ caption: null, photoHash: photo, thumbnailHash: thumbnail }],
				quantity: 1,
				receivedItemId,
				receivedOn: "2026-09-16",
			});
			return receivedItemId;
		});
		await owner.receivedItems.archive({
			baseVersion: 1,
			opId: newOpId(),
			receivedItemId: ids[1] ?? "",
		});
		await owner.receivedItems.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { returnedOn: "2026-09-16" },
			receivedItemId: ids[2] ?? "",
		});
		clock.advance(25 * hour);
		expect((await collect(server, clock.now())).rows).toBe(0);
		expect(
			hashes.flatMap(({ photo, thumbnail }) => [
				hasFile(server, photo),
				hasFile(server, thumbnail),
			])
		).toEqual([true, true, true, true, true, true]);
	});

	test("keeps a photo that exists only in an open conflict until it is resolved", async () => {
		const setup: SyncSetup = await syncSetup(servers);
		const { server } = setup;
		const clientId = crypto.randomUUID();
		const id = crypto.randomUUID();
		const envelope = (input: Record<string, unknown>) => ({
			deviceId: setup.device.id,
			epoch: setup.epoch,
			occurredAt: "2026-09-17T12:00:00.000Z",
			opId: newOpId(),
			...input,
		});
		await setup.sync.sync.push({
			operations: [
				envelope({
					aggregateId: clientId,
					aggregateType: "client",
					baseVersion: null,
					command: "client.create",
					payload: { kind: "person", name: "Maria" },
				}),
				envelope({
					aggregateId: id,
					aggregateType: "receivedItem",
					baseVersion: null,
					command: "receivedItem.create",
					payload: {
						clientId,
						condition: "good",
						description: "Vestido",
						quantity: 1,
						receivedOn: "2026-09-17",
					},
				}),
			],
		});
		await setup.local.receivedItems.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { quantity: 2 },
			receivedItemId: id,
		});
		const hash = await upload(server, setup.remoteCookie, "conflito", true);
		const pushed = await setup.sync.sync.push({
			operations: [
				envelope({
					aggregateId: id,
					aggregateType: "receivedItem",
					baseVersion: 1,
					command: "receivedItem.update",
					payload: {
						photos: [{ caption: null, photoHash: hash, thumbnailHash: hash }],
					},
				}),
			],
		});
		const later = new Date(Date.now() + 25 * hour);
		await collect(server, later);
		expect(hasFile(server, hash)).toBe(true);
		await setup.sync.sync.resolve({
			choice: "keepServer",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "Fica o do PC",
		});
		await collect(server, later);
		expect([hasRow(server, hash), hasFile(server, hash)]).toEqual([
			false,
			false,
		]);
	});

	test("keeps a photo that remains only in the current values of an open conflict", async () => {
		const setup: SyncSetup = await syncSetup(servers);
		const { server } = setup;
		const clientId = crypto.randomUUID();
		const id = crypto.randomUUID();
		await setup.local.clients.create({
			clientId,
			kind: "person",
			name: "Maria",
			opId: newOpId(),
		});
		const hash = await upload(
			server,
			setup.remoteCookie,
			"atual-conflito",
			true
		);
		await setup.local.receivedItems.create({
			clientId,
			condition: "good",
			description: "Vestido",
			opId: newOpId(),
			photos: [{ caption: null, photoHash: hash, thumbnailHash: hash }],
			quantity: 1,
			receivedItemId: id,
			receivedOn: "2026-09-17",
		});
		await setup.local.receivedItems.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { quantity: 2 },
			receivedItemId: id,
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				{
					aggregateId: id,
					aggregateType: "receivedItem",
					baseVersion: 1,
					command: "receivedItem.update",
					deviceId: setup.device.id,
					epoch: setup.epoch,
					occurredAt: "2026-09-17T12:00:00.000Z",
					opId: newOpId(),
					payload: { notes: "Botão solto" },
				},
			],
		});
		expect(pushed.conflicts).toHaveLength(1);
		await setup.local.receivedItems.update({
			baseVersion: 2,
			opId: newOpId(),
			patch: { photos: [] },
			receivedItemId: id,
		});
		await collect(server, new Date(Date.now() + 25 * hour));
		expect([hasRow(server, hash), hasFile(server, hash)]).toEqual([true, true]);
	});

	test("keeps the photo of a material variant, archived included", async () => {
		const clock = manualClock();
		const { cookie, owner, server } = await ownerSetup({ now: clock.now });
		const materialId = crypto.randomUUID();
		const variantId = crypto.randomUUID();
		await owner.materials.create({
			materialId,
			name: "Gorgurão",
			opId: newOpId(),
		});
		const photo = await upload(server, cookie, "variante");
		const thumbnail = await upload(server, cookie, "variante-miniatura");
		await owner.materialVariants.create({
			baseUnit: "m",
			displayPrecision: 2,
			materialId,
			name: "Azul marinho",
			opId: newOpId(),
			photo: { photoHash: photo, thumbnailHash: thumbnail },
			variantId,
		});
		clock.advance(25 * hour);
		expect((await collect(server, clock.now())).rows).toBe(0);
		expect([hasFile(server, photo), hasFile(server, thumbnail)]).toEqual([
			true,
			true,
		]);
		await owner.materialVariants.archive({
			baseVersion: 1,
			opId: newOpId(),
			variantId,
		});
		clock.advance(25 * hour);
		expect((await collect(server, clock.now())).rows).toBe(0);
		expect([hasFile(server, photo), hasFile(server, thumbnail)]).toEqual([
			true,
			true,
		]);
	});

	test("keeps the variant photos of the live row and of both sides of an open conflict", async () => {
		const setup: SyncSetup = await syncSetup(servers);
		const { server } = setup;
		const materialId = crypto.randomUUID();
		const variantId = crypto.randomUUID();
		await setup.local.materials.create({
			materialId,
			name: "Gorgurão",
			opId: newOpId(),
		});
		const seeds = [
			"variante-atual",
			"variante-atual-mini",
			"variante-conflito",
			"variante-conflito-mini",
		];
		const [current, currentThumb, local, localThumb] = await inSequence(
			seeds,
			(seed) => upload(server, setup.remoteCookie, seed, true)
		);
		await setup.local.materialVariants.create({
			baseUnit: "m",
			displayPrecision: 2,
			materialId,
			name: "Azul marinho",
			opId: newOpId(),
			photo: { photoHash: current ?? "", thumbnailHash: currentThumb ?? "" },
			variantId,
		});
		await setup.local.materialVariants.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { name: "Azul royal" },
			variantId,
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				{
					aggregateId: variantId,
					aggregateType: "materialVariant",
					baseVersion: 1,
					command: "materialVariant.update",
					deviceId: setup.device.id,
					epoch: setup.epoch,
					occurredAt: "2026-09-17T12:00:00.000Z",
					opId: newOpId(),
					payload: {
						photo: { photoHash: local ?? "", thumbnailHash: localThumb ?? "" },
					},
				},
			],
		});
		expect(pushed.conflicts).toHaveLength(1);
		const later = new Date(Date.now() + 25 * hour);
		await collect(server, later);
		expect(
			[current, currentThumb, local, localThumb].map((photo) =>
				hasFile(server, photo ?? "")
			)
		).toEqual([true, true, true, true]);
		const replacement = await upload(
			server,
			setup.remoteCookie,
			"variante-nova",
			true
		);
		const replacementThumb = await upload(
			server,
			setup.remoteCookie,
			"variante-nova-mini",
			true
		);
		await setup.local.materialVariants.update({
			baseVersion: 2,
			opId: newOpId(),
			patch: {
				photo: { photoHash: replacement, thumbnailHash: replacementThumb },
			},
			variantId,
		});
		await collect(server, later);
		expect(
			[current, currentThumb, local, localThumb].map((photo) =>
				hasFile(server, photo ?? "")
			)
		).toEqual([true, true, true, true]);
		await setup.sync.sync.resolve({
			choice: "keepServer",
			conflictId: pushed.conflicts[0]?.conflictId ?? "",
			opId: newOpId(),
			reason: "Fica o do PC",
		});
		await collect(server, later);
		expect(
			[current, currentThumb, local, localThumb].map((photo) => [
				hasRow(server, photo ?? ""),
				hasFile(server, photo ?? ""),
			])
		).toEqual([
			[false, false],
			[false, false],
			[false, false],
			[false, false],
		]);
		expect(
			[replacement, replacementThumb].map((photo) =>
				hasFile(server, photo ?? "")
			)
		).toEqual([true, true]);
	});

	test("collects thousands of referenced old photos without reading every item per photo", async () => {
		const { owner, server } = await ownerSetup();
		const clientId = crypto.randomUUID();
		await owner.clients.create({
			clientId,
			kind: "person",
			name: "Maria",
			opId: newOpId(),
		});
		const native = server.native();
		const count = 2000;
		const old = Date.now() - 48 * hour;
		native.transaction(() => {
			for (let index = 0; index < count; index += 1) {
				const hash = index.toString(16).padStart(64, "0");
				native.run(
					"INSERT INTO media_file (hash, mime, byte_size, uploaded_at) VALUES (?, 'image/jpeg', 10, ?)",
					[hash, old]
				);
				native.run(
					"INSERT INTO received_item (id, client_id, description, condition, quantity, photos, received_on, created_at, updated_at, version) VALUES (?, ?, 'Vestido', 'good', 1, ?, '2026-09-17', 0, 0, 1)",
					[
						crypto.randomUUID(),
						clientId,
						JSON.stringify([
							{ caption: null, photoHash: hash, thumbnailHash: hash },
						]),
					]
				);
			}
		})();
		const started = performance.now();
		const result = await collect(server, new Date());
		const elapsed = performance.now() - started;
		expect(result.rows).toBe(0);
		expect(elapsed).toBeLessThan(1000);
	}, 60_000);

	test("the schedule collects at start and again on each interval until stopped", async () => {
		const { server } = await ownerSetup();
		const first = mediaPath(server.mediaRoot, "e".repeat(64), "image/jpeg");
		await aged(first, new Date(), 25 * hour);
		const stop = startMediaCollection({
			db: server.db,
			intervalMs: 30,
			mediaRoot: server.mediaRoot,
			onError: () => undefined,
		});
		try {
			await expect(waitFor(() => !existsSync(first))).resolves.toBe(true);
			const second = mediaPath(server.mediaRoot, "f".repeat(64), "image/jpeg");
			await aged(second, new Date(), 25 * hour);
			await expect(waitFor(() => !existsSync(second))).resolves.toBe(true);
		} finally {
			stop();
		}
		await delay(150);
		const third = mediaPath(server.mediaRoot, "9".repeat(64), "image/jpeg");
		await aged(third, new Date(), 25 * hour);
		await delay(150);
		expect(existsSync(third)).toBe(true);
	});

	test("removes files without row and temporaries by their age", async () => {
		const { server } = await ownerSetup();
		const now = new Date();
		const oldFile = mediaPath(server.mediaRoot, "c".repeat(64), "image/webp");
		const youngFile = mediaPath(server.mediaRoot, "d".repeat(64), "image/jpeg");
		const misplacedFile = join(
			server.mediaRoot,
			"12",
			"34",
			`${"a".repeat(64)}.jpg`
		);
		const oldTemporary = join(server.mediaRoot, "tmp", "antigo.part");
		const youngTemporary = join(server.mediaRoot, "tmp", "novo.part");
		await aged(oldFile, now, 25 * hour);
		await aged(youngFile, now, 23 * hour);
		await aged(misplacedFile, now, 25 * hour);
		await aged(oldTemporary, now, 2 * hour);
		await aged(youngTemporary, now, hour / 2);
		expect(await collect(server, now)).toEqual({
			files: 2,
			rows: 0,
			temporary: 1,
		});
		expect(
			[oldFile, youngFile, misplacedFile, oldTemporary, youngTemporary].map(
				(path) => existsSync(path)
			)
		).toEqual([false, true, false, false, true]);
	});

	test("an absent media folder is not an error", async () => {
		const { server } = await ownerSetup();
		expect(await collect(server, new Date())).toEqual({
			files: 0,
			rows: 0,
			temporary: 0,
		});
	});
});
