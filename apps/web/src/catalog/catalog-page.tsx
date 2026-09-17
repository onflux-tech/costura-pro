import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	MobileHeader,
	MobileHeaderBack,
} from "@costura-pro/ui/components/mobile-header";
import { MobileNav } from "@costura-pro/ui/components/mobile-nav";
import { SubTabs } from "@costura-pro/ui/components/sub-tabs";
import { SyncStatus } from "@costura-pro/ui/components/sync-status";
import {
	TopNav,
	TopNavAvatar,
	TopNavSearch,
} from "@costura-pro/ui/components/top-nav";
import { Eyebrow, Heading } from "@costura-pro/ui/components/typography";
import { useState } from "react";

import { destinationGroups, destinations } from "@/lib/destinations";

import { ContentSection } from "./content-section";
import { DataSection } from "./data-section";
import { FormSection } from "./form-section";
import { PhotoSection } from "./photo-section";

const connection = {
	offline: { label: "Offline · 3 operações na fila", tone: "offline" },
	ok: { label: "Sincronizado há 2 min", tone: "ok" },
	warning: { label: "Sincronizando · 1 conflito protegido", tone: "warning" },
} as const;

type Connection = keyof typeof connection;

const tabs = [
	{ href: "#acoes", id: "acoes", label: "Ações e avisos" },
	{ href: "#formularios", id: "formularios", label: "Formulários" },
	{ href: "#fotos", id: "fotos", label: "Fotos" },
	{ href: "#dados", id: "dados", label: "Dados e progresso" },
];

export function CatalogPage() {
	const [state, setState] = useState<Connection>("offline");
	const status = (
		<SyncStatus tone={connection[state].tone}>
			{connection[state].label}
		</SyncStatus>
	);
	return (
		<div className="flex min-h-svh flex-col bg-background">
			<TopNav
				account={
					<TopNavAvatar aria-label="Conta de Rita Alves" initials="RA" />
				}
				activeId="hoje"
				groups={destinationGroups}
				items={destinations}
				search={<TopNavSearch />}
			/>
			<MobileHeader
				back={<MobileHeaderBack />}
				eyebrow="Design system"
				heading="Catálogo de componentes"
				status={connection[state].label}
			/>
			<SubTabs
				activeId="acoes"
				items={tabs}
				label="Seções do catálogo"
				status={status}
			/>
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-6 md:px-6">
				<div className="flex flex-col gap-3">
					<Eyebrow>Costura Pro · catálogo</Eyebrow>
					<Heading>Componentes e estados</Heading>
					<ChoiceChips
						aria-label="Estado da conexão"
						onValueChange={(value) => setState(value as Connection)}
						value={state}
					>
						<ChoiceChip value="ok">Online</ChoiceChip>
						<ChoiceChip value="warning">Atenção</ChoiceChip>
						<ChoiceChip value="offline">Offline</ChoiceChip>
					</ChoiceChips>
				</div>
				<ContentSection />
				<FormSection />
				<PhotoSection />
				<DataSection />
			</main>
			<MobileNav
				activeId="hoje"
				groups={destinationGroups}
				items={destinations}
			/>
		</div>
	);
}
