import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const WEB = resolve(import.meta.dir, "..");
const SOURCE = resolve(WEB, "src");
const SOURCE_FILE = /\.(ts|tsx|css)$/;
const GENERATED = new Set(["env.ts", "routeTree.gen.ts"]);
const COLOR_UTILITY =
	"(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|outline|fill|stroke|from|to|via|decoration|shadow|inset-shadow|drop-shadow|divide|placeholder|caret|accent)";
const LOOSE_VALUES = [
	new RegExp(`\\b${COLOR_UTILITY}-[a-z]+-(?:50|[1-9]00|950)\\b`),
	new RegExp(`\\b${COLOR_UTILITY}-(?:black|white)\\b`),
	/#[0-9a-fA-F]{3,8}\b/,
	/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/,
	/(?<!\bgrid-(?:cols|rows))-\[/,
	/\bstyle=\{\{/,
];
const RING_WIDTH = "focus-visible:outline-2";
const RING_STYLE = "focus-visible:outline-solid";
const OUTLINE_RESET = /\boutline-(?:none|hidden)\b/;
const ROOT_BLOCK = /:root\s*\{([^}]*)\}/;

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

function invisibleRing(line: string) {
	const resetsOutline = OUTLINE_RESET.test(line) || line.includes(RING_WIDTH);
	return (
		resetsOutline && !(line.includes(RING_WIDTH) && line.includes(RING_STYLE))
	);
}

function token(name: string) {
	const css = readFileSync(
		resolve(WEB, "../../packages/ui/src/styles/globals.css"),
		"utf8"
	);
	const rootBlock = ROOT_BLOCK.exec(css)?.[1] ?? "";
	const match = rootBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));
	const value = match ? match[1] : undefined;
	if (!value) {
		throw new Error(`token --${name} ausente em :root`);
	}
	return value;
}

describe("apps/web usa só tokens do design system", () => {
	for (const file of sourceFiles(SOURCE)) {
		test(relative(SOURCE, file), () => {
			const offending = readFileSync(file, "utf8")
				.split("\n")
				.flatMap((line, index) =>
					LOOSE_VALUES.some((pattern) => pattern.test(line)) ||
					invisibleRing(line)
						? [`${index + 1}: ${line.trim()}`]
						: []
				);
			expect(offending).toEqual([]);
		});
	}

	test("cor do tema da PWA e do navegador vem dos tokens", () => {
		const primary = token("primary");
		const background = token("background");
		const viteConfig = readFileSync(resolve(WEB, "vite.config.ts"), "utf8");
		const html = readFileSync(resolve(WEB, "index.html"), "utf8");
		expect(viteConfig).toContain(`theme_color: "${primary}"`);
		expect(viteConfig).toContain(`background_color: "${background}"`);
		expect(html).toContain(`<meta content="${primary}" name="theme-color">`);
	});
});
