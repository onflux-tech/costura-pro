import type { LinkTarget } from "@costura-pro/ui/lib/navigation";

export function activeDestination<T extends LinkTarget>(
	pathname: string,
	targets: readonly T[]
): T | undefined {
	return targets.find(({ href }) =>
		href === "/"
			? pathname === "/"
			: pathname === href || pathname.startsWith(`${href}/`)
	);
}
