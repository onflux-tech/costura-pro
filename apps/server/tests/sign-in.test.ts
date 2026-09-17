import { afterEach, describe, expect, test } from "bun:test";

import {
	createOwnerDirect,
	inSequence,
	manualClock,
	ownerPassword,
	signIn,
	startTestServer,
	type TestServer,
	times,
} from "./support";

const attemptedUsername = "invasor.tentativa";
const wrongPassword = "senha-errada-000";
const manySignInsTimeoutMs = 30_000;
const lockedMessage = {
	message: "Muitas tentativas. Tente de novo mais tarde.",
};

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function ownerServer(now?: () => Date) {
	const server = await startTestServer({ now });
	servers.push(server);
	await createOwnerDirect(server);
	return server;
}

let ipCounter = 0;
function freshIp() {
	ipCounter += 1;
	return `198.51.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

async function wrongRemote(server: TestServer, ip = freshIp()) {
	const response = await signIn(server, {
		access: "remote",
		ip,
		password: wrongPassword,
		username: attemptedUsername,
	});
	return response.status;
}

async function wrongLocal(server: TestServer) {
	const response = await signIn(server, { password: wrongPassword });
	return response.status;
}

function failRemotely(server: TestServer, count: number) {
	return inSequence(times(count), () => wrongRemote(server));
}

function auditRows(server: TestServer) {
	return server
		.native()
		.query<
			{ access: string; details: string; ip: string | null; outcome: string },
			[]
		>(
			"SELECT access, details, ip, outcome FROM audit_event WHERE type = 'auth.sign_in' ORDER BY rowid"
		)
		.all();
}

describe("rate limit per IP on /sign-in/username", () => {
	test("the sixth attempt from the same IP within 60 s is rejected and stays rejected after a restart", async () => {
		const server = await ownerServer();
		expect(await inSequence(times(5), () => wrongLocal(server))).toEqual([
			401, 401, 401, 401, 401,
		]);
		expect((await signIn(server)).status).toBe(429);
		server.reopen();
		expect((await signIn(server)).status).toBe(429);
		expect(
			server.native().query("SELECT count(*) AS rows FROM rate_limit").get()
		).toEqual({ rows: 1 });
	});

	test("another IP keeps its own budget", async () => {
		const server = await ownerServer();
		const ip = freshIp();
		await inSequence(times(5), async () => {
			await wrongRemote(server, ip);
			server
				.native()
				.run(
					"UPDATE sign_in_guard SET remote_failures = 0, remote_locked_until = NULL"
				);
		});
		expect((await signIn(server, { access: "remote", ip })).status).toBe(429);
		expect(
			(await signIn(server, { access: "remote", ip: freshIp() })).status
		).toBe(200);
	});
});

describe("remote sign-in lock", () => {
	test(
		"five remote failures lock remote sign-in for one minute, doubling up to thirty minutes",
		async () => {
			const clock = manualClock();
			const server = await ownerServer(clock.now);
			const rounds = await inSequence(times(7), async () => {
				const failures = await failRemotely(server, 5);
				const locked = await signIn(server, {
					access: "remote",
					ip: freshIp(),
				});
				const retryAfter = locked.headers.get("retry-after");
				const body = await locked.json();
				clock.advance(Number(retryAfter) * 1000 + 1000);
				return { body, failures, retryAfter, status: locked.status };
			});
			expect(rounds.map((round) => round.retryAfter)).toEqual([
				"60",
				"120",
				"240",
				"480",
				"960",
				"1800",
				"1800",
			]);
			expect(rounds.map((round) => round.status)).toEqual(
				times(7).map(() => 429)
			);
			expect(rounds.map((round) => round.body)).toEqual(
				times(7).map(() => lockedMessage)
			);
			expect(rounds.map((round) => round.failures)).toEqual(
				times(7).map(() => [401, 401, 401, 401, 401])
			);
		},
		manySignInsTimeoutMs
	);

	test("a locked remote attempt does not reach Better Auth even with the right password", async () => {
		const clock = manualClock();
		const server = await ownerServer(clock.now);
		await failRemotely(server, 5);
		clock.advance(30_000);
		const locked = await signIn(server, { access: "remote", ip: freshIp() });
		expect(locked.status).toBe(429);
		expect(locked.headers.get("retry-after")).toBe("30");
		expect(locked.headers.getSetCookie()).toEqual([]);
	});

	test("local sign-in works during a remote lock and does not change it", async () => {
		const clock = manualClock();
		const server = await ownerServer(clock.now);
		await failRemotely(server, 5);
		expect((await signIn(server)).status).toBe(200);
		expect(
			(await signIn(server, { access: "remote", ip: freshIp() })).status
		).toBe(429);
	});

	test(
		"a remote success after the lock resets the failure count",
		async () => {
			const clock = manualClock();
			const server = await ownerServer(clock.now);
			await failRemotely(server, 5);
			clock.advance(61_000);
			expect(
				(await signIn(server, { access: "remote", ip: freshIp() })).status
			).toBe(200);
			expect(await failRemotely(server, 4)).toEqual([401, 401, 401, 401]);
			expect(
				(await signIn(server, { access: "remote", ip: freshIp() })).status
			).toBe(200);
			expect(
				server
					.native()
					.query(
						"SELECT remote_failures AS failures, remote_locked_until AS lockedUntil FROM sign_in_guard"
					)
					.get()
			).toEqual({ failures: 0, lockedUntil: null });
		},
		manySignInsTimeoutMs
	);

	test("local failures never lock remote sign-in", async () => {
		const server = await ownerServer();
		await inSequence(times(20), () => wrongLocal(server));
		expect(
			server
				.native()
				.query("SELECT remote_failures AS failures FROM sign_in_guard")
				.get()
		).toEqual({ failures: 0 });
		expect(await wrongRemote(server)).toBe(401);
	});
});

describe("sign-in audit", () => {
	test(
		"records outcomes with the remote IP and never the attempted username",
		async () => {
			const clock = manualClock();
			const server = await ownerServer(clock.now);
			const ips = times(5).map(() => freshIp());
			await inSequence(ips, (ip) => wrongRemote(server, ip));
			await signIn(server, { access: "remote", ip: freshIp() });
			await inSequence(times(6), () =>
				signIn(server, { password: ownerPassword.replace("1", "9") })
			);
			const rows = auditRows(server);
			expect(rows.map((row) => row.outcome)).toEqual([
				"failed",
				"failed",
				"failed",
				"failed",
				"failed",
				"locked",
				"failed",
				"failed",
				"failed",
				"failed",
				"failed",
				"rate_limited",
			]);
			expect(rows.slice(0, 5).map((row) => row.ip)).toEqual(ips);
			expect(
				rows.slice(6).every((row) => row.access === "local" && row.ip === null)
			).toBe(true);
			const everything = JSON.stringify(
				server.native().query("SELECT * FROM audit_event").all()
			);
			expect(everything).not.toContain(attemptedUsername);
			expect(everything).not.toContain("senha");
		},
		manySignInsTimeoutMs
	);
});

describe("remote sign-in lock under concurrency", () => {
	test("parallel remote failures from many IPs never pass five attempts before the lock", async () => {
		const clock = manualClock();
		const server = await ownerServer(clock.now);
		const statuses = await Promise.all(
			times(10).map(() => wrongRemote(server))
		);
		expect(statuses.filter((status) => status === 401)).toHaveLength(5);
		expect(statuses.filter((status) => status === 429)).toHaveLength(5);
	});

	test("invalid usernames answered with 422 do not count as failures", async () => {
		const server = await ownerServer();
		const statuses = await inSequence(times(5), async () => {
			const response = await signIn(server, {
				access: "remote",
				ip: freshIp(),
				password: wrongPassword,
				username: "ab",
			});
			return response.status;
		});
		expect(statuses).toEqual([422, 422, 422, 422, 422]);
		expect(
			server
				.native()
				.query("SELECT remote_failures AS failures FROM sign_in_guard")
				.get()
		).toEqual({ failures: 0 });
	});

	test("a loopback Host carrying cf-connecting-ip counts as remote", async () => {
		const server = await ownerServer();
		const response = await server.send("/api/auth/sign-in/username", {
			body: { password: wrongPassword, username: attemptedUsername },
			headers: { "cf-connecting-ip": freshIp() },
			method: "POST",
			origin: "http://127.0.0.1:3000",
		});
		expect(response.status).toBe(401);
		expect(
			server
				.native()
				.query("SELECT remote_failures AS failures FROM sign_in_guard")
				.get()
		).toEqual({ failures: 1 });
	});

	test("repeated locked attempts leave a single audit event", async () => {
		const clock = manualClock();
		const server = await ownerServer(clock.now);
		await failRemotely(server, 5);
		await inSequence(times(20), () => wrongRemote(server));
		expect(
			server
				.native()
				.query(
					"SELECT count(*) AS locked FROM audit_event WHERE type = 'auth.sign_in' AND outcome = 'locked'"
				)
				.get()
		).toEqual({ locked: 1 });
	});
});
