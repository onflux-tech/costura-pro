import { parseQuantity } from "@costura-pro/domain/quantity";
import { reconciliationLimits } from "@costura-pro/domain/reconciliation";
import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Select } from "@costura-pro/ui/components/select";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Text } from "@costura-pro/ui/components/typography";
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { type ComponentProps, useEffect, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { unitAbbreviation } from "@/lib/materials";
import { localDay } from "@/lib/measurements";
import type { VariantOptionView } from "@/lib/purchases";
import {
	hasReconciliationErrors,
	type LineDraft,
	lineOutcomeText,
	linePreview,
	negativeText,
	type PartDraft,
	type ReconciliationDraft,
	type ReconciliationErrors,
	reconciliationDraftOf,
	reconciliationErrors,
	removePart,
	splitPart,
	swapUnitHint,
	type VariantPointsView,
	withPart,
	withQuantities,
	withSwap,
	withSwapReason,
} from "@/lib/reconciliation";
import { itemMaterials, type MaterialRowView } from "@/lib/service-orders";
import { pointQuantity } from "@/lib/stock";
import { VariantPicker } from "@/materials/variant-picker";
import {
	FailureAlert,
	type FieldRef,
	QuoteField,
	useFieldTargets,
} from "@/quotes/quote-field";
import { stockLocationsQuery, stockLotsQuery } from "@/stock/stock-queries";

import { variantPointsQuery } from "./service-order-queries";
import type {
	ReconcileTarget,
	ReconciliationActions,
} from "./use-reconciliation-actions";

type DialogContentProps = ComponentProps<typeof DialogContent>;

type SelectItem = { label: string; value: string };

const newId = () => crypto.randomUUID();

const noPoints: VariantPointsView[] = [];

function pointsOf(
	points: readonly VariantPointsView[],
	variantId: string
): VariantPointsView | undefined {
	return points.find((entry) => entry.variantId === variantId);
}

function plannedVariant(
	row: MaterialRowView,
	points: readonly VariantPointsView[]
): LineDraft["variant"] {
	return {
		baseUnit: row.baseUnit,
		displayPrecision: row.displayPrecision,
		id: row.variantId,
		label: row.label,
		tracksLots: pointsOf(points, row.variantId)?.tracksLots ?? false,
	};
}

function flatErrors(errors: ReconciliationErrors): Record<string, string> {
	const entries: [string, string | null][] = [
		["date", errors.date],
		...errors.lines.flatMap((line, index): [string, string | null][] => [
			[`swap-${index}`, line.swap],
			[`quantities-${index}`, line.quantities],
			[`parts-${index}`, line.parts],
		]),
		["note", errors.note],
	];
	return Object.fromEntries(
		entries.filter((entry): entry is [string, string] => entry[1] !== null)
	);
}

function withExtra(
	items: Map<string, string>,
	extra: readonly { label: string | null; value: string | null }[]
): SelectItem[] {
	for (const entry of extra) {
		if (entry.value !== null && !items.has(entry.value)) {
			items.set(entry.value, entry.label ?? entry.value);
		}
	}
	return [...items].map(([value, label]) => ({ label, value }));
}

function Heading({
	itemTitle,
	orderCode,
}: {
	itemTitle: string;
	orderCode: string;
}) {
	return (
		<>
			<DialogTitle>Reconciliação de materiais</DialogTitle>
			<DialogDescription>{`${itemTitle} · ${orderCode}`}</DialogDescription>
		</>
	);
}

function PartRow({
	count,
	index,
	line,
	locations,
	lots,
	onChange,
	onRemove,
	part,
	points,
}: {
	count: number;
	index: number;
	line: LineDraft;
	locations: SelectItem[];
	lots: SelectItem[];
	onChange: (change: Partial<PartDraft>) => void;
	onRemove: () => void;
	part: PartDraft;
	points: VariantPointsView | undefined;
}) {
	const { baseUnit, displayPrecision, tracksLots } = line.variant;
	const point = points?.points.find(
		(entry) =>
			entry.locationId === part.locationId && entry.lotId === part.lotId
	);
	const balance =
		part.locationId === ""
			? undefined
			: `saldo ${pointQuantity(point?.quantityMicros ?? "0", baseUnit, displayPrecision)}`;
	const columns = tracksLots
		? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]"
		: "md:grid-cols-[minmax(0,1fr)_10rem]";
	const fields = (
		<div
			className={`grid grid-cols-[minmax(0,1fr)] gap-2 md:items-start ${columns}`}
		>
			<QuoteField
				error={undefined}
				label="Local"
				name={`location-${part.movementId}`}
				requirement="required"
			>
				<Select
					items={locations}
					onValueChange={(locationId) => onChange({ locationId })}
					value={part.locationId}
				/>
			</QuoteField>
			{tracksLots ? (
				<QuoteField
					error={undefined}
					label="Lote"
					name={`lot-${part.movementId}`}
					requirement="required"
				>
					<Select
						items={lots}
						onValueChange={(lotId) => onChange({ lotId: lotId || null })}
						value={part.lotId ?? ""}
					/>
				</QuoteField>
			) : null}
			<QuoteField
				error={undefined}
				hint={balance}
				label="Quantidade"
				name={`quantity-${part.movementId}`}
				requirement="required"
			>
				<NumberField
					onChange={(event) => onChange({ quantity: event.target.value })}
					suffix={unitAbbreviation(baseUnit)}
					value={part.quantity}
				/>
			</QuoteField>
		</div>
	);
	if (count === 1) {
		return fields;
	}
	return (
		<Fieldset className="gap-1 border-divider border-t pt-2">
			<div className="flex items-center justify-between gap-2">
				<FieldsetLegend>{`Saída ${index + 1}`}</FieldsetLegend>
				<Button
					aria-label={`Remover saída ${index + 1} de ${line.label}`}
					onClick={onRemove}
					size="sm"
					type="button"
					variant="ghost"
				>
					Remover
				</Button>
			</div>
			{fields}
		</Fieldset>
	);
}

