import { dirname, join } from "node:path";
import { notReadyMessage } from "@costura-pro/api";
import { readInstallation } from "@costura-pro/api/installation/store";
import {
	errorCode,
	readMediaBytes,
	sha256Hex,
	storedSize,
	writeMediaFile,
} from "@costura-pro/api/media/files";
import { withMediaLock } from "@costura-pro/api/media/lock";
import { readMediaFile, upsertMediaFile } from "@costura-pro/api/media/store";
import type { Auth } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";
import { isAtLeast } from "@costura-pro/domain/installation-state";
import {
	detectMediaType,
	type MediaType,
	mediaExtension,
	mediaHashPattern,
	mediaLimits,
} from "@costura-pro/domain/media";
import { Hono } from "hono";

export type MediaRouteOptions = {
	auth: Auth;
	db: Database;
	mediaRoot: string;
	now: () => Date;
};

const cacheControl = "private, max-age=31536000, immutable";

export function mediaRootFor(databaseFile: string): string {
	return join(dirname(databaseFile), "media");
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
	const bytes = new Uint8Array(total);
	chunks.reduce((offset, chunk) => {
		bytes.set(chunk, offset);
		return offset + chunk.byteLength;
	}, 0);
	return bytes;
}

function readLimited(
	request: Request,
	limit: number
): Promise<Uint8Array | null> {
	const declared = Number(request.headers.get("content-length") ?? "0");
	if (declared > limit) {
		return Promise.resolve(null);
	}
	if (!request.body) {
		return Promise.resolve(new Uint8Array());
	}
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	const next = async (total: number): Promise<Uint8Array | null> => {
		const { done, value } = await reader.read();
		if (done) {
			return concat(chunks, total);
		}
		const size = total + value.byteLength;
		if (size > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
		return next(size);
	};
	return next(0);
}

async function storeUpload(
	{ db, mediaRoot, now }: MediaRouteOptions,
	hash: string,
	mime: MediaType,
	bytes: Uint8Array
): Promise<200 | 201> {
	const row = readMediaFile(db, hash);
	const size = row ? await storedSize(mediaRoot, hash, row.mime) : null;
	const intact = row !== undefined && size === row.byteSize;
	if (!intact) {
		await writeMediaFile(mediaRoot, hash, mime, bytes);
	}
	upsertMediaFile(db, {
		byteSize: bytes.byteLength,
		hash,
		mime,
		uploadedAt: now(),
	});
	return intact ? 200 : 201;
}

export function mediaRoutes(options: MediaRouteOptions) {
	const { auth, db, mediaRoot } = options;
	const routes = new Hono();

	routes.use("*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session?.user) {
			return c.json({ message: "Sessão necessária" }, 401);
		}
		if (!isAtLeast(readInstallation(db).state, "ready")) {
			return c.json({ message: notReadyMessage }, 412);
		}
		await next();
	});

	routes.put("/:hash", async (c) => {
		const hash = c.req.param("hash");
		if (!mediaHashPattern.test(hash)) {
			return c.json({ message: "Hash inválido" }, 400);
		}
		const bytes = await readLimited(c.req.raw, mediaLimits.maxBytes);
		if (bytes === null) {
			return c.json({ message: "Arquivo maior que 4 MB" }, 413);
		}
		const mime = detectMediaType(bytes);
		if (mime === null) {
			return c.json({ message: "Formato não aceito" }, 415);
		}
		if (sha256Hex(bytes) !== hash) {
			return c.json({ message: "Hash não confere" }, 422);
		}
		try {
			const status = await withMediaLock(hash, () =>
				storeUpload(options, hash, mime, bytes)
			);
			return c.json({ byteSize: bytes.byteLength, hash, mime }, status);
		} catch (error) {
			console.error({ code: errorCode(error), scope: "media" });
			return c.json({ message: "Não foi possível gravar a foto" }, 500);
		}
	});

	routes.get("/:hash", async (c) => {
		const hash = c.req.param("hash");
		const row = mediaHashPattern.test(hash)
			? readMediaFile(db, hash)
			: undefined;
		try {
			const size = row ? await storedSize(mediaRoot, hash, row.mime) : null;
			if (!row || size === null) {
				return c.json({ message: "Foto não encontrada" }, 404);
			}
			const etag = `"${hash}"`;
			if (c.req.header("if-none-match") === etag) {
				return c.body(null, 304, { "cache-control": cacheControl, etag });
			}
			const bytes = await readMediaBytes(mediaRoot, hash, row.mime);
			if (!bytes) {
				return c.json({ message: "Foto não encontrada" }, 404);
			}
			const disposition =
				c.req.query("download") === "1"
					? `attachment; filename="foto-${hash.slice(0, 12)}.${mediaExtension(row.mime)}"`
					: "inline";
			return c.body(bytes, 200, {
				"cache-control": cacheControl,
				"content-disposition": disposition,
				"content-length": String(bytes.byteLength),
				"content-type": row.mime,
				etag,
				"x-content-type-options": "nosniff",
			});
		} catch (error) {
			console.error({ code: errorCode(error), scope: "media" });
			return c.json({ message: "Não foi possível ler a foto" }, 500);
		}
	});

	return routes;
}
