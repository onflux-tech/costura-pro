import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate as yieldToServer } from "node:timers/promises";
import type { Database } from "@costura-pro/db";

import {
	errorCode,
	removeFileAt,
	removeMediaFile,
	temporaryFolder,
} from "./files";
import { withMediaLock } from "./lock";
import {
	deleteMediaFile,
	isMediaReferenced,
	listUnreferencedMediaFilesUploadedBefore,
	readMediaFile,
} from "./store";

const hour = 60 * 60 * 1000;
const orphanGrace = 24 * hour;
const temporaryGrace = hour;
const shardName = /^[0-9a-f]{2}$/;
const storedName = /^([0-9a-f]{64})\.(jpg|webp)$/;

export type CollectOptions = { db: Database; mediaRoot: string; now: Date };

export type CollectResult = { files: number; rows: number; temporary: number };

type StoredFile = { hash: string; path: string };

function countInOrder<T>(
	items: readonly T[],
	run: (item: T) => Promise<boolean>
): Promise<number> {
	return items.reduce<Promise<number>>(
		async (previous, item) => (await previous) + ((await run(item)) ? 1 : 0),
		Promise.resolve(0)
	);
}

async function entries(folder: string): Promise<string[]> {
	try {
		return await readdir(folder);
	} catch (error) {
		if (errorCode(error) === "ENOENT") {
			return [];
		}
		throw error;
	}
}

async function modifiedAt(path: string): Promise<number | null> {
	try {
		return (await stat(path)).mtimeMs;
	} catch (error) {
		if (errorCode(error) === "ENOENT") {
			return null;
		}
		throw error;
	}
}

async function succeeded(run: () => Promise<unknown>): Promise<boolean> {
	try {
		await run();
		return true;
	} catch {
		return false;
	}
}

function collectRows({ db, mediaRoot, now }: CollectOptions): Promise<number> {
	const cutoff = new Date(now.getTime() - orphanGrace);
	const candidates = listUnreferencedMediaFilesUploadedBefore(db, cutoff);
	return countInOrder(candidates, (candidate) =>
		withMediaLock(candidate.hash, async () => {
			await yieldToServer();
			const removed = db.transaction((tx) => {
				const row = readMediaFile(tx, candidate.hash);
				if (
					!row ||
					row.uploadedAt > cutoff ||
					isMediaReferenced(tx, row.hash)
				) {
					return false;
				}
				deleteMediaFile(tx, row.hash);
				return true;
			});
			if (removed) {
				await succeeded(() =>
					removeMediaFile(mediaRoot, candidate.hash, candidate.mime)
				);
			}
			return removed;
		})
	);
}

async function storedFiles(mediaRoot: string): Promise<StoredFile[]> {
	const firstLevel = (await entries(mediaRoot)).filter((name) =>
		shardName.test(name)
	);
	const found = await Promise.all(
		firstLevel.map(async (first) => {
			const secondLevel = (await entries(join(mediaRoot, first))).filter(
				(name) => shardName.test(name)
			);
			const nested = await Promise.all(
				secondLevel.map(async (second) =>
					(await entries(join(mediaRoot, first, second))).flatMap((name) => {
						const match = storedName.exec(name);
						const hash = match?.[1];
						if (!hash) {
							return [];
						}
						return [{ hash, path: join(mediaRoot, first, second, name) }];
					})
				)
			);
			return nested.flat();
		})
	);
	return found.flat();
}

async function collectFiles({
	db,
	mediaRoot,
	now,
}: CollectOptions): Promise<number> {
	const cutoff = now.getTime() - orphanGrace;
	return countInOrder(await storedFiles(mediaRoot), (file) =>
		withMediaLock(file.hash, async () => {
			if (readMediaFile(db, file.hash)) {
				return false;
			}
			const modified = await modifiedAt(file.path);
			if (modified === null || modified > cutoff) {
				return false;
			}
			return succeeded(() => removeFileAt(file.path));
		})
	);
}

async function collectTemporary({
	mediaRoot,
	now,
}: CollectOptions): Promise<number> {
	const folder = temporaryFolder(mediaRoot);
	const cutoff = now.getTime() - temporaryGrace;
	return countInOrder(await entries(folder), async (name) => {
		const path = join(folder, name);
		const modified = await modifiedAt(path);
		if (modified === null || modified > cutoff) {
			return false;
		}
		return succeeded(() => rm(path, { force: true }));
	});
}

export async function collectMedia(
	options: CollectOptions
): Promise<CollectResult> {
	const rows = await collectRows(options);
	const files = await collectFiles(options);
	const temporary = await collectTemporary(options);
	return { files, rows, temporary };
}

export type MediaCollectionOptions = {
	db: Database;
	intervalMs: number;
	mediaRoot: string;
	now?: () => Date;
	onError: (error: unknown) => void;
};

export function startMediaCollection({
	db,
	intervalMs,
	mediaRoot,
	now = () => new Date(),
	onError,
}: MediaCollectionOptions): () => void {
	const state: { running: boolean } = { running: false };
	const run = () => {
		if (state.running) {
			return;
		}
		state.running = true;
		collectMedia({ db, mediaRoot, now: now() })
			.catch(onError)
			.finally(() => {
				state.running = false;
			});
	};
	run();
	const timer = setInterval(run, intervalMs);
	timer.unref();
	return () => clearInterval(timer);
}
