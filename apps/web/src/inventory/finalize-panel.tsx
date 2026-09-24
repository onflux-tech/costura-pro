import { inventoryLimits } from "@costura-pro/domain/stock";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import type { FinalizeField, InventoryDraft } from "@/lib/inventory";

type Register = (field: FinalizeField) => (element: HTMLElement | null) => void;

type Details = Partial<Pick<InventoryDraft, "notes" | "occurredOn" | "reason">>;

function uncountedNote(count: number): string {
	return count === 1
		? "1 ponto não contado fica como está."
		: `${count} pontos não contados ficam como estão.`;
}

export function FinalizePanel({
	draft,
	errors,
	invalidItems,
	onDetails,
	onFinalize,
	register,
	submitting,
	uncounted,
}: {
	draft: InventoryDraft;
	errors: Partial<Record<FinalizeField, string>>;
	invalidItems: readonly string[];
	onDetails: (details: Details) => void;
	onFinalize: () => void;
	register: Register;
	submitting: boolean;
	uncounted: number;
}) {
	const submitLabel = submitting ? "Finalizando..." : "Finalizar contagem";
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Finalizar</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-4">
				<Field
					invalid={Boolean(errors.reason)}
					name="reason"
					ref={register("reason")}
				>
					<FieldLabel requirement="required">Motivo</FieldLabel>
					<Input
						aria-invalid={Boolean(errors.reason) || undefined}
						maxLength={inventoryLimits.reason.max}
						onChange={(event) => onDetails({ reason: event.target.value })}
						placeholder="Inventário anual"
						value={draft.reason}
					/>
					{errors.reason ? (
						<FieldError match>{errors.reason}</FieldError>
					) : null}
				</Field>
				<Field
					className="md:w-56"
					invalid={Boolean(errors.occurredOn)}
					name="occurredOn"
					ref={register("occurredOn")}
				>
					<FieldLabel requirement="required">Data</FieldLabel>
					<Input
						aria-invalid={Boolean(errors.occurredOn) || undefined}
						onChange={(event) => onDetails({ occurredOn: event.target.value })}
						type="date"
						value={draft.occurredOn}
					/>
					{errors.occurredOn ? (
						<FieldError match>{errors.occurredOn}</FieldError>
					) : null}
				</Field>
				<Field
					invalid={Boolean(errors.notes)}
					name="notes"
					ref={register("notes")}
				>
					<FieldLabel requirement="optional">Notas</FieldLabel>
					<Textarea
						aria-invalid={Boolean(errors.notes) || undefined}
						maxLength={inventoryLimits.notes}
						onChange={(event) => onDetails({ notes: event.target.value })}
						value={draft.notes}
					/>
					{errors.notes ? <FieldError match>{errors.notes}</FieldError> : null}
				</Field>
				{uncounted > 0 ? (
					<Text tone="subtle">{uncountedNote(uncounted)}</Text>
				) : null}
				{errors.lines ? (
					<Alert
						ref={register("lines")}
						role="alert"
						tabIndex={-1}
						tone="danger"
					>
						<AlertTitle>Não dá para finalizar ainda</AlertTitle>
						<AlertDescription>
							{invalidItems.length > 0
								? `${errors.lines}: ${invalidItems.join("; ")}.`
								: errors.lines}
						</AlertDescription>
					</Alert>
				) : null}
				<div className="flex flex-wrap gap-2">
					<ButtonLink
						className="max-md:w-full"
						render={<Link to="/estoque/inventario/contagem" />}
						variant="outline"
					>
						Voltar para a contagem
					</ButtonLink>
					<Button
						className="max-md:w-full"
						disabled={submitting}
						onClick={onFinalize}
						type="button"
					>
						{submitLabel}
					</Button>
				</div>
			</PanelContent>
		</Panel>
	);
}
