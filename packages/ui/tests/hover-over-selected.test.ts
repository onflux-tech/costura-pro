import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENTS = resolve(import.meta.dir, "../src/components");
const SELECTED_STATES = ["active", "checked"] as const;
const HOVER_BACKGROUND = /(?:^|:)hover:bg-/;
const CLASS_SEPARATOR = /[\s"'`]+/;

function unguardedHovers(line: string): string[] {
	const selected = SELECTED_STATES.filter((state) =>
		line.includes(`data-${state}:bg-`)
	);
	if (selected.length === 0) {
		return [];
	}
	return line
		.split(CLASS_SEPARATOR)
		.filter((token) => HOVER_BACKGROUND.test(token))
		.filter((token) =>
			selected.some((state) => !token.split(":").includes(`not-data-${state}`))
		);
}

describe("hover sobre item selecionado", () => {
	for (const name of readdirSync(COMPONENTS)) {
		const content = readFileSync(resolve(COMPONENTS, name), "utf8");

		test(`${name} mantém o fundo do selecionado sob o mouse`, () => {
			const offending = content
				.split("\n")
				.flatMap((line, index) =>
					unguardedHovers(line).map((token) => `${index + 1}: ${token}`)
				);
			expect(offending).toEqual([]);
		});
	}
});