function OutParts({
	change,
	draft,
	error,
	fieldRef,
	index,
	line,
	locations,
	points,
}: {
	change: (next: ReconciliationDraft) => void;
	draft: ReconciliationDraft;
	error: string | null;
	fieldRef: FieldRef<string>;
	index: number;
	line: LineDraft;
	locations: SelectItem[];
	points: VariantPointsView | undefined;
}) {
	const lots = useQuery({
		...stockLotsQuery(line.variant.id),
		enabled: line.variant.tracksLots,
	});
	const variantPoints = points?.points ?? [];
	const locationItems = withExtra(
		new Map(locations.map((item) => [item.value, item.label])),
		variantPoints.map((point) => ({
			label: point.locationName,
			value: point.locationId,
		}))
	);
	const lotItems = withExtra(
		new Map((lots.data?.items ?? []).map((lot) => [lot.id, lot.label])),
		variantPoints.map((point) => ({
			label: point.lotLabel,
			value: point.lotId,
		}))
	);
	const full = line.parts.length >= reconciliationLimits.parts.max;
	return (
		<Fieldset
			aria-invalid={error ? true : undefined}
			ref={fieldRef(`parts-${index}`)}
			tabIndex={-1}
		>
			<FieldsetLegend>Saída</FieldsetLegend>
			{line.parts.length === 0 ? (
				<Text size="xs" tone="subtle">
					Nada sai do estoque.
				</Text>
			) : null}
			{line.parts.map((part, position) => (
				<PartRow
					count={line.parts.length}
					index={position}
					key={part.movementId}
					line={line}
					locations={locationItems}
					lots={lotItems}
					onChange={(patch) => change(withPart(draft, index, position, patch))}
					onRemove={() => change(removePart(draft, index, position))}
					part={part}
					points={points}
				/>
			))}
			<Button
				aria-label={`Dividir a saída de ${line.label}`}
				className="self-start"
				disabled={full}
				onClick={() => change(splitPart(draft, index, newId))}
				size="sm"
				type="button"
				variant="outline"
			>
				Dividir
			</Button>
			{error ? (
				<Text size="xs" tone="danger">
					{error}
				</Text>
			) : null}
		</Fieldset>
	);
}

