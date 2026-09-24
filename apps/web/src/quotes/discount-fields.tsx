import { quoteLimits } from "@costura-pro/domain/quote";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";

import type {
	DiscountDraft,
	DiscountErrors,
	DiscountKind,
} from "@/lib/quote-drafts";

import { type FieldRef, QuoteField } from "./quote-field";

export function DiscountFields({
	draft,
	errors,
	fieldRef,
	legend = "Desconto",
	onChange,
}: {
	draft: DiscountDraft;
	errors: DiscountErrors;
	fieldRef: FieldRef<"discount" | "reason">;
	legend?: string;
	onChange: (draft: DiscountDraft) => void;
}) {
	return (
		<>
			<Fieldset>
				<FieldsetLegend>{legend}</FieldsetLegend>
				<ChoiceChips
					onValueChange={(kind) =>
						onChange({ ...draft, kind: kind as DiscountKind, value: "" })
					}
					value={draft.kind}
				>
					<ChoiceChip value="none">Sem desconto</ChoiceChip>
					<ChoiceChip value="amount">Valor</ChoiceChip>
					<ChoiceChip value="percent">Percentual</ChoiceChip>
				</ChoiceChips>
			</Fieldset>
			{draft.kind === "none" ? null : (
				<>
					<QuoteField
						error={errors.discount}
						hint={
							draft.kind === "percent"
								? "De 0,01% a 100%."
								: "Em reais, sobre o valor."
						}
						label={
							draft.kind === "percent"
								? "Percentual do desconto"
								: "Valor do desconto"
						}
						name="discount"
						requirement="required"
					>
						<NumberField
							aria-invalid={errors.discount ? true : undefined}
							maxLength={20}
							onChange={(event) =>
								onChange({ ...draft, value: event.target.value })
							}
							ref={fieldRef("discount")}
							suffix={draft.kind === "percent" ? "%" : "R$"}
							value={draft.value}
						/>
					</QuoteField>
					<QuoteField
						error={errors.reason}
						label="Motivo do desconto"
						name="reason"
						requirement="optional"
					>
						<Input
							aria-invalid={errors.reason ? true : undefined}
							maxLength={quoteLimits.discountReason}
							onChange={(event) =>
								onChange({ ...draft, reason: event.target.value })
							}
							ref={fieldRef("reason")}
							value={draft.reason}
						/>
					</QuoteField>
				</>
			)}
		</>
	);
}
