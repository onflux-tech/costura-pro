import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
	readInstallation,
	updateInstallation,
} from "@costura-pro/api/installation/store";

import {
	inSequence,
	ownerPassword,
	ownerUsername,
	rpc,
	sessionCookie,
	signIn,
	startTestServer,
	type TestServer,
} from "./support";

const recoveryCodeFormat = /^[\dA-HJKMNP-TV-Z]{4}(?:-[\dA-HJKMNP-TV-Z]{4}){3}$/;

const servers: TestServer[] = [];
const folders: string[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
	await Promise.all(
		folders
			.splice(0)
			.map((folder) => rm(folder, { force: true, recursive: true }))
	);
});

async function freshServer() {
	const server = await startTestServer();
	servers.push(server);
	return server;
}

async function temporaryFolder() {
	const folder = await mkdtemp(join(tmpdir(), "costura-pro-backup-"));
	folders.push(folder);
	return folder;
}

function installationRow(server: TestServer) {
	return server
		.native()
		.query<{ owner: string | null; state: string; version: number }, []>(
			"SELECT owner_user_id AS owner, state, version FROM installation"
		)
		.get();
}

function opId() {
	return crypto.randomUUID();
}

function nameAtelier(server: TestServer) {
	const version = installationRow(server)?.version ?? 0;
	return rpc(server).installation.setAtelierName({
		atelierName: "Ateliê da Dona",
		baseVersion: version,
		opId: opId(),
	});
}

async function createOwner(server: TestServer) {
	await nameAtelier(server);
	await rpc(server).installation.createOwner({
		opId: opId(),
		password: ownerPassword,
		username: ownerUsername,
	});
	return sessionCookie(await signIn(server));
}

async function throughRecovery(server: TestServer) {
	const cookie = await createOwner(server);
	const client = rpc(server, { cookie });
	const { codes } = await client.installation.generateRecoveryCodes({
		opId: opId(),
	});
	await client.installation.confirmRecoveryCodes({ opId: opId() });
	return { client, codes, cookie };
}

async function ready(server: TestServer) {
	const context = await throughRecovery(server);
	await context.client.installation.testBackupFolder({
		opId: opId(),
		path: await temporaryFolder(),
	});
	await context.client.installation.finish({ opId: opId() });
	return context;
}

describe("wizard happy path", () => {
	test("walks every state on local access", async () => {
		const server = await freshServer();
		const states: string[] = [];
		const record = async () => {
			states.push((await rpc(server).installation.status()).state);
		};
		await record();
		await nameAtelier(server);
		await record();
		const cookie = await createOwner(server);
		await record();
		const client = rpc(server, { cookie });
		const { codes } = await client.installation.generateRecoveryCodes({
			opId: opId(),
		});
		expect(codes).toHaveLength(10);
		expect(new Set(codes).size).toBe(10);
		for (const code of codes) {
			expect(code).toMatch(recoveryCodeFormat);
		}
		await client.installation.confirmRecoveryCodes({ opId: opId() });
		await record();
		const roots = await client.installation.listFolders({});
		expect(roots.folders.length).toBeGreaterThan(0);
		for (const root of roots.folders) {
			expect(isAbsolute(root.path)).toBe(true);
		}
		const backup = await temporaryFolder();
		const result = await client.installation.testBackupFolder({
			opId: opId(),
			path: backup,
		});
		expect(result.ok).toBe(true);
		await record();
		await client.installation.finish({ opId: opId() });
		await record();
		expect(states).toEqual([
			"empty",
			"atelier",
			"account",
			"recovery",
			"backup",
			"ready",
		]);
		const types = server
			.native()
			.query<{ type: string }, []>("SELECT type FROM audit_event")
			.all()
			.map((row) => row.type);
		expect(types).toEqual(
			expect.arrayContaining([
				"installation.created",
				"installation.atelier_named",
				"owner.created",
				"recovery_codes.generated",
				"recovery_codes.confirmed",
				"backup_folder.tested",
				"installation.ready",
			])
		);
	});
});

