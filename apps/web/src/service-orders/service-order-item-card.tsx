import { Badge } from "@costura-pro/ui/components/badge";
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
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";
import { EllipsisIcon } from "lucide-react";
import { type RefObject, useRef, useState } from "react";

import { formatDay } from "@/lib/measurements";
import { type FlowStageView, productionBlocked } from "@/lib/production";
import {
	lineDetail,
	lineQuantityLabel,
	lineTitle,
	type PeopleNames,
} from "@/lib/quotes";
import {
	dueLabel,
	itemMaterials,
	type MaterialRowView,
	type ServiceOrderItemView,
} from "@/lib/service-orders";
import { pointQuantity } from "@/lib/stock";

import { ItemProduction } from "./item-production";
import { MeasurementSnapshot } from "./measurement-snapshot";
import { ReconciledMaterials } from "./reconciled-materials";
import { ReverseReconciliationDialog } from "./reverse-reconciliation-dialog";
import type { ReconciliationActions } from "./use-reconciliation-actions";

function amount(row: MaterialRowView, micros: bigint): string {
	return pointQuantity(micros.toString(), row.baseUnit, row.displayPrecision);
}

function ItemMaterials({
	number,
	rows,
}: {
	number: number;
	rows: readonly MaterialRowView[];
}) {
	return (
		<DataList
			aria-label={`Materiais do subitem ${number}`}
			className="border-divider border-t"
			columns="minmax(0,1fr) 6rem 6rem 7rem"
		>
			<DataListHeader>
				<DataListHeaderCell>Material</DataListHeaderCell>
				<DataListHeaderCell align="end">Previsto</DataListHeaderCell>
				<DataListHeaderCell align="end">Reservado</DataListHeaderCell>
				<DataListHeaderCell align="end">Falta</DataListHeaderCell>
			</DataListHeader>
			{rows.map((row) => (
				<DataListRow key={row.variantId}>
					<DataListCell label="Material">
						<Text weight="semibold">{row.label}</Text>
					</DataListCell>
					<DataListCell align="end" label="Previsto">
						<Text inline numeric>
							{amount(row, row.plannedMicros)}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Reservado">
						<Text inline numeric>
							{amount(row, row.reservedMicros)}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Falta">
						{row.shortageMicros > 0n ? (
							<Badge tone="warning">{amount(row, row.shortageMicros)}</Badge>
						) : (
							<Text inline tone="muted">
								sem falta
							</Text>
						)}
					</DataListCell>
				</DataListRow>
			))}
		</DataList>
	);
}

function ItemMenu({
	number,
	onReverse,
	trigger,
}: {
	number: number;
	onReverse: () => void;
	trigger: RefObject<HTMLButtonElement | null>;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={`Mais ações do subitem ${number}`}
						ref={trigger}
						size="icon"
						variant="ghost"
					/>
				}
			>
				<EllipsisIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuItem onClick={onReverse}>
					Estornar reconciliação
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ItemMaterialsOf({
	item,
	number,
}: {
	item: ServiceOrderItemView;
	number: number;
}) {
	if (item.reconciliation) {
		return <ReconciledMaterials item={item} number={number} />;
	}
	const rows = itemMaterials(item);
	return rows.length > 0 ? <ItemMaterials number={number} rows={rows} /> : null;
}

export function ServiceOrderItemCard({
	flowStages,
	item,
	number,
	order,
	people,
	reconciliation,
	today,
}: {
	flowStages: readonly FlowStageView[] | null;
	item: ServiceOrderItemView;
	number: number;
	order: { code: string; openedOn: string };
	people: PeopleNames;
	reconciliation: ReconciliationActions;
	today: string;
}) {
	const { line } = item;
	const due = dueLabel(item.dueOn, today);
	const profiled = line.kind !== "material" && line.profileId !== null;
	const missing = productionBlocked(item);
	const status = useRef<HTMLParagraphElement>(null);
	const menu = useRef<HTMLButtonElement>(null);
	const [reversing, setReversing] = useState(false);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{`Subitem ${number} · ${lineTitle(line)}`}</PanelTitle>
				{due.late || missing !== null || item.reconciliation ? (
					<div className="flex flex-wrap items-center gap-1">
						{due.late ? <Badge tone="warning">prazo vencido</Badge> : null}
						{missing === null ? null : (
							<Badge tone="danger">{`bloqueado · falta ${missing}`}</Badge>
						)}
						{item.reconciliation ? (
							<ItemMenu
								number={number}
								onReverse={() => setReversing(true)}
								trigger={menu}
							/>
						) : null}
					</div>
				) : null}
			</PanelHeader>
			<PanelContent className="flex flex-col gap-3">
				<div className="flex flex-col gap-0.5">
					<Text size="xs" tone="subtle">
						{`${lineDetail(line, people)} · ${lineQuantityLabel(line)}`}
					</Text>
					<Text size="xs" tone="subtle">
						{`Prazo ${due.text} · Entrega: pendente`}
					</Text>
					{item.reconciliation ? (
						<Text size="xs" tone="subtle">
							{`Reconciliada em ${formatDay(item.reconciliation.occurredOn)}`}
						</Text>
					) : null}
					{line.note ? (
						<Text size="xs" tone="muted">
							{line.note}
						</Text>
					) : null}
				</div>
				<ItemProduction
					flowStages={flowStages}
					item={item}
					itemTitle={lineTitle(line)}
					number={number}
					order={order}
					reconciliation={reconciliation}
					status={status}
				/>
				{profiled ? (
					<MeasurementSnapshot snapshots={item.measurements} />
				) : null}
			</PanelContent>
			<ItemMaterialsOf item={item} number={number} />
			<ReverseReconciliationDialog
				actions={reconciliation}
				finalFocus={() =>
					menu.current?.isConnected ? menu.current : status.current
				}
				itemTitle={`Subitem ${number} · ${lineTitle(line)}`}
				onOpenChange={setReversing}
				open={reversing}
				reconciliation={item.reconciliation}
			/>
		</Panel>
	);
}
