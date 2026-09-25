import { appendFileSync, readFileSync } from "node:fs";

import { agentsPath, isEntrypoint, readHookInput } from "./session.mjs";

export const MAX_AGENT_AGE_MS = 3 * 60 * 60 * 1000;

const AGENT_EVENTS = new Set(["SubagentStart", "SubagentStop"]);

export function track(state, input, now) {
	const agentId = input?.agent_id;
	if (!agentId) {
		return state;
	}
	if (input.hook_event_name === "SubagentStart") {
		return { ...state, [agentId]: now };
	}
	if (input.hook_event_name === "SubagentStop") {
		const { [agentId]: _stopped, ...rest } = state;
		return rest;
	}
	return state;
}

export function runningAgents(state, now) {
	return Object.values(state).filter(
		(startedAt) => now - startedAt < MAX_AGENT_AGE_MS
	).length;
}

export function recordAgentEvent(id, input, now) {
	const event = input?.hook_event_name;
	if (!(id && input?.agent_id && AGENT_EVENTS.has(event))) {
		return;
	}
	appendFileSync(
		agentsPath(id),
		`${JSON.stringify({ agent_id: input.agent_id, at: now, event })}\n`
	);
}

function parseLine(line) {
	try {
		return JSON.parse(line);
	} catch {
		return null;
	}
}

export function readAgents(id) {
	let text;
	try {
		text = readFileSync(agentsPath(id), "utf8");
	} catch {
		return {};
	}
	let state = {};
	for (const line of text.split("\n")) {
		const entry = parseLine(line);
		if (entry && typeof entry === "object") {
			state = track(
				state,
				{ agent_id: entry.agent_id, hook_event_name: entry.event },
				entry.at
			);
		}
	}
	return state;
}

if (isEntrypoint(import.meta.url)) {
	readHookInput((input) => {
		try {
			recordAgentEvent(input?.session_id, input, Date.now());
		} catch {
			process.exit(0);
		}
		process.exit(0);
	});
}
