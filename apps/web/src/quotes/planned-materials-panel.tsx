import { formatQuantity } from "@costura-pro/domain/quantity";
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
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Mono, Text } from "@costura-pro/ui/components/typography";

import { unitAbbreviation } from "@/lib/materials";
import {
	type PlannedMaterialView,
	plannedMaterialsView,
	type QuoteDetailView,
	type QuoteLineView,
} from "@/lib/quotes";

function amount(row: PlannedMaterialView, micros: bigint): string {
	return `${formatQuantity(micros, row.displayPrecision)} ${unitAbbreviation(row.baseUnit)}`;
}

export function PlannedMaterialsPanel({
	lines,
	stock,
}: {
	lines: readonly QuoteLineView[];
	stock: QuoteDetailView["stock"];
}) {
	const rows = plannedMaterialsView(lines, stock);
	if (rows.length === 0) {
		return null;
	}
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Materiais previstos</PanelTitle>
				<PanelMeta>
					Disponível = físico menos o reservado para outras OS. A reserva
					acontece na aprovação.
				</PanelMeta>
			</PanelHeader>
			<DataList
				aria-label="Materiais previstos"
				columns="minmax(0,1fr) 7rem 7rem 8rem"
			>
				<DataListHeader>
					<DataListHeaderCell>Variante</DataListHeaderCell>
					<DataListHeaderCell align="end">Previsto</DataListHeaderCell>
					<DataListHeaderCell align="end">Disponível</DataListHeaderCell>
					<DataListHeaderCell>Situação</DataListHeaderCell>
				</DataListHeader>
				{rows.map((row) => (
					<DataListRow key={row.variantId}>
						<DataListCell label="Variante">
							<div className="flex min-w-0 flex-col gap-0.5">
								<Text weight="semibold">{row.label}</Text>
								{row.code ? (
									<Mono size="2xs" tone="muted">
										{row.code}
									</Mono>
								) : null}
							</div>
						</DataListCell>
						<DataListCell align="end" label="Previsto">
							<Text inline numeric>
								{amount(row, row.plannedMicros)}
							</Text>
						</DataListCell>
						<DataListCell align="end" label="Disponível">
							<div className="flex flex-col gap-0.5">
								<Text inline numeric>
									{amount(row, row.availableMicros)}
								</Text>
								{row.reservedMicros > 0n ? (
									<Text size="xs" tone="muted">
										{`reservado ${amount(row, row.reservedMicros)}`}
									</Text>
								) : null}
							</div>
						</DataListCell>
						<DataListCell label="Situação">
							{row.shortageMicros > 0n ? (
								<Badge tone="warning">
									{`falta ${amount(row, row.shortageMicros)}`}
								</Badge>
							) : (
								<Badge tone="success">suficiente</Badge>
							)}
						</DataListCell>
					</DataListRow>
				))}
			</DataList>
		</Panel>
	);
}
