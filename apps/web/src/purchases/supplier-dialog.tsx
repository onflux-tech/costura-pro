import { supplierLimits } from "@costura-pro/domain/supplier";
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
	type SupplierField,
	type SupplierFormValues,
	type SupplierView,
	supplierFields,
	supplierFormErrors,
	supplierFormValues,
	supplierPatch,
} from "@/lib/purchases";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import { failedPurchaseCommand, refreshPurchases } from "./purchase-queries";

export function SupplierDialog({
	onCreated,
	onOpenChange,
	open,
	supplier,
}: {
	onCreated?: (supplierId: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	supplier: SupplierView | null;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<SupplierForm
					close={() => onOpenChange(false)}
					key={supplier?.id ?? "novo"}
					onCreated={onCreated}
					supplier={supplier}
				/>
			</DialogContent>
		</Dialog>
	);
}

function TextField({
	error,
	label,
	maxLength,
	onChange,
	requirement,
	type,
	value,
}: {
	error: string | undefined;
	label: string;
	maxLength: number;
	onChange: (next: string) => void;
	requirement: "optional" | "required";
	type?: "email" | "tel";
	value: string;
}) {
	return (
		<Field invalid={Boolean(error)} name={label}>
			<FieldLabel requirement={requirement}>{label}</FieldLabel>
			<Input
				aria-invalid={Boolean(error) || undefined}
				maxLength={maxLength}
				onChange={(event) => onChange(event.target.value)}
				type={type}
				value={value}
			/>
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

function SupplierForm({
	close,
	onCreated,
	supplier,
}: {
	close: () => void;
	onCreated?: (supplierId: string) => void;
	supplier: SupplierView | null;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [supplierId] = useState(() => supplier?.id ?? crypto.randomUUID());
	const [values, setValues] = useState<SupplierFormValues>(() =>
		supplierFormValues(supplier)
	);
	const [errors, setErrors] = useState<Partial<Record<SupplierField, string>>>(
		{}
	);
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const change = (field: SupplierField) => (next: string) =>
		setValues((current) => ({ ...current, [field]: next }));

	const save = async () => {
		if (!supplier) {
			const fields = supplierFields(values);
			await api.suppliers.create({
				...fields,
				opId: opIdFor(JSON.stringify(fields)),
				supplierId,
			});
			return;
		}
		const patch = supplierPatch(supplier, values);
		if (Object.keys(patch).length === 0) {
			return;
		}
		await api.suppliers.update({
			baseVersion: supplier.version,
			opId: opIdFor(`${supplier.version}:${JSON.stringify(patch)}`),
			patch,
			supplierId,
		});
	};

	const finish = async () => {
		await refreshPurchases(queryClient);
		if (!supplier) {
			onCreated?.(supplierId);
		}
		close();
	};

	const submit = async () => {
		const found = supplierFormErrors(values);
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			await save();
		} catch (error) {
			const failed = await failedPurchaseCommand(
				queryClient,
				error,
				"fornecedor"
			);
			if (failed.kind === "stale") {
				toast.error(`${failed.message} Confira e edite de novo.`);
				close();
				return;
			}
			if (failed.kind === "exists") {
				await finish();
				return;
			}
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		await finish();
	};

	const label = submitting ? "Salvando..." : "Salvar fornecedor";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>
				{supplier ? "Editar fornecedor" : "Novo fornecedor"}
			</DialogTitle>
			<DialogDescription>
				Quem vende tecido, aviamento e insumo para o ateliê.
			</DialogDescription>
			<TextField
				error={errors.name}
				label="Nome"
				maxLength={supplierLimits.name.max}
				onChange={change("name")}
				requirement="required"
				value={values.name}
			/>
			<TextField
				error={errors.phone}
				label="Telefone"
				maxLength={20}
				onChange={change("phone")}
				requirement="optional"
				type="tel"
				value={values.phone}
			/>
			<TextField
				error={errors.email}
				label="E-mail"
				maxLength={supplierLimits.email}
				onChange={change("email")}
				requirement="optional"
				type="email"
				value={values.email}
			/>
			<Field invalid={Boolean(errors.notes)} name="notes">
				<FieldLabel requirement="optional">Notas</FieldLabel>
				<Textarea
					aria-invalid={Boolean(errors.notes) || undefined}
					maxLength={supplierLimits.notes}
					onChange={(event) => change("notes")(event.target.value)}
					value={values.notes}
				/>
				{errors.notes ? <FieldError match>{errors.notes}</FieldError> : null}
			</Field>
			{failure ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível salvar o fornecedor</AlertTitle>
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