function SwapControls({
	change,
	draft,
	error,
	fieldRef,
	index,
	line,
	onSwap,
	onUndo,
}: {
	change: (next: ReconciliationDraft) => void;
	draft: ReconciliationDraft;
	error: string | null;
	fieldRef: FieldRef<string>;
	index: number;
	line: LineDraft;
	onSwap: () => void;
	onUndo: () => void;
}) {
	const swapped = line.variant.id !== line.plannedVariantId;
	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				{swapped ? (
					<Text inline size="sm" weight="medium">
						{`Trocado por ${line.variant.label}`}
					</Text>
				) : null}
				<Button
					aria-label={`Trocar material ${line.label}`}
					onClick={onSwap}
					size="sm"
					type="button"
					variant="outline"
				>
					Trocar material
				</Button>
				{swapped ? (
					<Button onClick={onUndo} size="sm" type="button" variant="ghost">
						Desfazer troca
					</Button>
				) : null}
			</div>
			{swapped ? (
				<QuoteField
					error={error ?? undefined}
					label="Motivo da troca"
					name={`swap-${index}`}
					requirement="required"
				>
					<Input
						aria-invalid={error ? true : undefined}
						maxLength={reconciliationLimits.reason.max}
						onChange={(event) =>
							change(withSwapReason(draft, index, event.target.value))
						}
						ref={fieldRef(`swap-${index}`)}
						value={line.swapReason}
					/>
				</QuoteField>
			) : null}
		</>
	);
}

function LineFieldset({
	change,
	draft,
	errors,
	fieldRef,
	index,
	line,
	locations,
	onSwap,
	onUndo,
	points,
	row,
}: {
	change: (next: ReconciliationDraft) => void;
	draft: ReconciliationDraft;
	errors: ReconciliationErrors["lines"][number] | undefined;
	fieldRef: FieldRef<string>;
	index: number;
	line: LineDraft;
	locations: SelectItem[];
	onSwap: () => void;
	onUndo: () => void;
	points: readonly VariantPointsView[];
	row: MaterialRowView | undefined;
}) {
	const { baseUnit, displayPrecision } = line.variant;
	const unit = unitAbbreviation(baseUnit);
	const variantPoints = pointsOf(points, line.variant.id);
	const preview = linePreview(line, variantPoints);
	const negative = negativeText(line, preview);
	const quantitiesError = errors?.quantities ?? null;
	const invalid = (value: string) =>
		quantitiesError !== null && parseQuantity(value, displayPrecision) === null
			? true
			: undefined;
	let outcomeTone: "muted" | "subtle" | "warning" = "subtle";
	if (preview.extraMicros > 0n) {
		outcomeTone = "warning";
	} else if (preview.leftoverMicros === 0n) {
		outcomeTone = "muted";
	}
	const setQuantities = (consumed: string, lost: string) =>
		change(withQuantities(draft, index, consumed, lost, points, newId));
	return (
		<Fieldset className="gap-3 rounded-md border border-border p-3">
			<FieldsetLegend className="px-1 font-semibold text-foreground">
				{line.label}
			</FieldsetLegend>
			<Text size="xs" tone="subtle">
				{`Previsto ${pointQuantity(line.plannedMicros, baseUnit, row?.displayPrecision ?? displayPrecision)}`}
			</Text>
			<SwapControls
				change={change}
				draft={draft}
				error={errors?.swap ?? null}
				fieldRef={fieldRef}
				index={index}
				line={line}
				onSwap={onSwap}
				onUndo={onUndo}
			/>
			<div className="grid grid-cols-2 gap-2">
				<QuoteField
					error={undefined}
					label="Consumido"
					name={`consumed-${index}`}
					requirement="required"
				>
					<NumberField
						aria-invalid={invalid(line.consumed)}
						onChange={(event) => setQuantities(event.target.value, line.lost)}
						ref={fieldRef(`quantities-${index}`)}
						suffix={unit}
						value={line.consumed}
					/>
				</QuoteField>
				<QuoteField
					error={undefined}
					label="Perdido"
					name={`lost-${index}`}
					requirement="required"
				>
					<NumberField
						aria-invalid={invalid(line.lost)}
						onChange={(event) =>
							setQuantities(line.consumed, event.target.value)
						}
						suffix={unit}
						value={line.lost}
					/>
				</QuoteField>
			</div>
			{quantitiesError ? (
				<Text size="xs" tone="danger">
					{quantitiesError}
				</Text>
			) : (
				<Text size="sm" tone={outcomeTone}>
					{lineOutcomeText(line, preview)}
				</Text>
			)}
			<OutParts
				change={change}
				draft={draft}
				error={errors?.parts ?? null}
				fieldRef={fieldRef}
				index={index}
				line={line}
				locations={locations}
				points={variantPoints}
			/>
			{negative ? (
				<Text size="xs" tone="warning">
					{negative}
				</Text>
			) : null}
		</Fieldset>
	);
}

