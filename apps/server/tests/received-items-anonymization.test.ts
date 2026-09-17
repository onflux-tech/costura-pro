import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspect } from "node:util";
import { collectMedia } from "@costura-pro/api/media/collect";
import { mediaPath } from "@costura-pro/api/media/files";

import {
	canonicalOrigin,
	completeWizard,
	inSequence,
	newOpId,
	rpc,
	type SyncSetup,
	startTestServer,
	syncSetup,
	type TestServer,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

const hour = 60 * 60 * 1000;

function jpeg(seed: string) {
	const bytes = new Uint8Array(1024);
	bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
	bytes.set(new TextEncoder().encode(seed), 8);
	return { bytes, hash: createHash("sha256").update(bytes).digest("hex") };
}

async function upload(setup: SyncSetup, seed: string) {
	const file = jpeg(seed);
	const response = await setup.server.send(`/api/media/${file.hash}`, {
		cookie: setup.remoteCookie,
		headers: { "cf-connecting-ip": "203.0.113.30" },
		host: canonicalOrigin.host,
		method: "PUT",
		raw: file.bytes,
	});
	expect([200, 201]).toContain(response.status);
	return file.hash;
}

function envelope(setup: SyncSetup, input: Record<string, unknown>) {
	return {
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: newOpId(),
		...input,
	};
}

const thumbnails = new Map<string, string>();

function photo(hash: string, caption: string | null = null) {
	return {
		caption,
		photoHash: hash,
		thumbnailHash: thumbnails.get(hash) ?? hash,
	};
}

function dump(server: TestServer): string {
	const native = server.native();
	return native
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table'"
		)
		.all()
		.map(({ name }) =>
			native
				.query<Record<string, unknown>, []>(`SELECT * FROM "${name}"`)
				.values()
				.flat()
				.map(String)
				.join(" ")
		)
		.join("\n");
}

function databaseBytes(server: TestServer) {
	return ["atelier.db", "atelier.db-wal"]
		.map((file) => join(server.directory, file))
		.filter((file) => existsSync(file))
		.map((file) => readFileSync(file).toString("latin1"))
		.join(" ");
}

function hasFile(server: TestServer, hash: string) {
	return existsSync(mediaPath(server.mediaRoot, hash, "image/jpeg"));
}

