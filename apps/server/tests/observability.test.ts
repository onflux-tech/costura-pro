import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";
import { inspect } from "node:util";

import {
	completeWizard,
	newOpId,
	ownerPassword,
	rpc,
	startTestServer,
	type TestServer,
} from "./support";

const leakedPassword = "senha-que-nao-pode-vazar";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function captureConsoleErrors<T>(run: () => Promise<T>) {
	const spy = spyOn(console, "error").mockImplementation(() => undefined);
	try {
		await run().catch(() => undefined);
		return inspect(spy.mock.calls, { depth: 10 });
	} finally {
		spy.mockRestore();
	}
}

describe("error logging", () => {
	test("a validation error never prints the password", async () => {
		const server = await startTestServer();
		servers.push(server);
		await rpc(server).installation.setAtelierName({
			atelierName: "Ateliê da Dona",
			baseVersion: 1,
			opId: newOpId(),
		});
		const printed = await captureConsoleErrors(() =>
			rpc(server).installation.createOwner({
				opId: newOpId(),
				password: leakedPassword,
				username: "dona atelie",
			})
		);
		expect(printed).toContain("BAD_REQUEST");
		expect(printed).not.toContain(leakedPassword);
	});

	test("an invalid new password never prints the recovery code", async () => {
		const server = await startTestServer();
		servers.push(server);
		const { codes } = await completeWizard(server);
		const code = codes[0] ?? "";
		const printed = await captureConsoleErrors(() =>
			rpc(server).recovery.resetPassword({
				code,
				newPassword: "curta",
				opId: newOpId(),
			})
		);
		expect(printed).toContain("BAD_REQUEST");
		expect(printed).not.toContain(code);
		expect(printed).not.toContain(code.replaceAll("-", ""));
	});
});

describe("audit mirror", () => {
	test("audit events also reach the evlog wide event without secrets", async () => {
		const events: unknown[] = [];
		const server = await startTestServer({
			drain: (context) => {
				events.push(context.event);
			},
		});
		servers.push(server);
		await completeWizard(server);
		await delay(50);
		const text = JSON.stringify(events);
		expect(text).toContain("owner.created");
		expect(text).toContain("installation.ready");
		expect(text).not.toContain(ownerPassword);
	});
});
