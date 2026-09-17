import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SOURCE = resolve(import.meta.dir, "../src");
const SOURCE_FILE = /\.(ts|tsx)$/;
const GENERATED = new Set(["env.ts", "routeTree.gen.ts"]);
const NATIVE_ELEMENT =
	/<(?:h[1-6]|p|span|strong|em|small|b|i|u|s|mark|code|kbd|pre|blockquote|ul|ol|li|dl|dt|dd|hr|br|button|input|select|option|textarea|table|thead|tbody|tr|td|th|label|fieldset|legend|a|dialog|img|picture|svg|video|audio|canvas|iframe|details|summary|progress|meter|datalist|output)(?:[\s/>]|$)/;
const BROWSER_DIALOG =
	/(?:^|[^.\w$])(?:alert|confirm|prompt)\(|\bwindow\.(?:alert|confirm|prompt)\(/;
const TITLE_ATTRIBUTE = /\btitle=/;
const EMOJI =
	/\p{Emoji_Presentation}|\p{Extended_Pictographic}️|\p{Regional_Indicator}{2}|[0-9#*]️?⃣/u;
const STYLED_LINK =
	/<Link\b(?:[^<>]|=>)*?\b(?:className|activeProps|inactiveProps|style)=/g;
const WHITESPACE = /\s+/g;

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(path);
		}
		return SOURCE_FILE.test(entry.name) && !GENERATED.has(entry.name)
			? [path]
			: [];
	});
}

function offendingLines(content: string) {
	return content
		.split("\n")
		.flatMap((line, index) =>
			[NATIVE_ELEMENT, BROWSER_DIALOG, TITLE_ATTRIBUTE, EMOJI].some((rule) =>
				rule.test(line)
			)
				? [`${index + 1}: ${line.trim()}`]
				: []
		);
}

describe("apps/web monta a interface só com componentes do design system", () => {
	for (const file of sourceFiles(SOURCE)) {
		test(relative(SOURCE, file), () => {
			const content = readFileSync(file, "utf8");
			const styledLinks = [...content.matchAll(STYLED_LINK)].map((match) =>
				match[0].replace(WHITESPACE, " ")
			);
			expect([...offendingLines(content), ...styledLinks]).toEqual([]);
		});
	}
});

describe("regras de varredura", () => {
	test("reconhecem emoji sem confundir símbolos tipográficos", () => {
		const emoji = ["\u{1F9F5}", "✨", "\u{1F1E7}\u{1F1F7}", "1️⃣", "❤️"];
		const typographic = ["©", "®", "™", "→", "▶", "★", "Orçamentos"];
		expect(emoji.filter((sample) => !EMOJI.test(sample))).toEqual([]);
		expect(typographic.filter((sample) => EMOJI.test(sample))).toEqual([]);
	});

	test("diálogo nativo não confunde método de API", () => {
		expect(BROWSER_DIALOG.test('window.confirm("ok")')).toBe(true);
		expect(BROWSER_DIALOG.test('if (confirm("ok")) {')).toBe(true);
		expect(BROWSER_DIALOG.test("orpc.agenda.confirm(input)")).toBe(false);
	});

	test("link estilizado à mão é pego mesmo quebrado em várias linhas", () => {
		const styled =
			'<Link\n\tactiveProps={{ className: "x" }}\n\tto="/"\n>\n\tInício\n</Link>';
		const rendered = '<Button render={<Link to="/" />}>';
		expect([...styled.matchAll(STYLED_LINK)]).toHaveLength(1);
		expect([...rendered.matchAll(STYLED_LINK)]).toHaveLength(0);
	});
});
