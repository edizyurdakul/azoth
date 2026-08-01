import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(root, "./src"),
		},
	},
	build: {
		outDir: "../dashboard/public",
		emptyOutDir: true,
	},
	server: {
		proxy: {
			"/api": "http://localhost:8787",
		},
	},
});
