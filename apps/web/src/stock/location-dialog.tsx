import { stockLimits } from "@costura-pro/domain/stock";
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
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
	locationFormErrors,
	type PlaceFormValues,
	type StockLocationView,
} from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import { failedStockCommand, refreshStock } from "./stock-queries";

export function LocationDialog({
	location,
	onOpenChange,
	open,
}: {
	location: StockLocationView | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<LocationForm
					close={() => onOpenChange(false)}
					key={location?.id ?? "novo"}
					location={location}
				/>
			</DialogContent>
		</Dialog>
	);
}

function LocationForm({
	close,
	location,
}: {
	close: () => void;
	location: StockLocationView | null;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [locationId] = useState(() => location?.id ?? crypto.randomUUID());
	const [values, setValues] = useState<PlaceFormValues>({
		name: location?.name ?? "",
		notes: location?.notes ?? "",
	});
	const [errors, setErrors] = useState<
		Partial<Record<"name" | "notes", string>>
	>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const save = async () => {
		const name = values.name.trim();
		const notes = values.notes.trim() === "" ? null : values.notes.trim();
		if (!location) {
			await api.stockLocations.create({
				locationId,
				name,
				notes,
				opId: opIdFor(JSON.stringify({ name, notes })),
			});
			return;
		}
		const patch = {
			...(name === location.name ? {} : { name }),
			...(notes === location.notes ? {} : { notes }),
		};
		if (Object.keys(patch).length === 0) {
			return;
		}
		await api.stockLocations.update({
			baseVersion: location.version,
			locationId,
			opId: opIdFor(`${location.version}:${JSON.stringify(patch)}`),
			patch,
		});
	};

	const submit = async () => {
		const found = locationFormErrors(values);
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			await save();
		} catch (error) {
			const failed = await failedStockCommand(queryClient, error, "local");
			if (failed.kind === "stale") {
				toast.error(`${failed.message} Confira e edite de novo.`);
				close();
				return;
			}
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		await refreshStock(queryClient);
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
			<DialogTitle>{location ? "Editar local" : "Novo local"}</DialogTitle>
			<DialogDescription>
				Armário, prateleira ou área com saldo próprio.
			</DialogDescription>
			<Field invalid={Boolean(errors.name)} name="name">
				<FieldLabel requirement="required">Nome</FieldLabel>
				<Input
					aria-invalid={Boolean(errors.name) || undefined}
					maxLength={stockLimits.locationName.max}
					onChange={(event) =>
						setValues((current) => ({ ...current, name: event.target.value }))
					}
					value={values.name}
				/>
				{errors.name ? <FieldError match>{errors.name}</FieldError> : null}
			</Field>
			<Field invalid={Boolean(errors.notes)} name="notes">
				<FieldLabel requirement="optional">Notas</FieldLabel>
				<Textarea
					aria-invalid={Boolean(errors.notes) || undefined}
					maxLength={stockLimits.notes}
					onChange={(event) =>
						setValues((current) => ({ ...current, notes: event.target.value }))
					}
					value={values.notes}
				/>
				{errors.notes ? <FieldError match>{errors.notes}</FieldError> : null}
			</Field>
			{failure ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível salvar o local</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={submitting} type="submit">
					{submitting ? "Salvando..." : "Salvar local"}
				</Button>
			</DialogActions>
		</form>
	);
}
