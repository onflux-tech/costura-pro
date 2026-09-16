import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverDir = resolve(import.meta.dir, "..");
const defaultPort = /^PORT=(\d+)$/m;
const proxyTarget = /target:\s*"(http[^"]+)"/;
const vitePort = /port:\s*(\d+)/;

type TauriConfig = { build: { devUrl: string; frontendDist: string } };

async function serverDefaultPort() {
	const schema = await readFile(resolve(serverDir, ".env.schema"), "utf8");
	return defaultPort.exec(schema)?.[1];
}

test("Tauri loads the loopback on the server default port", async () => {
	const port = await serverDefaultPort();
	const config = JSON.parse(
		await readFile(
			resolve(serverDir, "../web/src-tauri/tauri.conf.json"),
			"utf8"
		)
	) as TauriConfig;

	expect(port).toBe("3000");
	expect(config.build.frontendDist).toBe(`http://127.0.0.1:${port}`);
	expect(config.build.devUrl).toBe("http://localhost:3001");
});

test("Vite dev server proxies to the server default port on the Tauri dev port", async () => {
	const port = await serverDefaultPort();
	const viteConfig = await readFile(
		resolve(serverDir, "../web/vite.config.ts"),
		"utf8"
	);

	expect(proxyTarget.exec(viteConfig)?.[1]).toBe(`http://127.0.0.1:${port}`);
	expect(viteConfig).toContain("changeOrigin: false");
	expect(vitePort.exec(viteConfig)?.[1]).toBe("3001");
});
