import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_BLOCK = /:root\s*\{([^}]*)\}/;
const HEX_TOKEN = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
const THEME_INLINE = /@theme inline\s*\{([^}]*)\}/;
const STRING_LITERAL = /"([^"]*)"/g;
const WHITESPACE = /\s+/;

const css = readFileSync(
	resolve(import.meta.dir, "../src/styles/globals.css"),
	"utf8"
);
const tokens = new Map(
	[...(ROOT_BLOCK.exec(css)?.[1] ?? "").matchAll(HEX_TOKEN)].flatMap(
		([, name, value]) =>
			name && value ? [[name, value.toLowerCase()] as const] : []
	)
);

function token(name: string) {
	const value = tokens.get(name);
	if (!value) {
		throw new Error(`token --${name} ausente em :root`);
	}
	return value;
}

function channel(hex: string, index: number) {
	const start = 1 + index * 2;
	const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
	return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
	return (
		0.2126 * channel(hex, 0) +
		0.7152 * channel(hex, 1) +
		0.0722 * channel(hex, 2)
	);
}

function contrast(first: string, second: string) {
	const [light = 0, dark = 0] = [luminance(first), luminance(second)].sort(
		(a, b) => b - a
	);
	return (light + 0.05) / (dark + 0.05);
}

const textPairs = [
	["foreground", "background"],
	["foreground", "card"],
	["muted-foreground", "card"],
	["muted-foreground", "background"],
	["subtle-foreground", "card"],
	["subtle-foreground", "muted"],
	["primary-foreground", "primary"],
	["secondary-foreground", "secondary"],
	["accent-foreground", "accent"],
	["nav-foreground", "nav"],
	["nav-muted", "nav"],
	["nav-active", "nav"],
	["nav-active-foreground", "nav-active"],
	["nav-active", "secondary"],
	["danger-foreground", "danger-soft"],
	["danger-foreground", "background"],
	["danger-foreground", "card"],
	["danger-strong", "danger-surface"],
	["danger-body", "danger-surface"],
	["warning-foreground", "warning-soft"],
	["warning-foreground", "card"],
	["warning-body", "warning-surface"],
	["success-foreground", "success-soft"],
	["success-foreground", "card"],
	["success-body", "success-surface"],
] as const;

const nonTextPairs = [
	["input", "card"],
	["input", "background"],
	["ring", "card"],
	["ring", "background"],
	["nav-active", "nav"],
	["danger", "card"],
	["warning", "card"],
	["success", "card"],
] as const;

describe("tokens de cor", () => {
	test("não há tema escuro", () => {
		expect(css).not.toContain(".dark");
		expect(css).not.toContain("@custom-variant dark");
	});

	for (const [foreground, background] of textPairs) {
		test(`texto --${foreground} sobre --${background} tem 4,5:1`, () => {
			expect(
				contrast(token(foreground), token(background))
			).toBeGreaterThanOrEqual(4.5);
		});
	}

	for (const [foreground, background] of nonTextPairs) {
		test(`indicador --${foreground} sobre --${background} tem 3:1`, () => {
			expect(
				contrast(token(foreground), token(background))
			).toBeGreaterThanOrEqual(3);
		});
	}
});

describe("tokens chegam intactos ao Tailwind", () => {
	const theme = THEME_INLINE.exec(css)?.[1] ?? "";
	for (const name of tokens.keys()) {
		test(`--color-${name} aponta para --${name}`, () => {
			expect(theme).toContain(`--color-${name}: var(--${name});`);
		});
	}
});

function colorsWithPrefix(classes: string[], prefix: string) {
	return classes
		.filter((entry) => entry.startsWith(prefix))
		.map((entry) => entry.slice(prefix.length))
		.filter((entry) => tokens.has(entry));
}

describe("pares de cor usados nos componentes", () => {
	const components = resolve(import.meta.dir, "../src/components");
	for (const name of readdirSync(components)) {
		test(`${name} combina texto e fundo com 4,5:1`, () => {
			const source = readFileSync(resolve(components, name), "utf8");
			const failing = [...source.matchAll(STRING_LITERAL)].flatMap(
				([, literal = ""]) => {
					const plain = literal
						.split(WHITESPACE)
						.filter((entry) => !entry.includes(":"));
					const texts = colorsWithPrefix(plain, "text-");
					return colorsWithPrefix(plain, "bg-").flatMap((background) =>
						texts
							.filter((text) => contrast(token(text), token(background)) < 4.5)
							.map((text) => `text-${text} sobre bg-${background}`)
					);
				}
			);
			expect(failing).toEqual([]);
		});
	}
});
