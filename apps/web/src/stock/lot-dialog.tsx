import { stockLimits } from "@costura-pro/domain/stock";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import {
	DataList,
	DataListCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
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
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
	type LotFormValues,
	lotFormErrors,
	type StockLotView,
} from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import {
	failedStockCommand,
	refreshStock,
	stockLotsQuery,
} from "./stock-queries";

export function LotDialog({
	onOpenChange,
	open,
	variantId,
	variantName,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	variantId: string;
	variantName: string;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<LotPanel
					close={() => onOpenChange(false)}
					key={variantId}
					variantId={variantId}
					variantName={variantName}
				/>
			</DialogContent>
		</Dialog>
	);
}

function LotPanel({
	close,
	variantId,
	variantName,
}: {
	close: () => void;
	variantId: string;
	variantName: string;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const lots = useQuery(stockLotsQuery(variantId));
	const [values, setValues] = useState<LotFormValues>({ label: "", notes: "" });
	const [lotId, setLotId] = useState(() => crypto.randomUUID());
	const [errors, setErrors] = useState<
		Partial<Record<"label" | "notes", string>>
	>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);

	const items = lots.data?.items ?? [];

	const create = async () => {
		const found = lotFormErrors(values);
		setErrors(found);
		if (Object.keys(found).length > 0) {
			return;
		}
		const label = values.label.trim();
		const notes = values.notes.trim() === "" ? null : values.notes.trim();
		setFailure(null);
		setSubmitting(true);
		try {
			await api.stockLots.create({
				label,
				lotId,
				notes,
				opId: opIdFor(`${lotId}:${JSON.stringify({ label, notes })}`),
				variantId,
			});
		} catch (error) {
			const failed = await failedStockCommand(queryClient, error, "lote");
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		await refreshStock(queryClient);
		setValues({ label: "", notes: "" });
		setLotId(crypto.randomUUID());
		toast.success("Lote criado.");
	};

	const archive = async (lot: StockLotView) => {
		setBusy(lot.id);
		try {
			await api.stockLots.archive({
				baseVersion: lot.version,
				lotId: lot.id,
				opId: opIdFor(`arquivar:${lot.id}:${lot.version}`),
			});
			await refreshStock(queryClient);
		} catch (error) {
			const failed = await failedStockCommand(queryClient, error, "lote");
			toast.error(failed.message);
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<DialogTitle>Lotes de {variantName}</DialogTitle>
			<DialogDescription>
				Rolo ou aquisição identificável. Esta variante controla saldo por lote,
				então todo movimento precisa de um.
			</DialogDescription>
			{lots.isPending ? <Skeleton className="h-10" /> : null}
			{items.length === 0 && lots.isSuccess ? (
				<Text tone="subtle">Nenhum lote ainda.</Text>
			) : null}
			{items.length > 0 ? (
				<DataList aria-label="Lotes" columns="minmax(0,1fr) 7rem">
					{items.map((lot) => (
						<DataListRow key={lot.id}>
							<DataListCell label="Lote">
								<div className="flex min-w-0 flex-col gap-1">
									<div className="flex flex-wrap items-center gap-2">
										<Text weight="semibold">{lot.label}</Text>
										{lot.archivedAt ? (
											<Badge tone="warning">arquivado</Badge>
										) : null}
									</div>
									{lot.notes ? (
										<Text size="sm" tone="subtle">
											{lot.notes}
										</Text>
									) : null}
								</div>
							</DataListCell>
							<DataListCell align="end" label="Ações">
								{lot.archivedAt ? null : (
									<Button
										disabled={busy === lot.id}
										onClick={() => archive(lot)}
										size="sm"
										variant="ghost"
									>
										Arquivar
									</Button>
								)}
							</DataListCell>
						</DataListRow>
					))}
				</DataList>
			) : null}
			<Field invalid={Boolean(errors.label)} name="label">
				<FieldLabel requirement="required">Nome do lote</FieldLabel>
				<Input
					aria-invalid={Boolean(errors.label) || undefined}
					maxLength={stockLimits.lotLabel.max}
					onChange={(event) =>
						setValues((current) => ({ ...current, label: event.target.value }))
					}
					placeholder="Rolo 7"
					value={values.label}
				/>
				{errors.label ? <FieldError match>{errors.label}</FieldError> : null}
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
					<AlertTitle>Não foi possível criar o lote</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<DialogActions>
				<DialogClose onClick={close} render={<Button variant="outline" />}>
					Fechar
				</DialogClose>
				<Button disabled={submitting} onClick={create} type="button">
					{submitting ? "Criando..." : "Criar lote"}
				</Button>
			</DialogActions>
		</div>
	);
}
