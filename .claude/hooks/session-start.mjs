import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkHarness } from "../../scripts/harness.mjs";
import {
	baselinePath,
	dirtyEntries,
	git,
	isEntrypoint,
	projectRoot,
	pruneSessions,
	readHookInput,
	snapshot,
} from "./session.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// SessionStart também dispara em resume e compactação: a primeira foto da sessão prevalece,
// senão o stop-check perderia o que foi mudado antes do resume.
export function start(input, options = {}) {
	const root = projectRoot(input);
	const harnessIssues = options.harnessIssues ?? (() => checkHarness(repoRoot));
	pruneSessions();
	if (input.session_id && !existsSync(baselinePath(input.session_id))) {
		writeFileSync(
			baselinePath(input.session_id),
			JSON.stringify(snapshot(root))
		);
	}
	const branch = git(["branch", "--show-current"], root).trim() || "sem branch";
	const lines = [
		`Costura Pro: branch ${branch}, ${dirtyEntries(root).length} arquivo(s) com mudança.`,
	];
	const issues = harnessIssues();
	if (issues.length > 0) {
		lines.push(
			`Harness divergente: ${issues.length} problema(s); rode pnpm harness:sync antes de seguir.`
		);
	}
	lines.push(
		"Abra cada entrega com /entrega-iniciar; a sessão de execução segue o /implementar do handoff; feche com /entrega-fechar: é o fechamento que atualiza docs curadas, índice e harness."
	);
	return lines.join("\n");
}

if (isEntrypoint(import.meta.url)) {
	readHookInput((input) => {
		try {
			const additionalContext = start(input);
			process.stdout.write(
				`${JSON.stringify({ hookSpecificOutput: { additionalContext, hookEventName: "SessionStart" } })}\n`
			);
		} catch {
			// Sem git ou sem harness, a sessão segue sem contexto extra.
		}
		process.exit(0);
	});
}
