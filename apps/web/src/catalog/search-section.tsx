import { highlightRanges, searchTokens } from "@costura-pro/domain/search";
import { Button } from "@costura-pro/ui/components/button";
import {
	CommandPalette,
	CommandPaletteCollection,
	CommandPaletteEmpty,
	CommandPaletteFooter,
	CommandPaletteGroup,
	CommandPaletteGroupLabel,
	CommandPaletteInput,
	CommandPaletteItem,
	CommandPaletteKey,
	CommandPaletteList,
	CommandPaletteSearch,
} from "@costura-pro/ui/components/command-palette";
import { Highlight } from "@costura-pro/ui/components/highlight";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import {
	Tabs,
	TabsList,
	TabsPanel,
	TabsTab,
} from "@costura-pro/ui/components/tabs";
import { Text } from "@costura-pro/ui/components/typography";
import { useState } from "react";

import { CatalogSection } from "./catalog-section";

type SampleOption = { detail: string; id: string; name: string };
type SampleGroup = { id: string; items: SampleOption[]; label: string | null };

const sampleGroups: SampleGroup[] = [
	{
		id: "materiais",
		items: [{ detail: "Tecido · 2 variantes", id: "linho", name: "Linho" }],
		label: "Materiais · 1",
	},
	{
		id: "produtos",
		items: [
			{
				detail: "Roupa · 6 variantes",
				id: "vestido",
				name: "Vestido Midi de Linho",
			},
			{ detail: "Roupa · 1 variante", id: "avental", name: "Avental de Linho" },
		],
		label: "Produtos · 2",
	},
	{
		id: "mais",
		items: [{ detail: "", id: "todos", name: "Ver todos os 3 resultados" }],
		label: null,
	},
];

function mark(text: string, query: string) {
	return (
		<Highlight
			ranges={highlightRanges(text, searchTokens(query))}
			text={text}
		/>
	);
}

export function SearchSection({
	onPaletteOpenChange,
	paletteOpen,
}: {
	onPaletteOpenChange: (open: boolean) => void;
	paletteOpen: boolean;
}) {
	const [query, setQuery] = useState("linho");
	return (
		<CatalogSection heading="Busca" id="busca">
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					<Text>{mark("Conceição Lima", "conce lim")}</Text>
					<Text>{mark("Cru · LIN-CRU · 31,00 m", "lin-cru")}</Text>
					<Tabs defaultValue="materiais">
						<TabsList aria-label="Grupos da busca">
							<TabsTab count={9} value="tudo">
								Tudo
							</TabsTab>
							<TabsTab count={3} value="produtos">
								Produtos
							</TabsTab>
							<TabsTab count={6} value="materiais">
								Materiais
							</TabsTab>
						</TabsList>
						<TabsPanel value="tudo">
							<Text tone="subtle">5 por grupo, com "Ver os N" no fim.</Text>
						</TabsPanel>
						<TabsPanel value="produtos">
							<Text tone="subtle">O grupo inteiro, 50 por vez.</Text>
						</TabsPanel>
						<TabsPanel value="materiais">
							<Text tone="subtle">O grupo inteiro, 50 por vez.</Text>
						</TabsPanel>
					</Tabs>
					<Button
						className="self-start"
						onClick={() => onPaletteOpenChange(true)}
						variant="outline"
					>
						Abrir a busca rápida
					</Button>
				</PanelContent>
			</Panel>
			<CommandPalette
				label="Buscar"
				onOpenChange={onPaletteOpenChange}
				open={paletteOpen}
			>
				<CommandPaletteSearch
					items={query.trim().length >= 2 ? sampleGroups : []}
					itemToStringValue={(option: SampleOption) => option.name}
					onValueChange={setQuery}
					value={query}
				>
					<CommandPaletteInput
						aria-label="Buscar"
						placeholder="Buscar cliente, telefone, produto, material ou serviço"
					/>
					<CommandPaletteList>
						{(group: SampleGroup) => (
							<CommandPaletteGroup items={group.items} key={group.id}>
								{group.label ? (
									<CommandPaletteGroupLabel>
										{group.label}
									</CommandPaletteGroupLabel>
								) : null}
								<CommandPaletteCollection>
									{(option: SampleOption) => (
										<CommandPaletteItem
											key={option.id}
											onClick={() => onPaletteOpenChange(false)}
											value={option}
										>
											<Text inline weight="semibold">
												{mark(option.name, query)}
											</Text>
											{option.detail ? (
												<Text inline size="xs" tone="subtle">
													{option.detail}
												</Text>
											) : null}
										</CommandPaletteItem>
									)}
								</CommandPaletteCollection>
							</CommandPaletteGroup>
						)}
					</CommandPaletteList>
					<CommandPaletteEmpty>
						Digite pelo menos 2 letras ou números.
					</CommandPaletteEmpty>
					<CommandPaletteFooter>
						<Text inline size="xs" tone="muted">
							<CommandPaletteKey>↑</CommandPaletteKey>{" "}
							<CommandPaletteKey>↓</CommandPaletteKey> navegar
						</Text>
						<Text inline size="xs" tone="muted">
							<CommandPaletteKey>Enter</CommandPaletteKey> abrir
						</Text>
						<Text inline size="xs" tone="muted">
							<CommandPaletteKey>Esc</CommandPaletteKey> fechar
						</Text>
					</CommandPaletteFooter>
				</CommandPaletteSearch>
			</CommandPalette>
		</CatalogSection>
	);
}
