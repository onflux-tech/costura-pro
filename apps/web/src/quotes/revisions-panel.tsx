import { ButtonLink } from "@costura-pro/ui/components/button-link";
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
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import { moneyLabel } from "@/lib/finance";
import { formatDay } from "@/lib/measurements";
import type { QuoteRevisionView } from "@/lib/quotes";

export function RevisionsPanel({
	quoteId,
	revisions,
}: {
	quoteId: string;
	revisions: readonly QuoteRevisionView[];
}) {
	if (revisions.length === 0) {
		return null;
	}
	const ordered = [...revisions].sort(
		(left, right) => right.number - left.number
	);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Revisões emitidas</PanelTitle>
			</PanelHeader>
			<DataList
				aria-label="Revisões emitidas"
				columns="minmax(0,1fr) 8rem 8rem 8rem"
			>
				<DataListHeader>
					<DataListHeaderCell>Revisão</DataListHeaderCell>
					<DataListHeaderCell>Emitida em</DataListHeaderCell>
					<DataListHeaderCell>Válida até</DataListHeaderCell>
					<DataListHeaderCell align="end">Total</DataListHeaderCell>
				</DataListHeader>
				{ordered.map((revision) => (
					<DataListRow key={revision.id}>
						<DataListCell label="Revisão">
							<div className="flex min-w-0 flex-col items-start gap-0.5">
								<ButtonLink
									className="h-auto min-h-11 justify-start px-0 md:min-h-0"
									render={
										<Link
											params={{
												numero: String(revision.number),
												orcamentoId: quoteId,
											}}
											to="/orcamentos/$orcamentoId/revisoes/$numero"
										/>
									}
									variant="link"
								>
									{`Revisão ${revision.number}`}
								</ButtonLink>
								{revision.reason ? (
									<Text size="xs" tone="subtle">
										{revision.reason}
									</Text>
								) : null}
							</div>
						</DataListCell>
						<DataListCell label="Emitida em">
							<Text inline>{formatDay(revision.emittedOn)}</Text>
						</DataListCell>
						<DataListCell label="Válida até">
							<Text inline>{formatDay(revision.validUntil)}</Text>
						</DataListCell>
						<DataListCell align="end" label="Total">
							<Text inline numeric>
								{moneyLabel(revision.totalCents)}
							</Text>
						</DataListCell>
					</DataListRow>
				))}
			</DataList>
		</Panel>
	);
}
