import { MobileHeader } from "@costura-pro/ui/components/mobile-header";
import { MobileNav } from "@costura-pro/ui/components/mobile-nav";
import { SubTabs } from "@costura-pro/ui/components/sub-tabs";
import { SyncStatus } from "@costura-pro/ui/components/sync-status";
import { TopNav } from "@costura-pro/ui/components/top-nav";
import { Outlet, useLocation } from "@tanstack/react-router";

import { activeDestination } from "@/lib/active-destination";
import { destinationGroups, destinations } from "@/lib/destinations";

import { AccountMenu } from "./account-menu";
import { renderRouterLink } from "./router-link";
import { useServerConnection } from "./use-server-connection";

export function AppShell() {
	const pathname = useLocation({ select: (location) => location.pathname });
	const active = activeDestination(pathname, destinations);
	const connection = useServerConnection();
	return (
		<div className="flex min-h-svh flex-col bg-background">
			<TopNav
				account={<AccountMenu />}
				activeId={active?.id}
				groups={destinationGroups}
				items={destinations}
				renderLink={renderRouterLink}
			/>
			<SubTabs
				className="hidden md:flex"
				items={[]}
				label="Seções"
				status={
					<SyncStatus tone={connection.tone}>{connection.label}</SyncStatus>
				}
			/>
			<MobileHeader
				actions={<AccountMenu />}
				heading={active?.label ?? "Costura Pro"}
				status={connection.label}
			/>
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 md:px-6">
				<Outlet />
			</main>
			<MobileNav
				activeId={active?.id}
				groups={destinationGroups}
				items={destinations}
				renderLink={renderRouterLink}
			/>
		</div>
	);
}
