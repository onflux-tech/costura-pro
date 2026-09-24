import { formatQuantity } from "@costura-pro/domain/quantity";
import { quoteLimits } from "@costura-pro/domain/quote";
import { Button } from "@costura-pro/ui/components/button";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@costura-pro/ui/components/dropdown-menu";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Mono, Text } from "@costura-pro/ui/components/typography";
import { EllipsisIcon, PlusIcon } from "lucide-react";

import { moneyLabel } from "@/lib/finance";
import { unitAbbreviation } from "@/lib/materials";
import { pieceCostOf } from "@/lib/quote-drafts";
import type { QuoteComponentView } from "@/lib/quotes";

function titleOf(component: QuoteComponentView): string {
	return component.kind === "material"
		? `${component.materialName} · ${component.variantName}`
		: component.serviceName;
}

function quantityOf(component: QuoteComponentView): string {
	if (component.kind === "service") {
		return component.count === 1 ? "1 vez" : `${component.count} vezes`;
	}
	return `${formatQuantity(BigInt(component.quantityMicros), component.displayPrecision)} ${unitAbbreviation(component.baseUnit)}`;
}

function CostText({ cents }: { cents: bigint | string | null }) {
	if (cents === null) {
		return (
			<Text inline size="sm" tone="warning">
				sem custo
			</Text>
		);
	}
	return (
		<Text inline numeric>
			{moneyLabel(cents)}
		</Text>
	);
}

function ComponentRow({
	component,
	onEdit,
	onRemove,
}: {
	component: QuoteComponentView;
	onEdit: (component: QuoteComponentView) => void;
	onRemove: (component: QuoteComponentView) => void;
}) {
	const title = titleOf(component);
	return (
		<DataListRow>
			<DataListCell label="Componente">
				<div className="flex min-w-0 flex-col gap-0.5">
					<Text weight="semibold">{title}</Text>
					{component.kind === "material" && component.code ? (
						<Mono size="2xs" tone="muted">
							{component.code}
						</Mono>
					) : null}
					<Text size="xs" tone="subtle">
						{component.kind === "service"
							? "serviço"
							: unitAbbreviation(component.baseUnit)}
					</Text>
				</div>
			</DataListCell>
			<DataListCell align="end" label="Por peça">
				<Text inline numeric>
					{quantityOf(component)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Custo unit.">
				<CostText cents={component.unitCostCents} />
			</DataListCell>
			<DataListCell align="end" label="Custo">
				<CostText cents={pieceCostOf([component])} />
			</DataListCell>
			<DataListCell align="end" label="Ações">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								aria-label={`Ações de ${title}`}
								size="icon"
								variant="ghost"
							/>
						}
					>
						<EllipsisIcon aria-hidden="true" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-40">
						<DropdownMenuItem onClick={() => onEdit(component)}>
							Editar
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => onRemove(component)}
							variant="destructive"
						>
							Tirar
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</DataListCell>
		</DataListRow>
	);
}

export function PieceComponents({
	components,
	onAdd,
	onEdit,
	onRemove,
}: {
	components: readonly QuoteComponentView[];
	onAdd: (kind: "newMaterial" | "newService") => void;
	onEdit: (component: QuoteComponentView) => void;
	onRemove: (component: QuoteComponentView) => void;
}) {
	const cost = pieceCostOf(components);
	const full = components.length >= quoteLimits.components;
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Componentes de uma peça</PanelTitle>
				<PanelMeta>
					{cost === null
						? "Custo incompleto"
						: `Custo por peça ${moneyLabel(cost)}`}
				</PanelMeta>
			</PanelHeader>
			{components.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">
						Nenhum componente ainda. Parta da ficha de um produto ou acrescente
						os materiais e serviços de uma peça.
					</Text>
				</PanelContent>
			) : (
				<DataList
					aria-label="Componentes de uma peça"
					columns="minmax(0,1fr) 7rem 7rem 7rem 3rem"
				>
					<DataListHeader>
						<DataListHeaderCell>Componente</DataListHeaderCell>
						<DataListHeaderCell align="end">Por peça</DataListHeaderCell>
						<DataListHeaderCell align="end">Custo unit.</DataListHeaderCell>
						<DataListHeaderCell align="end">Custo</DataListHeaderCell>
						<DataListHeaderCell align="end">Ações</DataListHeaderCell>
					</DataListHeader>
					{components.map((component) => (
						<ComponentRow
							component={component}
							key={component.id}
							onEdit={onEdit}
							onRemove={onRemove}
						/>
					))}
				</DataList>
			)}
			<PanelContent className="flex flex-col gap-2 border-divider border-t">
				<div className="flex flex-wrap gap-2">
					<Button
						aria-label="Acrescentar material"
						disabled={full}
						onClick={() => onAdd("newMaterial")}
						variant="outline"
					>
						<PlusIcon aria-hidden="true" />
						Material
					</Button>
					<Button
						aria-label="Acrescentar serviço"
						disabled={full}
						onClick={() => onAdd("newService")}
						variant="outline"
					>
						<PlusIcon aria-hidden="true" />
						Serviço
					</Button>
				</div>
				{full ? (
					<Text size="xs" tone="muted">
						{`A peça já tem ${quoteLimits.components} componentes, o máximo.`}
					</Text>
				) : null}
			</PanelContent>
		</Panel>
	);
}
