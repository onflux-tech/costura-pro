import { defineConfig } from "drizzle-kit";
import "varlock/auto-load";

export default defineConfig({
	dbCredentials: {
		url: process.env.DATABASE_FILE || "",
	},
	dialect: "sqlite",
	out: "./src/migrations",
	schema: "./src/schema",
});
