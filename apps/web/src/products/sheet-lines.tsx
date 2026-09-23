import { Badge } from "@costura-pro/ui/components/badge";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Mono, Text } from "@costura-pro/ui/components/typography";
import type { ReactNode } from "react";

import { moneyLabel } from "@/lib/finance";
import {
	itemTitle,
	lossLabel,
	materialReferenceFor,
	type ProductReferences,
	quantityLabel,
	type SheetItemView,
	serviceReferenceFor,
} from "@/lib/products";

export type SheetLineRow = {
	actions?: ReactNode;
	cost: bigint | null;
	item: SheetItemView;
	outside?: boolean;
	tag?: string;
};

function costText(row: SheetLineRow): ReactNode {
	if (row.outside) {
		return (
			<Text inline size="sm" tone="muted">
				fora desta variante
			</Text>
		);
	}
	if (row.cost === null) {
		return (
			<Text inline size="sm" tone="warning">
				sem custo
			</Text>
		);
	}
	return (
		<Text inline numeric>
			{moneyLabel(row.cost)}
		</Text>
	);
}

function SheetLine({
	references,
	row,
}: {
	references: ProductReferences;
	row: SheetLineRow;
}) {
	const { item } = row;
	const material =
		item.kind === "material"
			? materialReferenceFor(references, item.materialVariantId)
			: undefined;
	const service =
		item.kind === "service"
			? serviceReferenceFor(references, item.serviceId)
			: undefined;
	const archived = material?.archived ?? service?.archived ?? false;
	const details = [
		item.kind === "material" ? lossLabel(item, material) : null,
		item.note,
	].filter((detail): detail is string => Boolean(detail));
	const quantity =
		item.kind === "material"
			? quantityLabel(item, material)
			: `× ${item.count}`;
	return (
		<DataListRow>
			<DataListCell label="Item">
				<div className="flex min-w-0 flex-col gap-0.5">
					<Text tone={row.outside ? "muted" : "default"} weight="semibold">
						{itemTitle(item, references)}
					</Text>
					{material?.code ? (
						<Mono size="2xs" tone="muted">
							{material.code}
						</Mono>
					) : null}
					{details.map((detail) => (
						<Text key={detail} size="xs" tone="muted">
							{detail}
						</Text>
					))}
					{row.tag || archived ? (
						<div className="flex flex-wrap gap-1">
							{row.tag ? <Badge>{row.tag}</Badge> : null}
							{archived ? <Badge tone="warning">arquivado</Badge> : null}
						</div>
					) : null}
					{row.actions ? (
						<div className="flex flex-wrap gap-2 pt-1">{row.actions}</div>
					) : null}
				</div>
			</DataListCell>
			<DataListCell align="end" label="Quantidade">
				<Text inline numeric tone={row.outside ? "muted" : "default"}>
					{quantity}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Custo">
				{costText(row)}
			</DataListCell>
		</DataListRow>
	);
}

export function SheetLines({
	label,
	references,
	rows,
}: {
	label: string;
	references: ProductReferences;
	rows: readonly SheetLineRow[];
}) {
	return (
		<DataList aria-label={label} columns="minmax(0,1fr) 9rem 8rem">
			<DataListHeader>
				<DataListHeaderCell>Item</DataListHeaderCell>
				<DataListHeaderCell align="end">Quantidade</DataListHeaderCell>
				<DataListHeaderCell align="end">Custo</DataListHeaderCell>
			</DataListHeader>
			{rows.map((row) => (
				<SheetLine key={row.item.id} references={references} row={row} />
			))}
		</DataList>
	);
}
