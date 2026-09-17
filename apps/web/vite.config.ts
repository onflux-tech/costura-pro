import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const serverPaths = "^/(api|rpc|api-reference)(/|$)";
const apiNavigation = /^\/api(\/|-reference|$)/;
const rpcNavigation = /^\/rpc(\/|$)/;
const reactModules = /node_modules[\\/](react|react-dom|scheduler)[\\/]/;

export default defineConfig({
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [{ name: "react", test: reactModules }],
				},
			},
		},
	},
	plugins: [
		varlockVitePlugin({ ssrInjectMode: "auto-load" }),
		tailwindcss(),
		tanstackRouter({
			autoCodeSplitting: true,
			target: "react",
		}),
		react(),
		VitePWA({
			devOptions: { enabled: true },
			manifest: {
				background_color: "#f7f4ee",
				description: "Atendimento, produção, estoque e finanças do ateliê",
				lang: "pt-BR",
				name: "Costura Pro",
				short_name: "Costura Pro",
				theme_color: "#143a2d",
			},
			pwaAssets: { config: true, disabled: false },
			registerType: "autoUpdate",
			workbox: {
				globPatterns: [
					"**/*.{js,css,html,png,svg,ico}",
					"**/*-latin-{wght,opsz}-normal-*.woff2",
				],
				navigateFallbackDenylist: [apiNavigation, rpcNavigation],
			},
		}),
	],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		port: 3001,
		proxy: {
			[serverPaths]: { changeOrigin: false, target: "http://127.0.0.1:3000" },
		},
		strictPort: true,
	},
});
