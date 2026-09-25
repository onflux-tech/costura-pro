import { Badge } from "@costura-pro/ui/components/badge";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Text } from "@costura-pro/ui/components/typography";

import {
	type ReconciledRow,
	reconciledRows,
	type ServiceOrderItemView,
} from "@/lib/service-orders";

function Leftover({ row }: { row: ReconciledRow }) {
	if (row.extra !== null) {
		return <Badge tone="warning">{`${row.extra} a mais`}</Badge>;
	}
	if (row.leftover === null) {
		return (
			<Text inline tone="muted">
				sem sobra
			</Text>
		);
	}
	return (
		<Text inline numeric>
			{row.leftover}
		</Text>
	);
}

export function ReconciledMaterials({
	item,
	number,
}: {
	item: Pick<ServiceOrderItemView, "line" | "reconciliation">;
	number: number;
}) {
	return (
		<DataList
			aria-label={`Materiais do subitem ${number}`}
			className="border-divider border-t"
			columns="minmax(0,1fr) 6rem 6rem 6rem 7rem"
		>
			<DataListHeader>
				<DataListHeaderCell>Material</DataListHeaderCell>
				<DataListHeaderCell align="end">Previsto</DataListHeaderCell>
				<DataListHeaderCell align="end">Consumido</DataListHeaderCell>
				<DataListHeaderCell align="end">Perdido</DataListHeaderCell>
				<DataListHeaderCell align="end">Sobra</DataListHeaderCell>
			</DataListHeader>
			{reconciledRows(item).map((row) => (
				<DataListRow key={`${row.label}|${row.swap ?? ""}`}>
					<DataListCell label="Material">
						<Text weight="semibold">{row.label}</Text>
						{row.swap === null ? null : (
							<Text size="xs" tone="subtle">
								{row.swap}
							</Text>
						)}
					</DataListCell>
					<DataListCell align="end" label="Previsto">
						<Text inline numeric>
							{row.planned}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Consumido">
						<Text inline numeric>
							{row.consumed}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Perdido">
						<Text inline numeric>
							{row.lost}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Sobra">
						<Leftover row={row} />
					</DataListCell>
				</DataListRow>
			))}
		</DataList>
	);
}
