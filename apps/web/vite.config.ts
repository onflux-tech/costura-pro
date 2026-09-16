import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
				description: "costura-pro - PWA Application",
				name: "costura-pro",
				short_name: "costura-pro",
				theme_color: "#0c0c0c",
			},
			pwaAssets: { config: true, disabled: false },
			registerType: "autoUpdate",
			workbox: { globPatterns: ["**/*.{js,css,html,png,svg,ico}"] },
		}),
	],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		port: 3001,
	},
});
