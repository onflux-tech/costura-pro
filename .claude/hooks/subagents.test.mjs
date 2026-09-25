import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { agentsPath, clearSession } from "./session.mjs";
import {
	MAX_AGENT_AGE_MS,
	readAgents,
	recordAgentEvent,
	runningAgents,
	track,
} from "./subagents.mjs";

const cleanups = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

test("SubagentStart registra o agente com a hora e SubagentStop remove", () => {
	assert.deepEqual(
		track({}, { agent_id: "a1", hook_event_name: "SubagentStart" }, 1000),
		{ a1: 1000 }
	);
	assert.deepEqual(
		track(
			{ a1: 1000, a2: 2000 },
			{ agent_id: "a1", hook_event_name: "SubagentStop" },
			3000
		),
		{ a2: 2000 }
	);
});

test("evento de outro tipo ou sem agent_id não muda o estado", () => {
	assert.deepEqual(track({ a1: 1 }, { hook_event_name: "SubagentStart" }, 5), {
		a1: 1,
	});
	assert.deepEqual(
		track({ a1: 1 }, { agent_id: "a1", hook_event_name: "Stop" }, 5),
		{ a1: 1 }
	);
});

test("runningAgents ignora entrada com 3 h ou mais", () => {
	const now = 10 * 3_600_000;

	assert.equal(
		runningAgents(
			{
				limite: now - MAX_AGENT_AGE_MS,
				recente: now - 3_600_000,
				velho: now - 4 * 3_600_000,
			},
			now
		),
		1
	);
});

test("recordAgentEvent acrescenta só início e fim de subagente e readAgents dobra o log em ordem", () => {
	const id = `subagents-log-${process.pid}-${Date.now()}`;
	cleanups.push(() => clearSession(id));

	assert.deepEqual(readAgents(id), {});

	recordAgentEvent(
		id,
		{ agent_id: "a1", hook_event_name: "SubagentStart" },
		10
	);
	recordAgentEvent(
		id,
		{ agent_id: "a2", hook_event_name: "SubagentStart" },
		20
	);
	recordAgentEvent(id, { agent_id: "a3", hook_event_name: "Stop" }, 30);
	recordAgentEvent(id, { hook_event_name: "SubagentStart" }, 40);
	appendFileSync(agentsPath(id), "linha quebrada\nnull\n");
	recordAgentEvent(id, { agent_id: "a1", hook_event_name: "SubagentStop" }, 50);

	assert.deepEqual(readFileSync(agentsPath(id), "utf8").split("\n"), [
		'{"agent_id":"a1","at":10,"event":"SubagentStart"}',
		'{"agent_id":"a2","at":20,"event":"SubagentStart"}',
		"linha quebrada",
		"null",
		'{"agent_id":"a1","at":50,"event":"SubagentStop"}',
		"",
	]);
	assert.deepEqual(readAgents(id), { a2: 20 });
});

test("settings.json registra o hook no início e no fim de subagente", () => {
	const settings = JSON.parse(
		readFileSync(
			fileURLToPath(new URL("../settings.json", import.meta.url)),
			"utf8"
		)
	);

	for (const event of ["SubagentStart", "SubagentStop"]) {
		assert.deepEqual(
			settings.hooks[event]?.flatMap((entry) =>
				entry.hooks.map((hook) => hook.command)
			),
			['node "$CLAUDE_PROJECT_DIR/.claude/hooks/subagents.mjs"'],
			event
		);
	}
});

test("processo do hook grava e remove o agente no arquivo da sessão", () => {
	const id = `subagents-${process.pid}-${Date.now()}`;
	cleanups.push(() => clearSession(id));
	const hook = fileURLToPath(new URL("./subagents.mjs", import.meta.url));
	const run = (input) =>
		spawnSync(process.execPath, [hook], { encoding: "utf8", input });
	const event = (name) =>
		JSON.stringify({ agent_id: "x1", hook_event_name: name, session_id: id });

	assert.equal(run(event("SubagentStart")).status, 0);
	assert.ok("x1" in readAgents(id));

	assert.equal(run(event("SubagentStop")).status, 0);
	assert.ok(!("x1" in readAgents(id)));

	assert.equal(run("não é json").status, 0);
});

test("processos do hook disparados juntos não perdem nem prendem agentes", async () => {
	const id = `subagents-race-${process.pid}-${Date.now()}`;
	cleanups.push(() => clearSession(id));
	const hook = fileURLToPath(new URL("./subagents.mjs", import.meta.url));
	const agents = Array.from({ length: 8 }, (_, index) => `r${index}`);
	const burst = (name) =>
		Promise.all(
			agents.map(
				(agent) =>
					new Promise((done, fail) => {
						const child = spawn(process.execPath, [hook], {
							stdio: ["pipe", "ignore", "ignore"],
						});
						child.on("error", fail);
						child.on("exit", done);
						child.stdin.end(
							JSON.stringify({
								agent_id: agent,
								hook_event_name: name,
								session_id: id,
							})
						);
					})
			)
		);

	await burst("SubagentStart");
	assert.deepEqual(Object.keys(readAgents(id)).sort(), agents);

	await burst("SubagentStop");
	assert.deepEqual(readAgents(id), {});
});
