import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Prosa envelhece em silêncio: docs, rules e agents citam arquivos, âncoras e requisitos
// que somem. Esta checagem roda no pre-commit e no CI para o harness não apodrecer.
const MARKDOWN = /\.md$/i;
const PORTS =
	/^(?:\.claude\/agents\/|\.claude\/skills\/|\.codex\/|node_modules\/)/;
const FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const HTML_ID = /<[a-z][^>]*\sid="([^"]+)"/gi;
const INLINE_CODE = /`([^`\n]+)`/g;
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const PATH_LIKE = /^[\w.@-]+(?:\/[\w.@-]+)+\/?$/;
const TRAILING_SLASH = /\/$/;
const PATH_SEPARATOR = /[\\/]/;
const NOT_SLUG_CHAR = /[^\p{L}\p{N}\s_-]/gu;
const WHITESPACE = /\s/g;
const DASH = /[\u2013\u2014]/g;
const RULE_FILE = /^\.claude\/rules\/[^/]+\.md$/;
const REQUIREMENT = /\*\*(RF-[A-Z]{3}-\d{2})\*\*/g;
const TRACE_HEADING = /^## Rastreio de requisitos por fase/m;
const NEXT_SECTION = /\n## /;
const TRACE_ROW = /^\|\s*(RF-[A-Z]{3})\s*\|(.*)$/gm;
const TRACE_NUMBER = /\b(\d{2})(?:\s+a\s+(\d{2}))?\b/g;

// Windows e macOS aceitam "harness.md" para "HARNESS.md", mas o CI Linux não: a existência
// é conferida pelo nome exato de cada segmento, relativo à raiz do repositório.
function existsExact(root, absolutePath) {
	const rel = relative(root, absolutePath);
	if (rel.startsWith("..") || !existsSync(absolutePath)) {
		return false;
	}
	let current = root;
	for (const segment of rel.split(PATH_SEPARATOR).filter(Boolean)) {
		if (!readdirSync(current).includes(segment)) {
			return false;
		}
		current = join(current, segment);
	}
	return true;
}

function git(args, root, input) {
	return execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		input,
		stdio: ["pipe", "pipe", "ignore"],
	});
}

function vendoredSkills(root) {
	const lock = join(root, "skills-lock.json");
	if (!existsSync(lock)) {
		return new Set();
	}
	return new Set(
		Object.keys(JSON.parse(readFileSync(lock, "utf8")).skills ?? {})
	);
}

function projectMarkdown(root, vendored) {
	return git(
		["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		root
	)
		.split("\0")
		.filter((path) => MARKDOWN.test(path) && existsSync(join(root, path)))
		.filter((path) => !PORTS.test(path))
		.filter((path) => {
			const [top, kind, name] = path.split("/");
			return !(top === ".agents" && kind === "skills" && vendored.has(name));
		})
		.sort();
}

// Linhas fora de blocos de código, que não contam para links, headings nem caminhos.
function proseLines(text) {
	const lines = [];
	let inFence = false;
	for (const line of text.split("\n")) {
		if (FENCE.test(line)) {
			inFence = !inFence;
		} else if (!inFence) {
			lines.push(line);
		}
	}
	return lines;
}

// Mesmo algoritmo de âncora do GitHub: "×" some e deixa hífen duplo, acentos ficam.
function slugsOf(text) {
	const slugs = new Set();
	const seen = new Map();
	for (const line of proseLines(text)) {
		// O README bilíngue fixa âncoras com <a id="...">, que o GitHub preserva.
		for (const [, id] of line.matchAll(HTML_ID)) {
			slugs.add(id);
		}
		const heading = line.match(HEADING);
		if (!heading) {
			continue;
		}
		const base = heading[1]
			.toLowerCase()
			.replace(NOT_SLUG_CHAR, "")
			.replace(WHITESPACE, "-");
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		slugs.add(count === 0 ? base : `${base}-${count}`);
	}
	return slugs;
}

function linkIssues(root, file, text) {
	const issues = [];
	const prose = proseLines(text).join("\n").replace(INLINE_CODE, "");
	for (const [, target] of prose.matchAll(LINK)) {
		if (EXTERNAL.test(target)) {
			continue;
		}
		const [pathPart, anchor] = target.split("#");
		const targetFile = pathPart
			? normalize(join(dirname(join(root, file)), decodeURI(pathPart)))
			: join(root, file);
		if (!existsExact(root, targetFile)) {
			issues.push(`${file}: link quebrado ${target}`);
			continue;
		}
		if (
			anchor &&
			MARKDOWN.test(targetFile) &&
			!slugsOf(readFileSync(targetFile, "utf8")).has(decodeURI(anchor))
		) {
			issues.push(`${file}: âncora inexistente ${target}`);
		}
	}
	return issues;
}

function pathCandidates(root, text) {
	const topLevel = new Set(readdirSync(root));
	const candidates = new Set();
	for (const line of proseLines(text)) {
		for (const [, code] of line.matchAll(INLINE_CODE)) {
			const path = code.trim().replace(TRAILING_SLASH, "");
			if (PATH_LIKE.test(code.trim()) && topLevel.has(path.split("/")[0])) {
				candidates.add(path);
			}
		}
	}
	return [...candidates];
}

function ignoredPaths(root, paths) {
	if (paths.length === 0) {
		return new Set();
	}
	const queries = paths.flatMap((path) => [path, `${path}/`]).join("\n");
	let output;
	try {
		output = git(["check-ignore", "--stdin"], root, queries);
	} catch (error) {
		// check-ignore sai com 1 quando nenhum caminho é ignorado.
		output = String(error.stdout ?? "");
	}
	return new Set(
		output.split("\n").map((path) => path.replace(TRAILING_SLASH, ""))
	);
}

function missingPathIssues(root, file, text) {
	const candidates = pathCandidates(root, text).filter(
		(path) => !existsExact(root, join(root, path))
	);
	const ignored = ignoredPaths(root, candidates);
	return candidates
		.filter((path) => !ignored.has(path))
		.map((path) => `${file}: caminho inexistente ${path}`);
}

function indexIssues(root, files) {
	const docs = files.filter(
		(path) => path.startsWith("docs/") && path !== "docs/README.md"
	);
	if (docs.length === 0) {
		return [];
	}
	const indexFile = join(root, "docs/README.md");
	if (!existsSync(indexFile)) {
		return ["docs/README.md: índice ausente"];
	}
	const linked = new Set();
	for (const [, target] of readFileSync(indexFile, "utf8").matchAll(LINK)) {
		if (!EXTERNAL.test(target)) {
			const [pathPart] = target.split("#");
			linked.add(normalize(resolve(root, "docs", decodeURI(pathPart))));
		}
	}
	return docs
		.filter((path) => !linked.has(normalize(resolve(root, path))))
		.map((path) => `docs/README.md: ${path} fora do índice`);
}

function ruleIssues(root, files) {
	const agents = join(root, "AGENTS.md");
	const text = existsSync(agents) ? readFileSync(agents, "utf8") : "";
	return files
		.filter((path) => RULE_FILE.test(path) && !text.includes(path))
		.map((path) => `AGENTS.md: rule ${path} não listada`);
}

function expandTrace(cells) {
	const numbers = [];
	for (const [, from, to] of cells.matchAll(TRACE_NUMBER)) {
		const last = Number(to ?? from);
		for (let value = Number(from); value <= last; value += 1) {
			numbers.push(String(value).padStart(2, "0"));
		}
	}
	return numbers;
}

function traceIssues(root) {
	const prdFile = join(root, "docs/PRD.md");
	const roadmapFile = join(root, "docs/ROADMAP.md");
	if (!(existsSync(prdFile) && existsSync(roadmapFile))) {
		return [];
	}
	const defined = new Set(
		[...readFileSync(prdFile, "utf8").matchAll(REQUIREMENT)].map(
			(match) => match[1]
		)
	);
	const roadmap = readFileSync(roadmapFile, "utf8");
	const start = roadmap.search(TRACE_HEADING);
	if (start === -1) {
		return defined.size > 0
			? ["docs/ROADMAP.md: seção de rastreio ausente"]
			: [];
	}
	const [section] = roadmap.slice(start + 3).split(NEXT_SECTION);
	const traced = new Set();
	for (const [, area, cells] of section.matchAll(TRACE_ROW)) {
		for (const number of expandTrace(cells)) {
			traced.add(`${area}-${number}`);
		}
	}
	return [
		...[...defined]
			.filter((id) => !traced.has(id))
			.map((id) => `docs/ROADMAP.md: ${id} fora do rastreio`),
		...[...traced]
			.filter((id) => !defined.has(id))
			.map((id) => `docs/ROADMAP.md: ${id} inexistente no PRD`),
	];
}

function directoriesIn(path) {
	return existsSync(path)
		? readdirSync(path, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
		: [];
}

function harnessIssues(root, vendored) {
	const harnessFile = join(root, "docs/HARNESS.md");
	const text = existsSync(harnessFile) ? readFileSync(harnessFile, "utf8") : "";
	const mentioned = (name) =>
		new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(text);
	const roles = directoriesIn(join(root, ".agents/agents"))
		.filter((name) => !mentioned(name))
		.map((name) => `docs/HARNESS.md: papel ${name} não documentado`);
	const skills = directoriesIn(join(root, ".agents/skills"))
		.filter((name) => !(vendored.has(name) || mentioned(name)))
		.map((name) => `docs/HARNESS.md: skill ${name} não documentada`);
	return [...roles, ...skills];
}

export function checkDocs(root) {
	const vendored = vendoredSkills(root);
	const files = projectMarkdown(root, vendored);
	const issues = [];
	for (const file of files) {
		const text = readFileSync(join(root, file), "utf8");
		issues.push(...linkIssues(root, file, text));
		issues.push(...missingPathIssues(root, file, text));
		const dashes = (text.match(DASH) ?? []).length;
		if (dashes > 0) {
			issues.push(`${file}: ${dashes} travessão`);
		}
	}
	issues.push(...indexIssues(root, files));
	issues.push(...ruleIssues(root, files));
	issues.push(...traceIssues(root));
	issues.push(...harnessIssues(root, vendored));
	return issues.sort();
}

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const root = resolve(dirname(scriptPath), "..");
	const issues = checkDocs(root);
	if (issues.length === 0) {
		process.stdout.write("Docs consistentes.\n");
	} else {
		process.stderr.write(
			`Docs divergentes (${relative(process.cwd(), root) || "."}):\n${issues.map((issue) => `- ${issue}`).join("\n")}\n`
		);
		process.exitCode = 1;
	}
}
