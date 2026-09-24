import {
	MobileHeader,
	MobileHeaderBack,
	MobileHeaderSearch,
} from "@costura-pro/ui/components/mobile-header";
import { MobileNav } from "@costura-pro/ui/components/mobile-nav";
import { SubTabs } from "@costura-pro/ui/components/sub-tabs";
import { SyncStatus } from "@costura-pro/ui/components/sync-status";
import { TopNav, TopNavSearch } from "@costura-pro/ui/components/top-nav";
import { Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { activeDestination } from "@/lib/active-destination";
import { destinationGroups, destinations } from "@/lib/destinations";
import { sectionTabsFor } from "@/lib/section-tabs";
import { SearchDialog } from "@/search/search-dialog";
import { useSearchShortcut } from "@/search/use-search-shortcut";

import { AccountMenu } from "./account-menu";
import { PageHeaderProvider, usePageHeaderState } from "./page-header";
import { renderRouterLink, renderSectionLink } from "./router-link";
import { useServerConnection } from "./use-server-connection";

export function AppShell() {
	return (
		<PageHeaderProvider>
			<ShellFrame />
		</PageHeaderProvider>
	);
}

function ShellFrame() {
	const pathname = useLocation({ select: (location) => location.pathname });
	const active = activeDestination(pathname, destinations);
	const connection = useServerConnection();
	const header = usePageHeaderState();
	const router = useRouter();
	const tabs = sectionTabsFor(active?.id, pathname);
	const backHref = header?.backHref;
	const onSearchPage = pathname === "/busca";
	const [searchOpen, setSearchOpen] = useState(false);
	const openSearch = useCallback(() => setSearchOpen(true), []);
	useSearchShortcut(onSearchPage ? null : openSearch);
	return (
		<div className="flex min-h-svh flex-col bg-background">
			<TopNav
				account={<AccountMenu />}
				activeId={active?.id}
				groups={destinationGroups}
				items={destinations}
				renderLink={renderRouterLink}
				search={
					<TopNavSearch
						aria-haspopup="dialog"
						aria-keyshortcuts="Control+K Meta+K"
						onClick={openSearch}
						shortcut="Ctrl K"
					/>
				}
			/>
			<SubTabs
				activeId={tabs.activeId}
				className="hidden md:flex"
				items={tabs.items}
				label="Seções"
				renderLink={renderSectionLink}
				status={
					<SyncStatus tone={connection.tone}>{connection.label}</SyncStatus>
				}
			/>
			<MobileHeader
				actions={
					<>
						<MobileHeaderSearch
							render={
								<Link search={onSearchPage ? true : undefined} to="/busca" />
							}
						/>
						<AccountMenu />
					</>
				}
				back={
					backHref ? (
						<MobileHeaderBack
							onClick={() => router.navigate({ href: backHref })}
						/>
					) : undefined
				}
				eyebrow={header?.eyebrow}
				heading={header?.heading ?? active?.label ?? "Costura Pro"}
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
			<SearchDialog onOpenChange={setSearchOpen} open={searchOpen} />
		</div>
	);
}
