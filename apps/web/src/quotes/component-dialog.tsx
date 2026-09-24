import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Text } from "@costura-pro/ui/components/typography";
import { useState } from "react";

import { moneyLabel } from "@/lib/finance";
import { unitAbbreviation } from "@/lib/materials";
import {
	type ComponentDraft,
	componentDraftOf,
	componentErrors,
	componentOf,
	materialComponentDraft,
	type ServiceComponentDraft,
	serviceComponentDraft,
	serviceCopyOf,
} from "@/lib/quote-drafts";
import type { QuoteComponentView } from "@/lib/quotes";
import { VariantPicker } from "@/materials/variant-picker";
import { ServicePicker } from "@/products/service-picker";

import { QuoteField, useFieldTargets } from "./quote-field";

export type ComponentDialogMode =
	| { kind: "newMaterial" }
	| { kind: "newService" }
	| { component: QuoteComponentView; kind: "edit" };

type ComponentField = "cost" | "count" | "quantity";

const fieldOrder: readonly ComponentField[] = ["quantity", "count", "cost"];

function titleOf(draft: ComponentDraft): string {
	return draft.kind === "material"
		? `${draft.material.materialName} · ${draft.material.variantName}`
		: draft.service.name;
}

function serviceSummary(draft: ServiceComponentDraft): string {
	return `custo ${moneyLabel(draft.service.unitCostCents)} por vez${draft.service.outsourced ? " · terceirizado" : ""}`;
}

function ComponentForm({
	close,
	mode,
	onSave,
}: {
	close: () => void;
	mode: ComponentDialogMode;
	onSave: (component: QuoteComponentView) => void;
}) {
	const [componentId] = useState(() =>
		mode.kind === "edit" ? mode.component.id : crypto.randomUUID()
	);
	const [draft, setDraft] = useState<ComponentDraft | null>(() =>
		mode.kind === "edit" ? componentDraftOf(mode.component) : null
	);
	const [errors, setErrors] = useState<Partial<Record<ComponentField, string>>>(
		{}
	);
	const { fieldRef, focusFirst } = useFieldTargets<ComponentField>();
	const heading =
		mode.kind === "edit" ? "Editar componente" : "Acrescentar componente";

	if (!draft) {
		const material = mode.kind === "newMaterial";
		return (
			<div className="flex flex-col gap-4">
				<DialogTitle>{heading}</DialogTitle>
				<DialogDescription>
					{material
						? "Escolha a variante do material. A unidade e o custo de referência vêm dela."
						: "Escolha o serviço. O custo dele entra no custo da peça."}
				</DialogDescription>
				{material ? (
					<VariantPicker
						emptyHint="Nenhuma variante encontrada. Cadastre o material em Catálogo."
						onPick={(option) => setDraft(materialComponentDraft(option))}
					/>
				) : (
					<ServicePicker
						onPick={(service) =>
							setDraft(serviceComponentDraft(serviceCopyOf(service)))
						}
					/>
				)}
				<DialogActions>
					<Button onClick={close} type="button" variant="outline">
						Cancelar
					</Button>
				</DialogActions>
			</div>
		);
	}

	const submit = () => {
		const found = componentErrors(draft);
		setErrors(found);
		if (focusFirst(fieldOrder, found)) {
			return;
		}
		onSave(componentOf(draft, componentId));
		close();
	};

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>{heading}</DialogTitle>
			<div className="flex flex-col gap-0.5">
				<Text weight="semibold">{titleOf(draft)}</Text>
				{draft.kind === "service" ? (
					<Text size="xs" tone="subtle">
						{serviceSummary(draft)}
					</Text>
				) : null}
			</div>
			{draft.kind === "material" ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<QuoteField
						error={errors.quantity}
						hint="Quanto uma peça usa."
						label="Quantidade por peça"
						name="quantity"
						requirement="required"
					>
						<NumberField
							aria-invalid={errors.quantity ? true : undefined}
							maxLength={20}
							onChange={(event) =>
								setDraft({ ...draft, quantity: event.target.value })
							}
							ref={fieldRef("quantity")}
							suffix={unitAbbreviation(draft.material.baseUnit)}
							value={draft.quantity}
						/>
					</QuoteField>
					<QuoteField
						error={errors.cost}
						hint="Vazio deixa o custo da peça incompleto."
						label={`Custo por ${unitAbbreviation(draft.material.baseUnit)}`}
						name="cost"
						requirement="optional"
					>
						<NumberField
							aria-invalid={errors.cost ? true : undefined}
							maxLength={20}
							onChange={(event) =>
								setDraft({ ...draft, cost: event.target.value })
							}
							ref={fieldRef("cost")}
							suffix="R$"
							value={draft.cost}
						/>
					</QuoteField>
				</div>
			) : (
				<QuoteField
					error={errors.count}
					hint="Cada vez soma o custo do serviço uma vez."
					label="Quantidade por peça"
					name="count"
					requirement="required"
				>
					<NumberField
						aria-invalid={errors.count ? true : undefined}
						inputMode="numeric"
						maxLength={2}
						onChange={(event) =>
							setDraft({ ...draft, count: event.target.value })
						}
						ref={fieldRef("count")}
						suffix="vezes"
						value={draft.count}
					/>
				</QuoteField>
			)}
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button type="submit">Salvar componente</Button>
			</DialogActions>
		</form>
	);
}

export function ComponentDialog({
	mode,
	onOpenChange,
	onSave,
}: {
	mode: ComponentDialogMode | null;
	onOpenChange: (open: boolean) => void;
	onSave: (component: QuoteComponentView) => void;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={mode !== null}>
			<DialogContent>
				{mode ? (
					<ComponentForm
						close={() => onOpenChange(false)}
						key={mode.kind === "edit" ? mode.component.id : mode.kind}
						mode={mode}
						onSave={onSave}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
