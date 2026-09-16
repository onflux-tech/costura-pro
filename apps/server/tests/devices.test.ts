import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
	completeWizard,
	manualClock,
	newOpId,
	rpc,
	sessionCookie,
	signIn,
	startTestServer,
	type TestServer,
} from "./support";

const deviceSecretFormat = /^[\w-]{43}$/;
const activationCodeFormat = /^[\dA-HJKMNP-TV-Z]{4}-[\dA-HJKMNP-TV-Z]{4}$/;

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function readyServer(now?: () => Date) {
	const server = await startTestServer({ now });
	servers.push(server);
	const { cookie } = await completeWizard(server);
	const remoteCookie = sessionCookie(
		await signIn(server, { access: "remote", ip: "203.0.113.20" })
	);
	return {
		local: rpc(server, { cookie }),
		remote: rpc(server, { access: "remote", cookie: remoteCookie }),
		server,
	};
}

function deviceChanges(server: TestServer, deviceId: string) {
	return server
		.native()
		.query<{ version: number }, [string]>(
			"SELECT version FROM change_log WHERE aggregate_type = 'device' AND aggregate_id = ? ORDER BY cursor"
		)
		.all(deviceId)
		.map((row) => row.version);
}

describe("direct approval", () => {
	test("a remote registration starts pending and local access approves and revokes it", async () => {
		const { local, remote, server } = await readyServer();
		const registered = await remote.devices.register({
			name: "Celular da Dona",
			opId: newOpId(),
		});
		expect(registered.status).toBe("pending");
		expect(registered.deviceSecret).toMatch(deviceSecretFormat);
		const approved = await local.devices.approve({
			deviceId: registered.deviceId,
			opId: newOpId(),
		});
		expect(approved).toEqual({ status: "approved", version: 2 });
		const revoked = await local.devices.revoke({
			deviceId: registered.deviceId,
			opId: newOpId(),
		});
		expect(revoked).toEqual({ status: "revoked", version: 3 });
		expect(deviceChanges(server, registered.deviceId)).toEqual([1, 2, 3]);
		const [listed] = await local.devices.list();
		expect(listed).toMatchObject({
			id: registered.deviceId,
			name: "Celular da Dona",
			status: "revoked",
			version: 3,
		});
		expect(Object.keys(listed ?? {})).not.toContain("secretHash");
	});

	test("approval and revocation are local only", async () => {
		const { remote } = await readyServer();
		const { deviceId } = await remote.devices.register({
			name: "Celular",
			opId: newOpId(),
		});
		await expect(
			remote.devices.approve({ deviceId, opId: newOpId() })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			remote.devices.revoke({ deviceId, opId: newOpId() })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			remote.devices.createActivationCode({ opId: newOpId() })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(remote.devices.list()).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	test("registration needs a session and a ready installation", async () => {
		const server = await startTestServer();
		servers.push(server);
		await expect(
			rpc(server, { access: "remote" }).devices.register({
				name: "Celular",
				opId: newOpId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	test("replaying a registration returns the same device without the secret", async () => {
		const { remote } = await readyServer();
		const input = { name: "Celular", opId: newOpId() };
		const first = await remote.devices.register(input);
		const replay = await remote.devices.register(input);
		expect(replay).toEqual({ ...first, deviceSecret: null });
	});

	test("stores only hashes of secrets", async () => {
		const { remote, server } = await readyServer();
		const { deviceSecret } = await remote.devices.register({
			name: "Celular",
			opId: newOpId(),
		});
		const everything = JSON.stringify([
			server.native().query("SELECT * FROM device").all(),
			server.native().query("SELECT * FROM operation").all(),
			server.native().query("SELECT * FROM change_log").all(),
			server.native().query("SELECT * FROM audit_event").all(),
		]);
		expect(everything).not.toContain(deviceSecret ?? "sem-segredo");
	});
});

describe("activation code", () => {
	test("a device registered with a valid code is born approved and the code is single use", async () => {
		const { local, remote, server } = await readyServer();
		const { code, expiresAt } = await local.devices.createActivationCode({
			opId: newOpId(),
		});
		expect(code).toMatch(activationCodeFormat);
		expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
		const registered = await remote.devices.register({
			activationCode: (code ?? "").toLowerCase(),
			name: "Celular",
			opId: newOpId(),
		});
		expect(registered.status).toBe("approved");
		await expect(
			remote.devices.register({
				activationCode: code ?? "",
				name: "Outro",
				opId: newOpId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		const everything = JSON.stringify(
			server.native().query("SELECT * FROM device_activation_code").all()
		);
		expect(everything).not.toContain((code ?? "x").replace("-", ""));
	});

	test("an expired code is rejected", async () => {
		const clock = manualClock();
		const { local, remote } = await readyServer(clock.now);
		const { code } = await local.devices.createActivationCode({
			opId: newOpId(),
		});
		clock.advance(601_000);
		await expect(
			remote.devices.register({
				activationCode: code ?? "",
				name: "Celular",
				opId: newOpId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	test("a new code voids the previous one", async () => {
		const { local, remote } = await readyServer();
		const first = await local.devices.createActivationCode({ opId: newOpId() });
		const second = await local.devices.createActivationCode({
			opId: newOpId(),
		});
		await expect(
			remote.devices.register({
				activationCode: first.code ?? "",
				name: "Celular",
				opId: newOpId(),
			})
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(
			(
				await remote.devices.register({
					activationCode: second.code ?? "",
					name: "Celular",
					opId: newOpId(),
				})
			).status
		).toBe("approved");
	});
});

describe("review regressions", () => {
	test("replaying the activation code command never shows the code again", async () => {
		const { local, server } = await readyServer();
		const id = newOpId();
		const first = await local.devices.createActivationCode({ opId: id });
		const replay = await local.devices.createActivationCode({ opId: id });
		expect(replay).toEqual({ ...first, code: null });
		const operations = JSON.stringify(
			server.native().query("SELECT * FROM operation").all()
		);
		expect(operations).not.toContain((first.code ?? "x").replace("-", ""));
	});

	test("activation codes are not stored as a plain SHA-256", async () => {
		const { local, server } = await readyServer();
		const { code } = await local.devices.createActivationCode({
			opId: newOpId(),
		});
		const plain = createHash("sha256")
			.update((code ?? "").replace("-", ""))
			.digest("hex");
		const stored = server
			.native()
			.query<{ code_hash: string }, []>(
				"SELECT code_hash FROM device_activation_code"
			)
			.all()
			.map((row) => row.code_hash);
		expect(stored).toHaveLength(1);
		expect(stored).not.toContain(plain);
	});

	test("a loopback Host carrying cf-connecting-ip cannot list devices", async () => {
		const { server } = await readyServer();
		const cookie = sessionCookie(await signIn(server));
		const response = await server.send("/rpc/devices/list", {
			body: {},
			cookie,
			headers: { "cf-connecting-ip": "203.0.113.60" },
			method: "POST",
		});
		expect(response.status).toBe(403);
	});
});
