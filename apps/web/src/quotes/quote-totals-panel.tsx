import type { QuoteTotals } from "@costura-pro/domain/quote";
import { Button } from "@costura-pro/ui/components/button";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Stat } from "@costura-pro/ui/components/stat";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel, signedMoney } from "@/lib/finance";
import { discountLabel, type QuoteContentView } from "@/lib/quotes";

function TotalRow({
	hint,
	label,
	value,
}: {
	hint?: string;
	label: string;
	value: string;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<div className="flex items-baseline justify-between gap-3">
				<Text inline tone="subtle">
					{label}
				</Text>
				<Text inline numeric>
					{value}
				</Text>
			</div>
			{hint ? (
				<Text size="xs" tone="muted">
					{hint}
				</Text>
			) : null}
		</div>
	);
}

function days(count: number): string {
	return count === 1 ? "1 dia" : `${count} dias`;
}

function documentDiscountHint(content: QuoteContentView): string | undefined {
	const { discount } = content;
	if (discount === null) {
		return;
	}
	const parts = [
		discount.kind === "percent" ? discountLabel(discount) : null,
		discount.reason,
	].filter((part): part is string => Boolean(part));
	return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function QuoteTotalsPanel({
	content,
	editable,
	onEditConditions,
	totals,
}: {
	content: QuoteContentView;
	editable: boolean;
	onEditConditions: () => void;
	totals: QuoteTotals;
}) {
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Totais e condições</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-3">
				<TotalRow
					hint={
						totals.lineDiscountCents > 0n
							? `Já com ${moneyLabel(totals.lineDiscountCents)} de desconto nas linhas.`
							: undefined
					}
					label="Subtotal"
					value={moneyLabel(totals.subtotalCents)}
				/>
				<TotalRow
					hint={documentDiscountHint(content)}
					label="Desconto no orçamento"
					value={
						totals.documentDiscountCents > 0n
							? signedMoney(String(-totals.documentDiscountCents))
							: "sem desconto"
					}
				/>
				<Stat label="Total ao cliente" value={moneyLabel(totals.totalCents)} />
				<div className="flex flex-col gap-1 border-divider border-t pt-3">
					<TotalRow
						label="Validade"
						value={`${days(content.validityDays)} após a emissão`}
					/>
					<TotalRow
						label="Prazo de entrega"
						value={
							content.leadTimeDays === null
								? "a combinar"
								: `${days(content.leadTimeDays)} após a aprovação`
						}
					/>
					{content.notes ? (
						<Text size="xs" tone="subtle">
							{content.notes}
						</Text>
					) : null}
				</div>
				{editable ? (
					<Button
						className="self-start"
						onClick={onEditConditions}
						variant="outline"
					>
						Editar condições
					</Button>
				) : null}
			</PanelContent>
		</Panel>
	);
}
