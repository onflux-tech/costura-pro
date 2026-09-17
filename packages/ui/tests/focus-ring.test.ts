import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENTS = resolve(import.meta.dir, "../src/components");
const RING_WIDTH = "focus-visible:outline-2";
const RING_STYLE = "focus-visible:outline-solid";
const OUTLINE_RESET = /\boutline-(?:none|hidden)\b/;
const FOCUS_WITHOUT_VISIBLE = /(?<![\w-])focus:outline-/;
const ON_NAV_SURFACE = /\bbg-nav\b/;
const DARK_RING_ON_NAV = /\bfocus-visible:outline-ring\b/;

describe("anel de foco visível", () => {
	for (const name of readdirSync(COMPONENTS)) {
		const content = readFileSync(resolve(COMPONENTS, name), "utf8");

		test(`${name} desenha o anel onde tira o contorno padrão`, () => {
			const offending = content.split("\n").flatMap((line, index) => {
				const touchesOutline =
					OUTLINE_RESET.test(line) || line.includes(RING_WIDTH);
				const complete = line.includes(RING_WIDTH) && line.includes(RING_STYLE);
				return (touchesOutline && !complete) || FOCUS_WITHOUT_VISIBLE.test(line)
					? [`${index + 1}: ${line.trim()}`]
					: [];
			});
			expect(offending).toEqual([]);
		});

		if (ON_NAV_SURFACE.test(content)) {
			test(`${name} usa anel claro sobre a barra verde`, () => {
				expect(content).not.toMatch(DARK_RING_ON_NAV);
			});
		}
	}
});
