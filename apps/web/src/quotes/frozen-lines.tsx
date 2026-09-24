import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel } from "@/lib/finance";
import {
	discountLabel,
	type FrozenLineView,
	lineDetail,
	lineQuantityLabel,
	lineTitle,
	type PeopleNames,
} from "@/lib/quotes";

export function FrozenLines({
	lines,
	people,
}: {
	lines: readonly FrozenLineView[];
	people: PeopleNames;
}) {
	return (
		<DataList
			aria-label="Itens da revisão"
			columns="minmax(0,1fr) 6rem 6rem 8rem 8rem"
		>
			<DataListHeader>
				<DataListHeaderCell>Item</DataListHeaderCell>
				<DataListHeaderCell align="end">Qtd</DataListHeaderCell>
				<DataListHeaderCell align="end">Desconto</DataListHeaderCell>
				<DataListHeaderCell align="end">Preço unit.</DataListHeaderCell>
				<DataListHeaderCell align="end">Total</DataListHeaderCell>
			</DataListHeader>
			{lines.map((line) => {
				const discount = discountLabel(line.discount);
				return (
					<DataListRow key={line.id}>
						<DataListCell label="Item">
							<div className="flex min-w-0 flex-col gap-0.5">
								<Text weight="semibold">{lineTitle(line)}</Text>
								<Text size="xs" tone="subtle">
									{lineDetail(line, people)}
								</Text>
								{line.note ? (
									<Text size="xs" tone="muted">
										{line.note}
									</Text>
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
								{moneyLabel(line.totalCents)}
							</Text>
						</DataListCell>
					</DataListRow>
				);
			})}
		</DataList>
	);
}
