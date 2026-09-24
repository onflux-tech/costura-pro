import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENTS = resolve(import.meta.dir, "../src/components");
const RING_WIDTH = "focus-visible:outline-2";
const RING_STYLE = "focus-visible:outline-solid";
const OUTLINE_RESET = /\boutline-(?:none|hidden)\b/;
const FOCUS_WITHOUT_VISIBLE = /(?<![\w-])focus:outline-/;
const ON_NAV_SURFACE = /\bbg-nav(?![\w-])/;
const DARK_RING_ON_NAV = /\bfocus-visible:outline-ring\b/;
const UNDERLINED_FIELDS = new Set(["command-palette.tsx"]);
const FIELD_RESET = "[&_input]:outline-none";
const ROW_UNDERLINE =
	"has-[input:focus-visible]:shadow-[inset_0_-2px_0_var(--color-ring)]";

describe("anel de foco visível", () => {
	for (const name of readdirSync(COMPONENTS)) {
		const content = readFileSync(resolve(COMPONENTS, name), "utf8");

		test(`${name} desenha o anel onde tira o contorno padrão`, () => {
			const offending = content.split("\n").flatMap((line, index) => {
				const touchesOutline =
					OUTLINE_RESET.test(line) || line.includes(RING_WIDTH);
				const ring = line.includes(RING_WIDTH) && line.includes(RING_STYLE);
				const underline =
					UNDERLINED_FIELDS.has(name) &&
					line.includes(FIELD_RESET) &&
					line.includes(ROW_UNDERLINE);
				const complete = ring || underline;
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
