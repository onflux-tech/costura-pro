import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

export class BackupFolderError extends Error {}

export type FolderEntry = { name: string; path: string };

export type FolderListing = {
	folders: FolderEntry[];
	parent: string | null;
	path: string | null;
};

const windowsDrivePath = /^[a-z]:[\\/]/i;
const driveLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const missingCodes = new Set(["ENOENT"]);
const notFolderCodes = new Set(["ENOTDIR"]);
const deniedCodes = new Set(["EACCES", "EPERM", "EROFS"]);

function errorCode(error: unknown): string {
	return error instanceof Error && "code" in error ? String(error.code) : "";
}

function folderMessage(error: unknown, denied: string): string {
	const code = errorCode(error);
	if (missingCodes.has(code)) {
		return "Pasta não encontrada";
	}
	if (notFolderCodes.has(code)) {
		return "Não é uma pasta";
	}
	if (deniedCodes.has(code)) {
		return denied;
	}
	return "Não foi possível acessar a pasta";
}

function assertAbsolute(path: string): void {
	if (!(isAbsolute(path) || windowsDrivePath.test(path))) {
		throw new BackupFolderError("Caminho deve ser absoluto");
	}
}

function roots(): FolderEntry[] {
	if (process.platform !== "win32") {
		return [{ name: "/", path: "/" }];
	}
	return Array.from(driveLetters)
		.filter((letter) => existsSync(`${letter}:\\`))
		.map((letter) => ({ name: `${letter}:`, path: `${letter}:\\` }));
}

export async function listFolders(path?: string): Promise<FolderListing> {
	if (path === undefined || path === "") {
		return { folders: roots(), parent: null, path: null };
	}
	assertAbsolute(path);
	const entries = await readdir(path, { withFileTypes: true }).catch(
		(error: unknown) => {
			throw new BackupFolderError(
				folderMessage(error, "Sem permissão de leitura")
			);
		}
	);
	const folders = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => ({ name: entry.name, path: join(path, entry.name) }))
		.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
	const parent = dirname(path);
	return { folders, parent: parent === path ? null : parent, path };
}

export async function testBackupFolder(path: string): Promise<void> {
	assertAbsolute(path);
	const info = await stat(path).catch((error: unknown) => {
		throw new BackupFolderError(
			folderMessage(error, "Sem permissão de gravação")
		);
	});
	if (!info.isDirectory()) {
		throw new BackupFolderError("Não é uma pasta");
	}
	const file = join(path, `costura-pro-teste-${randomUUID()}.tmp`);
	const content = randomBytes(32).toString("hex");
	await writeFile(file, content, { flag: "wx" }).catch((error: unknown) => {
		throw new BackupFolderError(
			folderMessage(error, "Sem permissão de gravação")
		);
	});
	try {
		if ((await readFile(file, "utf8")) !== content) {
			throw new BackupFolderError("Leitura diferente da gravação");
		}
	} finally {
		await rm(file, { force: true });
	}
}