function ReconcileForm({
	change,
	close,
	draft,
	fresh,
	item,
	itemTitle,
	onSwap,
	onUndo,
	openedOn,
	orderCode,
	points,
	reconcile,
	rows,
	today,
}: {
	change: (next: ReconciliationDraft) => void;
	close: () => void;
	draft: ReconciliationDraft;
	fresh: boolean;
	item: ReconcileTarget;
	itemTitle: string;
	onSwap: (index: number) => void;
	onUndo: (index: number) => void;
	openedOn: string;
	orderCode: string;
	points: readonly VariantPointsView[];
	reconcile: ReconciliationActions["reconcile"];
	rows: MaterialRowView[];
	today: string;
}) {
	const locations = useQuery(stockLocationsQuery());
	const [checked, setChecked] = useState(false);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [sending, setSending] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<string>();
	const bounds = { openedOn, today };
	const errors = checked ? reconciliationErrors(draft, bounds) : null;
	const locationItems = (locations.data?.items ?? []).map((location) => ({
		label: location.name,
		value: location.id,
	}));

	const submit = async () => {
		const found = reconciliationErrors(draft, bounds);
		setChecked(true);
		if (hasReconciliationErrors(found)) {
			const flat = flatErrors(found);
			focusFirst(Object.keys(flat), flat);
			return;
		}
		if (!fresh || item.reconciled) {
			return;
		}
		setFailure(null);
		setSending(true);
		const failed = await reconcile(item, draft);
		setSending(false);
		if (failed) {
			setFailure(failed);
			return;
		}
		close();
	};

	const sendLabel = sending
		? "Reconciliando..."
		: "Reconciliar e marcar pronto";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<Heading itemTitle={itemTitle} orderCode={orderCode} />
			<QuoteField
				error={errors?.date ?? undefined}
				label="Data"
				name="occurredOn"
				requirement="required"
			>
				<Input
					aria-invalid={errors?.date ? true : undefined}
					max={today}
					min={openedOn}
					onChange={(event) =>
						change({ ...draft, occurredOn: event.target.value })
					}
					ref={fieldRef("date")}
					type="date"
					value={draft.occurredOn}
				/>
			</QuoteField>
			{draft.lines.map((line, index) => (
				<LineFieldset
					change={change}
					draft={draft}
					errors={errors?.lines[index]}
					fieldRef={fieldRef}
					index={index}
					key={line.plannedVariantId}
					line={line}
					locations={locationItems}
					onSwap={() => onSwap(index)}
					onUndo={() => onUndo(index)}
					points={points}
					row={rows.find((row) => row.variantId === line.plannedVariantId)}
				/>
			))}
			<QuoteField
				error={errors?.note ?? undefined}
				label="Nota"
				name="note"
				requirement="optional"
			>
				<Textarea
					aria-invalid={errors?.note ? true : undefined}
					maxLength={reconciliationLimits.note}
					onChange={(event) => change({ ...draft, note: event.target.value })}
					ref={fieldRef("note")}
					value={draft.note}
				/>
			</QuoteField>
			<FailureAlert failure={failure} heading="Não foi possível reconciliar" />
			<DialogActions className="md:items-center">
				{fresh ? null : (
					<Text role="status" size="xs" tone="muted">
						Carregando saldos...
					</Text>
				)}
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={!fresh || sending || item.reconciled} type="submit">
					{sendLabel}
				</Button>
			</DialogActions>
		</form>
	);
}

function SwapStep({
	itemTitle,
	line,
	onCancel,
	onPick,
	orderCode,
}: {
	itemTitle: string;
	line: LineDraft;
	onCancel: () => void;
	onPick: (option: VariantOptionView) => Promise<boolean>;
	orderCode: string;
}) {
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);
	return (
		<div className="flex flex-col gap-4">
			<Heading itemTitle={itemTitle} orderCode={orderCode} />
			<Text weight="semibold">{`Trocar ${line.label}`}</Text>
			{loading ? (
				<Text role="status" size="xs" tone="muted">
					Carregando saldos...
				</Text>
			) : (
				<VariantPicker
					emptyHint="Nenhuma variante encontrada."
					onPick={async (option) => {
						setLoading(true);
						setFailed(false);
						const picked = await onPick(option);
						setLoading(false);
						setFailed(!picked);
					}}
					unavailable={(option) => swapUnitHint(option, line)}
				/>
			)}
			{failed ? (
				<Text role="alert" size="xs" tone="danger">
					Não foi possível ler os saldos. Tente de novo.
				</Text>
			) : null}
			<DialogActions>
				<Button onClick={onCancel} type="button" variant="outline">
					Voltar
				</Button>
			</DialogActions>
		</div>
	);
}