describe("received items anonymization", () => {
	test("removes texts, hashes and files of the client items and keeps the rest", async () => {
		const setup = await syncSetup(servers);
		const { local, server } = setup;
		const maria = crypto.randomUUID();
		const tereza = crypto.randomUUID();
		await inSequence(
			[
				{ clientId: maria, name: "Maria Beatriz Alencar" },
				{ clientId: tereza, name: "Tereza Nogueira" },
			],
			(client) =>
				local.clients.create({ ...client, kind: "person", opId: newOpId() })
		);
		const [
			current,
			removed,
			archivedPhoto,
			conflictOpen,
			conflictMerged,
			shared,
		] = await inSequence(
			["atual", "removida", "arquivada", "aberto", "mesclado", "compartilhada"],
			async (seed) => {
				const hash = await upload(setup, seed);
				thumbnails.set(hash, await upload(setup, `${seed}-miniatura`));
				return hash;
			}
		);
		const active = crypto.randomUUID();
		const archived = crypto.randomUUID();
		const other = crypto.randomUUID();
		await local.receivedItems.create({
			accessories: "Cinto bordado",
			clientId: maria,
			condition: "damaged",
			description: "Vestido de noiva da Maria",
			notes: "Botão lascado",
			opId: newOpId(),
			photos: [photo(current ?? "", "frente-única"), photo(removed ?? "")],
			quantity: 1,
			receivedItemId: active,
			receivedOn: "2026-09-17",
		});
		await local.receivedItems.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: {
				photos: [photo(current ?? "", "frente-única"), photo(shared ?? "")],
			},
			receivedItemId: active,
		});
		await local.receivedItems.create({
			clientId: maria,
			condition: "worn",
			description: "Saia antiga da Maria",
			opId: newOpId(),
			photos: [photo(archivedPhoto ?? "")],
			quantity: 1,
			receivedItemId: archived,
			receivedOn: "2026-09-10",
		});
		await local.receivedItems.archive({
			baseVersion: 1,
			opId: newOpId(),
			receivedItemId: archived,
		});
		const archivedAt = (
			await local.receivedItems.list({ clientId: maria })
		).items.find((item) => item.id === archived)?.archivedAt;
		await local.receivedItems.create({
			clientId: tereza,
			condition: "good",
			description: "Blazer da Tereza",
			opId: newOpId(),
			photos: [photo(shared ?? "")],
			quantity: 1,
			receivedItemId: other,
			receivedOn: "2026-09-17",
		});
		const pushed = await setup.sync.sync.push({
			operations: [
				envelope(setup, {
					aggregateId: active,
					aggregateType: "receivedItem",
					baseVersion: 1,
					command: "receivedItem.update",
					payload: { photos: [photo(conflictOpen ?? "")] },
				}),
				envelope(setup, {
					aggregateId: active,
					aggregateType: "receivedItem",
					baseVersion: 1,
					command: "receivedItem.update",
					payload: { photos: [photo(conflictMerged ?? "")] },
				}),
			],
		});
		await setup.sync.sync.resolve({
			choice: "merge",
			conflictId: pushed.conflicts[1]?.conflictId ?? "",
			opId: newOpId(),
			reason: "Só a quantidade",
			values: { quantity: 2 },
		});
		const own = [
			current,
			removed,
			archivedPhoto,
			conflictOpen,
			conflictMerged,
		].flatMap((hash) => [hash ?? "", thumbnails.get(hash ?? "") ?? ""]);
		expect(new Set(own).size).toBe(10);
		const texts = [
			"Vestido de noiva da Maria",
			"Saia antiga da Maria",
			"Cinto bordado",
			"Botão lascado",
			"frente-única",
		];
		expect(dump(server)).toContain("Vestido de noiva da Maria");
		const {
			client: { version },
		} = await local.clients.get({ clientId: maria });
		const opId = newOpId();
		const result = await local.clients.anonymize({
			baseVersion: version,
			clientId: maria,
			opId,
		});
		const text = dump(server);
		expect(
			[...texts, ...own].filter((piece) => text.includes(piece ?? ""))
		).toEqual([]);
		expect(text).toContain("Blazer da Tereza");
		const pulled = JSON.stringify(
			await setup.sync.sync.pull({
				cursor: "0",
				epoch: setup.epoch,
				limit: 500,
			})
		);
		expect(
			[...texts, ...own].filter((piece) => pulled.includes(piece ?? ""))
		).toEqual([]);
		const bytes = databaseBytes(server);
		expect(
			[...texts, ...own].filter((piece) => bytes.includes(piece ?? ""))
		).toEqual([]);
		expect(own.filter((hash) => hasFile(server, hash))).toEqual([]);
		expect(
			server
				.native()
				.query<{ hash: string }, []>("SELECT hash FROM media_file")
				.all()
				.map((row) => row.hash)
				.filter((hash) => own.includes(hash))
		).toEqual([]);
		expect(hasFile(server, shared ?? "")).toBe(true);
		expect(hasFile(server, thumbnails.get(shared ?? "") ?? "")).toBe(true);
		const { items } = await local.receivedItems.list({ clientId: maria });
		expect(items.map((item) => item.description)).toEqual([
			"Peça anonimizada",
			"Peça anonimizada",
		]);
		expect(
			items.every((item) => item.photos.length === 0 && item.archivedAt)
		).toBe(true);
		expect(items.find((item) => item.id === archived)?.archivedAt).toBe(
			archivedAt
		);
		expect(
			server
				.native()
				.query<{ details: string }, []>(
					"SELECT details FROM audit_event WHERE type = 'client.anonymized'"
				)
				.all()
				.map((row) => JSON.parse(row.details))
		).toEqual([
			{ clientId: maria, measurements: 0, profiles: 0, receivedItems: 2 },
		]);
		expect(
			await local.clients.anonymize({
				baseVersion: version,
				clientId: maria,
				opId,
			})
		).toEqual(result);
	});

	test("a photo sent after anonymizing goes away with the collection", async () => {
		const setup = await syncSetup(servers);
		const { local, server } = setup;
		const clientId = crypto.randomUUID();
		const id = crypto.randomUUID();
		await local.clients.create({
			clientId,
			kind: "person",
			name: "Maria",
			opId: newOpId(),
		});
		await local.receivedItems.create({
			clientId,
			condition: "good",
			description: "Vestido",
			opId: newOpId(),
			quantity: 1,
			receivedItemId: id,
			receivedOn: "2026-09-17",
		});
		await local.clients.anonymize({
			baseVersion: 1,
			clientId,
			opId: newOpId(),
		});
		const late = await upload(setup, "tardia");
		const pushed = await setup.sync.sync.push({
			operations: [
				envelope(setup, {
					aggregateId: id,
					aggregateType: "receivedItem",
					baseVersion: 2,
					command: "receivedItem.update",
					payload: { photos: [photo(late)] },
				}),
			],
		});
		expect(pushed.quarantined.map((item) => item.reason)).toEqual([
			"aggregateAnonymized",
		]);
		await collectMedia({
			db: server.db,
			mediaRoot: server.mediaRoot,
			now: new Date(Date.now() + 25 * hour),
		});
		expect(hasFile(server, late)).toBe(false);
	});

	test("a file that cannot be removed does not fail the anonymization", async () => {
		const server = await startTestServer();
		servers.push(server);
		const { cookie } = await completeWizard(server);
		const owner = rpc(server, { cookie });
		const file = jpeg("presa");
		await server.send(`/api/media/${file.hash}`, {
			cookie,
			method: "PUT",
			raw: file.bytes,
		});
		const clientId = crypto.randomUUID();
		await owner.clients.create({
			clientId,
			kind: "person",
			name: "Maria",
			opId: newOpId(),
		});
		await owner.receivedItems.create({
			clientId,
			condition: "good",
			description: "Vestido",
			opId: newOpId(),
			photos: [photo(file.hash)],
			quantity: 1,
			receivedItemId: crypto.randomUUID(),
			receivedOn: "2026-09-17",
		});
		const target = mediaPath(server.mediaRoot, file.hash, "image/jpeg");
		await rm(target);
		await mkdir(target);
		await writeFile(join(target, "bloqueio"), "x");
		const spy = spyOn(console, "error").mockImplementation(() => undefined);
		const opId = newOpId();
		try {
			const result = await owner.clients.anonymize({
				baseVersion: 1,
				clientId,
				opId,
			});
			expect(result.version).toBe(2);
			const printed = inspect(spy.mock.calls, { depth: 10 });
			expect(printed).toContain("media.anonymize");
			expect(printed).not.toContain(file.hash);
			expect(
				await owner.clients.anonymize({ baseVersion: 1, clientId, opId })
			).toEqual(result);
		} finally {
			spy.mockRestore();
		}
	}, 15_000);
});