describe("access rules", () => {
	test("remote access gets FORBIDDEN on every wizard step", async () => {
		const server = await freshServer();
		const remote = rpc(server, { access: "remote" });
		const attempts = [
			() =>
				remote.installation.setAtelierName({
					atelierName: "Invasor",
					baseVersion: 1,
					opId: opId(),
				}),
			() =>
				remote.installation.createOwner({
					opId: opId(),
					password: ownerPassword,
					username: "invasor",
				}),
			() => remote.installation.generateRecoveryCodes({ opId: opId() }),
			() => remote.installation.confirmRecoveryCodes({ opId: opId() }),
			() => remote.installation.listFolders({}),
			() =>
				remote.installation.testBackupFolder({ opId: opId(), path: tmpdir() }),
			() => remote.installation.finish({ opId: opId() }),
			() =>
				remote.recovery.resetPassword({
					code: "0000-0000-0000-0000",
					newPassword: "outra-senha-forte",
					opId: opId(),
				}),
		];
		const codes = await inSequence(attempts, (attempt) =>
			attempt().then(
				() => "ok",
				(error: { code?: string }) => error.code
			)
		);
		expect(codes).toEqual(attempts.map(() => "FORBIDDEN"));
		expect(installationRow(server)?.state).toBe("empty");
	});

	test("naming the atelier needs a session once the owner exists", async () => {
		const server = await freshServer();
		await createOwner(server);
		await expect(
			rpc(server).installation.setAtelierName({
				atelierName: "Outro nome",
				baseVersion: installationRow(server)?.version ?? 0,
				opId: opId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	test("steps out of order answer PRECONDITION_FAILED", async () => {
		const server = await freshServer();
		await expect(
			rpc(server).installation.createOwner({
				opId: opId(),
				password: ownerPassword,
				username: ownerUsername,
			})
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		const cookie = await createOwner(server);
		const client = rpc(server, { cookie });
		await expect(
			client.installation.confirmRecoveryCodes({ opId: opId() })
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		await expect(
			client.installation.finish({ opId: opId() })
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
	});

	test("privateData waits for the ready state", async () => {
		const server = await freshServer();
		const { client } = await throughRecovery(server);
		await expect(client.privateData()).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
		});
		await client.installation.testBackupFolder({
			opId: opId(),
			path: await temporaryFolder(),
		});
		await client.installation.finish({ opId: opId() });
		expect(await client.privateData()).toMatchObject({
			message: "This is private",
		});
	});
});

describe("installation details", () => {
	test("local access reads the wizard data without a session before the account", async () => {
		const server = await freshServer();
		expect(await rpc(server).installation.details()).toEqual({
			atelierName: null,
			backupFolder: null,
			backupTestedAt: null,
			version: 1,
		});
		await nameAtelier(server);
		expect(await rpc(server).installation.details()).toEqual({
			atelierName: "Ateliê da Dona",
			backupFolder: null,
			backupTestedAt: null,
			version: 2,
		});
	});

	test("needs the owner session from the account step on", async () => {
		const server = await freshServer();
		const cookie = await createOwner(server);
		await expect(rpc(server).installation.details()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(await rpc(server, { cookie }).installation.details()).toMatchObject({
			atelierName: "Ateliê da Dona",
		});
	});

	test("remote access never reads the wizard data", async () => {
		const server = await freshServer();
		await expect(
			rpc(server, { access: "remote" }).installation.details()
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const { cookie } = await ready(server);
		await expect(
			rpc(server, { access: "remote", cookie }).installation.details()
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("shows the tested backup folder with the current version", async () => {
		const server = await freshServer();
		const { client } = await throughRecovery(server);
		const folder = await temporaryFolder();
		const { testedAt } = await client.installation.testBackupFolder({
			opId: opId(),
			path: folder,
		});
		expect(await client.installation.details()).toEqual({
			atelierName: "Ateliê da Dona",
			backupFolder: folder,
			backupTestedAt: testedAt,
			version: installationRow(server)?.version ?? 0,
		});
	});
});

describe("single owner", () => {
	test("two concurrent createOwner calls create one user", async () => {
		const server = await freshServer();
		await nameAtelier(server);
		const results = await Promise.allSettled([
			rpc(server).installation.createOwner({
				opId: opId(),
				password: ownerPassword,
				username: ownerUsername,
			}),
			rpc(server).installation.createOwner({
				opId: opId(),
				password: "outra-senha-forte",
				username: "segundo.dono",
			}),
		]);
		expect(results.map((result) => result.status).sort()).toEqual([
			"fulfilled",
			"rejected",
		]);
		const rejected = results.find((result) => result.status === "rejected");
		expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
			code: "PRECONDITION_FAILED",
		});
		expect(
			server
				.native()
				.query(
					"SELECT count(*) AS failures FROM audit_event WHERE type = 'owner.bootstrap_failed'"
				)
				.get()
		).toEqual({ failures: 0 });
		expect(
			server.native().query("SELECT count(*) AS users FROM user").get()
		).toEqual({ users: 1 });
		expect(installationRow(server)?.owner).not.toBeNull();
	});

	test("a direct server-side sign-up after the bootstrap creates no user", async () => {
		const server = await freshServer();
		await createOwner(server);
		await server.auth.api
			.signUpEmail({
				body: {
					email: "segundo@costura-pro.local",
					name: "segundo",
					password: "outra-senha-forte",
					username: "segundo",
				},
			})
			.catch(() => null);
		expect(
			server.native().query("SELECT count(*) AS users FROM user").get()
		).toEqual({ users: 1 });
	});

	test("a failed owner creation releases the slot with an audit event", async () => {
		const server = await freshServer();
		await nameAtelier(server);
		server
			.native()
			.run(
				"INSERT INTO user (id, name, email, email_verified, username) VALUES ('intruso', 'intruso', 'intruso@costura-pro.local', 0, 'intruso')"
			);
		await expect(
			rpc(server).installation.createOwner({
				opId: opId(),
				password: ownerPassword,
				username: ownerUsername,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(installationRow(server)?.state).toBe("atelier");
		expect(
			server
				.native()
				.query(
					"SELECT outcome FROM audit_event WHERE type = 'owner.bootstrap_failed'"
				)
				.all()
		).toEqual([{ outcome: "failed" }]);
	});
});

describe("idempotency and versions", () => {
	test("setAtelierName checks the base version and replays by opId", async () => {
		const server = await freshServer();
		const id = opId();
		const input = { atelierName: "Ateliê da Dona", baseVersion: 1, opId: id };
		const first = await rpc(server).installation.setAtelierName(input);
		expect(first).toEqual({ version: 2 });
		expect(await rpc(server).installation.setAtelierName(input)).toEqual(first);
		expect(installationRow(server)?.version).toBe(2);
		await expect(
			rpc(server).installation.setAtelierName({
				...input,
				atelierName: "Outro",
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		await expect(
			rpc(server).installation.setAtelierName({
				atelierName: "Outro",
				baseVersion: 1,
				opId: opId(),
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { currentVersion: 2 },
		});
	});

	test("replaying generateRecoveryCodes never shows the codes again", async () => {
		const server = await freshServer();
		const cookie = await createOwner(server);
		const id = opId();
		const client = rpc(server, { cookie });
		expect(
			(await client.installation.generateRecoveryCodes({ opId: id })).codes
		).toHaveLength(10);
		expect(
			await client.installation.generateRecoveryCodes({ opId: id })
		).toEqual({ codes: [] });
	});
});

describe("recovery codes", () => {
	test("are stored only as SHA-256 of the normalized code", async () => {
		const server = await freshServer();
		const { codes } = await throughRecovery(server);
		const stored = server
			.native()
			.query<{ code_hash: string }, []>("SELECT code_hash FROM recovery_code")
			.all()
			.map((row) => row.code_hash)
			.sort();
		const expected = codes
			.map((code) =>
				createHash("sha256").update(code.replaceAll("-", "")).digest("hex")
			)
			.sort();
		expect(stored).toEqual(expected);
		const everything = JSON.stringify(
			server.native().query("SELECT * FROM recovery_code").all()
		);
		const operations = JSON.stringify(
			server.native().query("SELECT * FROM operation").all()
		);
		for (const code of codes) {
			expect(everything).not.toContain(code.replaceAll("-", ""));
			expect(operations).not.toContain(code.replaceAll("-", ""));
		}
		expect(operations).not.toContain(ownerPassword);
	});

	test("generating a new set invalidates the previous one", async () => {
		const server = await freshServer();
		const { client, codes } = await throughRecovery(server);
		await client.installation.generateRecoveryCodes({ opId: opId() });
		await expect(
			rpc(server).recovery.resetPassword({
				code: codes[0] ?? "",
				newPassword: "outra-senha-forte",
				opId: opId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	test("reset on local access consumes the code, changes the password and ends sessions", async () => {
		const server = await freshServer();
		const { codes, cookie } = await ready(server);
		const code = (codes[3] ?? "").toLowerCase().replaceAll("-", " ");
		await expect(
			rpc(server, { access: "remote" }).recovery.resetPassword({
				code,
				newPassword: "senha-do-invasor",
				opId: opId(),
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(
			await rpc(server).recovery.resetPassword({
				code,
				newPassword: "nova-senha-forte",
				opId: opId(),
			})
		).toEqual({ ok: true });
		await expect(rpc(server, { cookie }).privateData()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect((await signIn(server)).status).toBe(401);
		expect(
			(await signIn(server, { password: "nova-senha-forte" })).status
		).toBe(200);
		await expect(
			rpc(server).recovery.resetPassword({
				code,
				newPassword: "mais-uma-senha",
				opId: opId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(
			server
				.native()
				.query(
					"SELECT count(*) AS used FROM recovery_code WHERE used_at IS NOT NULL"
				)
				.get()
		).toEqual({ used: 1 });
		const types = server
			.native()
			.query<{ type: string }, []>("SELECT type FROM audit_event")
			.all()
			.map((row) => row.type);
		expect(types).toEqual(
			expect.arrayContaining([
				"recovery.password_reset",
				"recovery.code_rejected",
			])
		);
	});
});

describe("backup folder", () => {
	test("the test file is removed and nothing else is touched", async () => {
		const server = await freshServer();
		const { client } = await throughRecovery(server);
		const backup = await temporaryFolder();
		await writeFile(join(backup, "anterior.txt"), "dados antigos");
		await client.installation.testBackupFolder({ opId: opId(), path: backup });
		expect(await readdir(backup)).toEqual(["anterior.txt"]);
		expect(
			server
				.native()
				.query("SELECT backup_folder AS folder FROM installation")
				.get()
		).toEqual({ folder: backup });
	});

	test("rejects relative, missing and non-folder paths", async () => {
		const server = await freshServer();
		const { client } = await throughRecovery(server);
		const backup = await temporaryFolder();
		await writeFile(join(backup, "arquivo.txt"), "x");
		const cases: [string, string][] = [
			["backups", "Caminho deve ser absoluto"],
			[join(backup, "nao-existe"), "Pasta não encontrada"],
			[join(backup, "arquivo.txt"), "Não é uma pasta"],
		];
		const errors = await inSequence(cases, ([path]) =>
			client.installation.testBackupFolder({ opId: opId(), path }).then(
				() => null,
				(error: { code?: string; message?: string }) => ({
					code: error.code,
					message: error.message,
				})
			)
		);
		expect(errors).toEqual(
			cases.map(([, message]) => ({ code: "BAD_REQUEST", message }))
		);
		expect(installationRow(server)?.state).toBe("recovery");
	});

	test("lists only subfolders with their parent", async () => {
		const server = await freshServer();
		const { client } = await throughRecovery(server);
		const root = await temporaryFolder();
		await mkdir(join(root, "b"));
		await mkdir(join(root, "a"));
		await writeFile(join(root, "c.txt"), "x");
		const listing = await client.installation.listFolders({ path: root });
		expect(listing.folders).toEqual([
			{ name: "a", path: join(root, "a") },
			{ name: "b", path: join(root, "b") },
		]);
		expect(listing.path).toBe(root);
		expect(listing.parent).toBe(join(root, ".."));
	});
});

describe("review regressions", () => {
	test("the owner username is normalized before the account and the name are created", async () => {
		const server = await freshServer();
		await nameAtelier(server);
		await rpc(server).installation.createOwner({
			opId: opId(),
			password: ownerPassword,
			username: "Dona.Atelie",
		});
		expect(
			server.native().query("SELECT name, username FROM user").get()
		).toEqual({ name: "dona.atelie", username: "dona.atelie" });
		expect((await signIn(server, { username: "dona.atelie" })).status).toBe(
			200
		);
	});

	test("replaying a command with other secrets returns the recorded result", async () => {
		const server = await freshServer();
		await nameAtelier(server);
		const id = opId();
		const first = await rpc(server).installation.createOwner({
			opId: id,
			password: ownerPassword,
			username: ownerUsername,
		});
		expect(
			await rpc(server).installation.createOwner({
				opId: id,
				password: "outra-senha-qualquer",
				username: ownerUsername,
			})
		).toEqual(first);
	});

	test("the same reset opId sent twice at once succeeds once and is never rejected", async () => {
		const server = await freshServer();
		const { codes } = await ready(server);
		const input = {
			code: codes[1] ?? "",
			newPassword: "nova-senha-forte",
			opId: opId(),
		};
		const results = await Promise.all([
			rpc(server).recovery.resetPassword(input),
			rpc(server).recovery.resetPassword(input),
		]);
		expect(results).toEqual([{ ok: true }, { ok: true }]);
		expect(
			server
				.native()
				.query(
					"SELECT count(*) AS rejected FROM audit_event WHERE type = 'recovery.code_rejected'"
				)
				.get()
		).toEqual({ rejected: 0 });
	});

	test("a reset without a recorded owner keeps the code unused", async () => {
		const server = await freshServer();
		const { codes } = await ready(server);
		server.native().run("UPDATE installation SET owner_user_id = NULL");
		await expect(
			rpc(server).recovery.resetPassword({
				code: codes[2] ?? "",
				newPassword: "nova-senha-forte",
				opId: opId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(
			server
				.native()
				.query(
					"SELECT count(*) AS used FROM recovery_code WHERE used_at IS NOT NULL"
				)
				.get()
		).toEqual({ used: 0 });
	});

	test("restarting after a crash before the account was created goes back to atelier", async () => {
		const server = await freshServer();
		await nameAtelier(server);
		server.native().run("UPDATE installation SET state = 'account'");
		server.reopen();
		expect((await rpc(server).installation.status()).state).toBe("atelier");
		await rpc(server).installation.createOwner({
			opId: opId(),
			password: ownerPassword,
			username: ownerUsername,
		});
		expect(installationRow(server)?.state).toBe("account");
	});

	test("restarting after a crash between the account and the owner link adopts the account", async () => {
		const server = await freshServer();
		await createOwner(server);
		server.native().run("UPDATE installation SET owner_user_id = NULL");
		server.reopen();
		expect(installationRow(server)?.owner).not.toBeNull();
		expect(installationRow(server)?.state).toBe("account");
	});

	test("a failed owner creation removes the orphan user so the next attempt works", async () => {
		const server = await freshServer();
		await nameAtelier(server);
		server
			.native()
			.run(
				"INSERT INTO user (id, name, email, email_verified, username) VALUES ('orfao', 'orfao', 'orfao@costura-pro.local', 0, 'orfao')"
			);
		await expect(
			rpc(server).installation.createOwner({
				opId: opId(),
				password: ownerPassword,
				username: ownerUsername,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await rpc(server).installation.createOwner({
			opId: opId(),
			password: ownerPassword,
			username: ownerUsername,
		});
		expect(server.native().query("SELECT username FROM user").all()).toEqual([
			{ username: ownerUsername },
		]);
	});

	test("an installation update over a stale version is refused without a change", async () => {
		const server = await freshServer();
		const stale = readInstallation(server.db);
		await nameAtelier(server);
		const changes = () =>
			server.native().query("SELECT count(*) AS changes FROM change_log").get();
		const before = changes();
		let refused: unknown;
		try {
			updateInstallation(
				server.db,
				stale,
				{ atelierName: "Nome antigo" },
				{ now: new Date(), opId: null }
			);
		} catch (error) {
			refused = error;
		}
		expect(refused).toMatchObject({ code: "CONFLICT" });
		expect(changes()).toEqual(before);
		expect(installationRow(server)?.version).toBe(2);
	});

	test("the OpenAPI prefix applies the same local access rule", async () => {
		const server = await freshServer();
		await nameAtelier(server);
		const response = await server.send(
			"/api-reference/installation/createOwner",
			{
				body: {
					opId: opId(),
					password: ownerPassword,
					username: "invasor",
				},
				headers: { "cf-connecting-ip": "203.0.113.50" },
				host: "costura.exemplo.com.br",
				method: "POST",
			}
		);
		expect(response.status).toBe(403);
		expect(installationRow(server)?.state).toBe("atelier");
	});
});
