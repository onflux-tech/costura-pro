import type { Auth } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";

export type Access = "local" | "remote";

export type DeviceCredential = { id: string; secret: string };

export type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;

export type Context = {
	access: Access;
	auth: Auth;
	db: Database;
	device: DeviceCredential | null;
	ip: string | null;
	log: (fields: Record<string, unknown>) => void;
	mediaRoot: string;
	now: () => Date;
	serverVersion: string;
	session: Session;
};
