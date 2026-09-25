import { Badge } from "@costura-pro/ui/components/badge";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";

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

export function ServiceOrderItemCard({
	flowStages,
	item,
	number,
	people,
	today,
}: {
	flowStages: readonly FlowStageView[] | null;
	item: ServiceOrderItemView;
	number: number;
	people: PeopleNames;
	today: string;
}) {
	const { line } = item;
	const due = dueLabel(item.dueOn, today);
	const rows = itemMaterials(item);
	const profiled = line.kind !== "material" && line.profileId !== null;
	const missing = productionBlocked(item);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{`Subitem ${number} · ${lineTitle(line)}`}</PanelTitle>
				{due.late || missing !== null ? (
					<div className="flex flex-wrap gap-1">
						{due.late ? <Badge tone="warning">prazo vencido</Badge> : null}
						{missing === null ? null : (
							<Badge tone="danger">{`bloqueado · falta ${missing}`}</Badge>
						)}
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
				/>
				{profiled ? (
					<MeasurementSnapshot snapshots={item.measurements} />
				) : null}
			</PanelContent>
			{rows.length > 0 ? <ItemMaterials number={number} rows={rows} /> : null}
		</Panel>
	);
}
