import { Button } from "@costura-pro/ui/components/button";
import {
	CheckboxChip,
	CheckboxChips,
} from "@costura-pro/ui/components/checkbox-chips";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Text } from "@costura-pro/ui/components/typography";
import { type ComponentProps, useState } from "react";

import {
	type FlowStageView,
	type ProductionTarget,
	startStageIds,
} from "@/lib/production";

import type { useProductionActions } from "./use-production-actions";

type DialogContentProps = ComponentProps<typeof DialogContent>;

export type StartItem = ProductionTarget & { suggestedStageIds: string[] };

export function StartProductionDialog({
	finalFocus,
	flowStages,
	item,
	itemTitle,
	onOpenChange,
	open,
	pendingId,
	start,
}: {
	finalFocus?: DialogContentProps["finalFocus"];
	flowStages: readonly FlowStageView[];
	item: StartItem;
	itemTitle: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
} & Pick<ReturnType<typeof useProductionActions>, "pendingId" | "start">) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent finalFocus={finalFocus}>
				<StartForm
					flowStages={flowStages}
					item={item}
					itemTitle={itemTitle}
					onStart={async (stageIds) => {
						if (await start(item, stageIds)) {
							onOpenChange(false);
						}
					}}
					pending={pendingId === item.id}
				/>
			</DialogContent>
		</Dialog>
	);
}

function StartForm({
	flowStages,
	item,
	itemTitle,
	onStart,
	pending,
}: {
	flowStages: readonly FlowStageView[];
	item: StartItem;
	itemTitle: string;
	onStart: (stageIds: string[]) => Promise<void>;
	pending: boolean;
}) {
	const [chosen, setChosen] = useState(() =>
		startStageIds(flowStages, item.suggestedStageIds)
	);
	const [empty, setEmpty] = useState(false);
	const stages = flowStages.filter((stage) => stage.active);
	const label = pending ? "Iniciando..." : "Iniciar produção";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				const stageIds = startStageIds(flowStages, chosen);
				setEmpty(stageIds.length === 0);
				if (stageIds.length > 0) {
					onStart(stageIds);
				}
			}}
		>
			<DialogTitle>Iniciar produção</DialogTitle>
			<DialogDescription>
				{`${itemTitle} · escolha as etapas que se aplicam`}
			</DialogDescription>
			<Fieldset>
				<FieldsetLegend>Etapas</FieldsetLegend>
				<CheckboxChips
					onValueChange={(value) => {
						setChosen(value);
						setEmpty(false);
					}}
					value={chosen}
				>
					{stages.map((stage) => (
						<CheckboxChip key={stage.id} value={stage.id}>
							{stage.name}
						</CheckboxChip>
					))}
				</CheckboxChips>
			</Fieldset>
			{empty ? (
				<Text role="alert" tone="danger">
					Escolha ao menos uma etapa.
				</Text>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={pending} type="submit">
					{label}
				</Button>
			</DialogActions>
		</form>
	);
}
