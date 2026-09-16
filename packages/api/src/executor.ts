import type { Database } from "@costura-pro/db";

export type Executor = Pick<
	Database,
	"delete" | "insert" | "select" | "update"
>;
