import { createHash, randomUUID } from "node:crypto";
import {
	mkdir,
	open,
	readFile,
	rename,
	rm,
	stat,
	unlink,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type MediaType, mediaExtension } from "@costura-pro/domain/media";

const retryableCodes = new Set(["EACCES", "EBUSY", "EPERM"]);
const retryDelays = [50, 100, 200, 400, 800];

export function mediaPath(root: string, hash: string, type: MediaType): string {
	return join(
		root,
		hash.slice(0, 2),
		hash.slice(2, 4),
		`${hash}.${mediaExtension(type)}`
	);
}

export function temporaryFolder(root: string): string {
	return join(root, "tmp");
}

export function sha256Hex(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

export function errorCode(error: unknown): string | null {
	return typeof error === "object" && error !== null && "code" in error
		? String(error.code)
		: null;
}

async function retrying<T>(run: () => Promise<T>, attempt = 0): Promise<T> {
	try {
		return await run();
	} catch (error) {
		const wait = retryDelays[attempt];
		if (wait === undefined || !retryableCodes.has(errorCode(error) ?? "")) {
			throw error;
		}
		await delay(wait);
		return retrying(run, attempt + 1);
	}
}

async function orNullWhenMissing<T>(run: () => Promise<T>): Promise<T | null> {
	try {
		return await run();
	} catch (error) {
		if (errorCode(error) === "ENOENT") {
			return null;
		}
		throw error;
	}
}

export function storedSize(
	root: string,
	hash: string,
	type: MediaType
): Promise<number | null> {
	return orNullWhenMissing(
		async () => (await stat(mediaPath(root, hash, type))).size
	);
}

export async function readMediaBytes(
	root: string,
	hash: string,
	type: MediaType
): Promise<Uint8Array<ArrayBuffer> | null> {
	const bytes = await orNullWhenMissing(() =>
		readFile(mediaPath(root, hash, type))
	);
	return bytes === null ? null : new Uint8Array(bytes);
}

async function syncFolder(folder: string) {
	if (process.platform === "win32") {
		return;
	}
	const handle = await open(folder, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

export async function writeMediaFile(
	root: string,
	hash: string,
	type: MediaType,
	bytes: Uint8Array
): Promise<void> {
	const target = mediaPath(root, hash, type);
	const temporary = join(temporaryFolder(root), `${randomUUID()}.part`);
	await mkdir(temporaryFolder(root), { recursive: true });
	await mkdir(dirname(target), { recursive: true });
	try {
		const handle = await open(temporary, "wx");
		try {
			await handle.writeFile(bytes);
			await handle.sync();
		} finally {
			await handle.close();
		}
		const existing = await orNullWhenMissing(() => readFile(target));
		if (existing !== null && sha256Hex(existing) === hash) {
			return;
		}
		if (existing !== null) {
			await retrying(() => unlink(target));
		}
		await retrying(() => rename(temporary, target));
		await syncFolder(dirname(target));
	} finally {
		await rm(temporary, { force: true }).catch(() => undefined);
	}
}

export async function removeFileAt(path: string): Promise<void> {
	await orNullWhenMissing(() => retrying(() => unlink(path)));
}

export function removeMediaFile(
	root: string,
	hash: string,
	type: MediaType
): Promise<void> {
	return removeFileAt(mediaPath(root, hash, type));
}
