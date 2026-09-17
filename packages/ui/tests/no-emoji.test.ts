import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SOURCE = resolve(import.meta.dir, "../src");
const SOURCE_FILE = /\.(ts|tsx|css)$/;
const EMOJI =
	/\p{Emoji_Presentation}|\p{Extended_Pictographic}️|\p{Regional_Indicator}{2}|[0-9#*]️?⃣/u;
const BROWSER_DIALOG =
	/(?:^|[^.\w$])(?:alert|confirm|prompt)\(|\bwindow\.(?:alert|confirm|prompt)\(/;
const TITLE_TOOLTIP = /\btitle=/;

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(path);
		}
		return SOURCE_FILE.test(entry.name) ? [path] : [];
	});
}

describe("packages/ui sem emoji, diálogo nativo nem tooltip por title", () => {
	for (const file of sourceFiles(SOURCE)) {
		test(relative(SOURCE, file), () => {
			const offending = readFileSync(file, "utf8")
				.split("\n")
				.flatMap((line, index) =>
					[EMOJI, BROWSER_DIALOG, TITLE_TOOLTIP].some((rule) => rule.test(line))
						? [`${index + 1}: ${line.trim()}`]
						: []
				);
			expect(offending).toEqual([]);
		});
	}
});
