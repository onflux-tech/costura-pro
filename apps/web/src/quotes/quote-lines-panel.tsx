import { type QuoteTotals, quoteLimits } from "@costura-pro/domain/quote";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
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
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { EllipsisIcon, PlusIcon } from "lucide-react";

import { moneyLabel } from "@/lib/finance";
import {
	discountLabel,
	lineDetail,
	lineQuantityLabel,
	lineTitle,
	type PeopleNames,
	type QuoteLineView,
} from "@/lib/quotes";

export type NewLineKind = "free" | "material" | "service";

function missingCost(line: QuoteLineView): boolean {
	if (line.kind === "service") {
		return false;
	}
	if (line.kind === "custom") {
		return (
			line.components.length === 0 ||
			line.components.some(
				(component) =>
					component.kind === "material" && component.unitCostCents === null
			)
		);
	}
	return line.unitCostCents === null;
}

function LineRow({
	editable,
	line,
	onEdit,
	onRemove,
	people,
	totalCents,
}: {
	editable: boolean;
	line: QuoteLineView;
	onEdit: (line: QuoteLineView) => void;
	onRemove: (line: QuoteLineView) => void;
	people: PeopleNames;
	totalCents: bigint;
}) {
	const title = lineTitle(line);
	const discount = discountLabel(line.discount);
	return (
		<DataListRow>
			<DataListCell label="Item">
				<div className="flex min-w-0 flex-col gap-0.5">
					<Text weight="semibold">{title}</Text>
					<Text size="xs" tone="subtle">
						{lineDetail(line, people)}
					</Text>
					{line.note ? (
						<Text size="xs" tone="muted">
							{line.note}
						</Text>
					) : null}
					{missingCost(line) ? (
						<div className="flex flex-wrap gap-1">
							<Badge tone="warning">custo incompleto</Badge>
						</div>
					) : null}
				</div>
			</DataListCell>
			<DataListCell align="end" label="Qtd">
				<Text inline numeric>
					{lineQuantityLabel(line)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Desconto">
				<Text inline numeric tone={discount ? "default" : "muted"}>
					{discount ?? "sem"}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Preço unit.">
				<Text inline numeric>
					{moneyLabel(line.unitPriceCents)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Total">
				<Text inline numeric weight="semibold">
					{moneyLabel(totalCents)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Ações">
				{editable ? (
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
							<DropdownMenuItem onClick={() => onEdit(line)}>
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => onRemove(line)}
								variant="destructive"
							>
								Tirar
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</DataListCell>
		</DataListRow>
	);
}

export function QuoteLinesPanel({
	busy,
	editable,
	lines,
	onAdd,
	onEdit,
	onRemove,
	people,
	quoteId,
	totals,
}: {
	busy: boolean;
	editable: boolean;
	lines: readonly QuoteLineView[];
	onAdd: (kind: NewLineKind) => void;
	onEdit: (line: QuoteLineView) => void;
	onRemove: (line: QuoteLineView) => void;
	people: PeopleNames;
	quoteId: string;
	totals: QuoteTotals;
}) {
	const full = lines.length >= quoteLimits.lines;
	const addDisabled = full || busy;
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Itens</PanelTitle>
				<PanelMeta>
					{lines.length === 1 ? "1 item" : `${lines.length} itens`}
				</PanelMeta>
			</PanelHeader>
			{lines.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">
						Nenhum item ainda. Acrescente serviços, peças sob medida, materiais
						ou linhas livres.
					</Text>
				</PanelContent>
			) : (
				<DataList
					aria-label="Itens do orçamento"
					columns="minmax(0,1fr) 6rem 6rem 8rem 8rem 3rem"
				>
					<DataListHeader>
						<DataListHeaderCell>Item</DataListHeaderCell>
						<DataListHeaderCell align="end">Qtd</DataListHeaderCell>
						<DataListHeaderCell align="end">Desconto</DataListHeaderCell>
						<DataListHeaderCell align="end">Preço unit.</DataListHeaderCell>
						<DataListHeaderCell align="end">Total</DataListHeaderCell>
						<DataListHeaderCell align="end">Ações</DataListHeaderCell>
					</DataListHeader>
					{lines.map((line, index) => (
						<LineRow
							editable={editable}
							key={line.id}
							line={line}
							onEdit={onEdit}
							onRemove={onRemove}
							people={people}
							totalCents={totals.lines[index]?.totalCents ?? 0n}
						/>
					))}
				</DataList>
			)}
			{editable ? (
				<PanelContent className="flex flex-col gap-2 border-divider border-t">
					<div className="flex flex-wrap gap-2">
						<Button
							aria-label="Acrescentar serviço"
							disabled={addDisabled}
							onClick={() => onAdd("service")}
							variant="outline"
						>
							<PlusIcon aria-hidden="true" />
							Serviço
						</Button>
						{addDisabled ? (
							<Button disabled variant="outline">
								<PlusIcon aria-hidden="true" />
								Peça sob medida
							</Button>
						) : (
							<ButtonLink
								aria-label="Acrescentar peça sob medida"
								render={
									<Link
										params={{ orcamentoId: quoteId }}
										to="/orcamentos/$orcamentoId/pecas/nova"
									/>
								}
								variant="outline"
							>
								<PlusIcon aria-hidden="true" />
								Peça sob medida
							</ButtonLink>
						)}
						<Button
							aria-label="Acrescentar material"
							disabled={addDisabled}
							onClick={() => onAdd("material")}
							variant="outline"
						>
							<PlusIcon aria-hidden="true" />
							Material
						</Button>
						<Button
							aria-label="Acrescentar linha livre"
							disabled={addDisabled}
							onClick={() => onAdd("free")}
							variant="outline"
						>
							<PlusIcon aria-hidden="true" />
							Linha livre
						</Button>
					</div>
					{full ? (
						<Text size="xs" tone="muted">
							{`O orçamento já tem ${quoteLimits.lines} itens, o máximo.`}
						</Text>
					) : null}
				</PanelContent>
			) : null}
		</Panel>
	);
}