function ReconcileContent({
	actions,
	close,
	item,
	itemTitle,
	openedOn,
	orderCode,
}: {
	actions: ReconciliationActions;
	close: () => void;
	item: ReconcileTarget;
	itemTitle: string;
	openedOn: string;
	orderCode: string;
}) {
	const queryClient = useQueryClient();
	const { keepDraft } = actions;
	const [today] = useState(() => localDay(new Date()));
	const [draft, setDraft] = useState(() => actions.draftOf(item));
	const [picking, setPicking] = useState<number | null>(null);
	const rows = itemMaterials(item);
	const variantIds = [
		...new Set([
			...rows.map((row) => row.variantId),
			...(draft?.lines ?? []).map((line) => line.variant.id),
		]),
	].sort();
	const read = useQuery({
		...variantPointsQuery(variantIds),
		placeholderData: keepPreviousData,
	});
	const fresh =
		read.isSuccess && read.isFetchedAfterMount && !read.isPlaceholderData;
	const points = read.data?.variants ?? noPoints;

	useEffect(() => {
		if (draft !== null || !fresh) {
			return;
		}
		const built = reconciliationDraftOf(
			itemMaterials(item),
			points,
			today,
			newId
		);
		keepDraft(item, built);
		setDraft(built);
	}, [draft, fresh, item, keepDraft, points, today]);

	const change = (next: ReconciliationDraft) => {
		keepDraft(item, next);
		setDraft(next);
	};

	if (draft === null) {
		return (
			<div className="flex flex-col gap-4">
				<Heading itemTitle={itemTitle} orderCode={orderCode} />
				{read.isError ? (
					<div className="flex flex-wrap items-center gap-2">
						<Text role="alert" size="xs" tone="danger">
							Não foi possível ler os saldos. Tente de novo.
						</Text>
						<Button
							onClick={() => read.refetch()}
							size="sm"
							type="button"
							variant="outline"
						>
							Tentar de novo
						</Button>
					</div>
				) : (
					<>
						<Text role="status" size="xs" tone="muted">
							Carregando saldos...
						</Text>
						<Skeleton className="h-40" />
					</>
				)}
				<DialogActions>
					<DialogClose render={<Button type="button" variant="outline" />}>
						Cancelar
					</DialogClose>
				</DialogActions>
			</div>
		);
	}

	const pickingLine = picking === null ? undefined : draft.lines[picking];
	if (picking !== null && pickingLine) {
		return (
			<SwapStep
				itemTitle={itemTitle}
				line={pickingLine}
				onCancel={() => setPicking(null)}
				onPick={async (option) => {
					let fetched: VariantPointsView[];
					try {
						fetched = (
							await queryClient.query({
								...variantPointsQuery([option.id]),
								staleTime: 0,
							})
						).variants;
					} catch {
						return false;
					}
					change(
						withSwap(
							draft,
							picking,
							{
								baseUnit: option.baseUnit,
								displayPrecision: option.displayPrecision,
								id: option.id,
								label: `${option.materialName} · ${option.name}`,
								tracksLots: option.tracksLots,
							},
							[...points, ...fetched],
							newId
						)
					);
					setPicking(null);
					return true;
				}}
				orderCode={orderCode}
			/>
		);
	}

	return (
		<ReconcileForm
			change={change}
			close={close}
			draft={draft}
			fresh={fresh}
			item={item}
			itemTitle={itemTitle}
			onSwap={setPicking}
			onUndo={(index) => {
				const row = rows.find(
					(entry) => entry.variantId === draft.lines[index]?.plannedVariantId
				);
				if (row) {
					change(
						withSwap(draft, index, plannedVariant(row, points), points, newId)
					);
				}
			}}
			openedOn={openedOn}
			orderCode={orderCode}
			points={points}
			reconcile={actions.reconcile}
			rows={rows}
			today={today}
		/>
	);
}

export function ReconcileDialog({
	actions,
	finalFocus,
	item,
	itemTitle,
	onOpenChange,
	open,
	openedOn,
	orderCode,
}: {
	actions: ReconciliationActions;
	finalFocus?: DialogContentProps["finalFocus"];
	item: ReconcileTarget;
	itemTitle: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	openedOn: string;
	orderCode: string;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="md:max-w-2xl" finalFocus={finalFocus}>
				{open ? (
					<ReconcileContent
						actions={actions}
						close={() => onOpenChange(false)}
						item={item}
						itemTitle={itemTitle}
						openedOn={openedOn}
						orderCode={orderCode}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
