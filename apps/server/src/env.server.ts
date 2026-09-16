import "varlock/auto-load";

export { ENV as env } from "./env";

/** Packaged desktop builds serve the frontend from their own origin, not CORS_ORIGIN. */
export const desktopOrigins = ["tauri://localhost", "http://tauri.localhost"];
