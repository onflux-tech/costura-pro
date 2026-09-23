import { formatMarginInput } from "@costura-pro/domain/pricing";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { targetMarginError } from "@/lib/pricing";
import { targetMarginFields } from "@/lib/services";
import { client as api } from "@/utils/orpc";

import { failedServiceCommand, refreshServices } from "./service-queries";

export type PricingSettings = {
	targetMarginBasisPoints: number;
	version: number;
};

type OpIdFor = (key: string) => string;

export function TargetMarginDialog({
	onOpenChange,
	onSaved,
	opIdFor,
	open,
	settings,
}: {
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
	opIdFor: OpIdFor;
	open: boolean;
	settings: PricingSettings;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<TargetMarginForm
					close={() => onOpenChange(false)}
					key={settings.version}
					onSaved={onSaved}
					opIdFor={opIdFor}
					settings={settings}
				/>
			</DialogContent>
		</Dialog>
	);
}

function TargetMarginForm({
	close,
	onSaved,
	opIdFor,
	settings,
}: {
	close: () => void;
	onSaved: () => void;
	opIdFor: OpIdFor;
	settings: PricingSettings;
}) {
	const queryClient = useQueryClient();
	const [value, setValue] = useState(
		formatMarginInput(settings.targetMarginBasisPoints)
	);
	const [error, setError] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const submit = async () => {
		const problem =
			value.trim() === "" ? "Informe a meta" : targetMarginError(value);
		const fields = targetMarginFields(value);
		setError(problem);
		if (problem || fields === null) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			await api.pricing.setTargetMargin({
				...fields,
				baseVersion: settings.version,
				opId: opIdFor(`${settings.version}:${fields.targetMarginBasisPoints}`),
			});
		} catch (caught) {
			const failed = await failedServiceCommand(queryClient, caught, "meta");
			if (failed.kind === "stale") {
				toast.error(`${failed.message} Confira e altere de novo.`);
				close();
				return;
			}
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		onSaved();
		await refreshServices(queryClient);
		close();
	};

	const label = submitting ? "Salvando..." : "Salvar meta";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>Meta de margem do ateliê</DialogTitle>
			<DialogDescription>
				Margem sobre o preço de venda usada para sugerir o preço de todo serviço
				sem meta própria.
			</DialogDescription>
			<Field invalid={Boolean(error)} name="targetMargin">
				<FieldLabel requirement="required">Meta</FieldLabel>
				<NumberField
					aria-invalid={error ? true : undefined}
					maxLength={6}
					onChange={(event) => setValue(event.target.value)}
					suffix="%"
					value={value}
				/>
				<FieldHint>
					O preço praticado dos serviços não muda; só a sugestão.
				</FieldHint>
				{error ? <FieldError match>{error}</FieldError> : null}
			</Field>
			{failure ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível salvar a meta</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={submitting} type="submit">
					{label}
				</Button>
			</DialogActions>
		</form>
	);
}
