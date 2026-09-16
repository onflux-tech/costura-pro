import { isIP } from "node:net";
import type { Access } from "@costura-pro/api/context";

import { isLoopbackHost } from "./origin";

export const cloudflareIpHeader = "cf-connecting-ip";

export type RequestAccess = { access: Access; ip: string | null };

export function classifyAccess(headers: Headers): RequestAccess {
	const forwarded = headers.get(cloudflareIpHeader);
	const ip = forwarded !== null && isIP(forwarded) !== 0 ? forwarded : null;
	const access =
		forwarded === null && isLoopbackHost(headers.get("host"))
			? "local"
			: "remote";
	return { access, ip };
}
