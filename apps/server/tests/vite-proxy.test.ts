import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverDir = resolve(import.meta.dir, "..");
const defaultPort = /^PORT=(\d+)$/m;
const proxyTarget = /target:\s*"(http[^"]+)"/;
const proxyKey = /const serverPaths = "([^"]+)"/;

async function viteConfig() {
	return await readFile(resolve(serverDir, "../web/vite.config.ts"), "utf8");
}

test("Vite dev server proxies to the server default port on the loopback", async () => {
	const schema = await readFile(resolve(serverDir, ".env.schema"), "utf8");
	const port = defaultPort.exec(schema)?.[1];
	const config = await viteConfig();

	expect(port).toBe("3000");
	expect(proxyTarget.exec(config)?.[1]).toBe(`http://127.0.0.1:${port}`);
	expect(config).toContain("changeOrigin: false");
});

test("Vite proxy key is an anchored pattern that only matches server routes", async () => {
	const key = proxyKey.exec(await viteConfig())?.[1] ?? "";
	const pattern = new RegExp(key);

	expect(key.startsWith("^")).toBe(true);
	for (const path of [
		"/api/auth/sign-in",
		"/rpc/installation",
		"/api-reference",
		"/api",
	]) {
		expect(pattern.test(path)).toBe(true);
	}
	for (const path of ["/apiary", "/rpcs", "/login", "/os/api"]) {
		expect(pattern.test(path)).toBe(false);
	}
});
