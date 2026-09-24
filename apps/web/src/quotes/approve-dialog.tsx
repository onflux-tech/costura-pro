import { formatQuantity } from "@costura-pro/domain/quantity";
import {
	type ApprovalChannel,
	approvalChannels,
	approvalLimits,
	suggestedDueOn,
} from "@costura-pro/domain/service-order";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
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
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { unitAbbreviation } from "@/lib/materials";
import { clientMeasurementsQuery } from "@/lib/measurement-queries";
import { formatDay, localDay } from "@/lib/measurements";
import {
	lineQuantityLabel,
	type PeopleNames,
	type QuoteDetailView,
	type QuoteRevisionView,
	sameContent,
} from "@/lib/quotes";
import {
	type ApprovalDraft,
	type ApprovalErrors,
	type ApprovalPreview,
	type ApprovalPreviewItem,
	acceptanceHint,
	approvalBlocker,
	approvalChannelLabels,
	approvalDraft,
	approvalErrors,
	approvalPreview,
	type MaterialRowView,
} from "@/lib/service-orders";

import { FailureAlert, QuoteField, useFieldTargets } from "./quote-field";

type ApproveField = "approvedOn" | "channel" | "note" | "dueOn";

const fieldOrder: readonly ApproveField[] = [
	"approvedOn",
	"channel",
	"note",
	"dueOn",
];

const kindLabels: Record<ApprovalPreviewItem["kind"], string> = {
	custom: "peça sob medida",
	material: "material, só entrega",
	service: "serviço",
};

export type ApprovalSubmit = (
	draft: ApprovalDraft & { channel: ApprovalChannel },
	preview: ApprovalPreview
) => Promise<ClientCommandFailure | null>;

function quantity(row: MaterialRowView, micros: bigint): string {
	return `${formatQuantity(micros, row.displayPrecision)} ${unitAbbreviation(row.baseUnit)}`;
}

function measurementText(item: ApprovalPreviewItem): string {
	return item.measurements
		.map(
			(snapshot) => `${snapshot.templateName} (${formatDay(snapshot.takenOn)})`
		)
		.join(", ");
}

function whoFor(item: ApprovalPreviewItem, people: PeopleNames): string[] {
	const { line } = item;
	const parts: string[] = [];
	if (line.kind !== "material" && line.profileId !== null) {
		parts.push(`para ${people.profiles.get(line.profileId) ?? "perfil"}`);
	}
	if (line.kind === "service" && line.receivedItemId !== null) {
		parts.push(
			`peça ${people.receivedItems.get(line.receivedItemId) ?? "recebida"}`
		);
	}
	return parts;
}

function PreviewItem({
	item,
	people,
	position,
}: {
	item: ApprovalPreviewItem;
	people: PeopleNames;
	position: number;
}) {
	const person =
		item.line.kind === "material" || item.line.profileId === null
			? null
			: (people.profiles.get(item.line.profileId) ?? "o perfil");
	return (
		<div className="flex flex-col gap-1 rounded-md border border-border p-3">
			<Text weight="semibold">{`Subitem ${position} · ${item.title}`}</Text>
			<Text size="xs" tone="subtle">
				{[
					kindLabels[item.kind],
					lineQuantityLabel(item.line),
					...whoFor(item, people),
				].join(" · ")}
			</Text>
			{item.measurements.length > 0 ? (
				<Text size="xs" tone="subtle">
					{`Medidas congeladas: ${measurementText(item)}`}
				</Text>
			) : null}
			{item.missingMeasurements ? (
				<Text size="xs" tone="warning">
					{`${person} ainda não tem medidas; o subitem nasce sem snapshot.`}
				</Text>
			) : null}
			{item.reservations.map((row) => (
				<div
					className="flex flex-wrap items-center gap-x-2 gap-y-1"
					key={row.variantId}
				>
					<Text inline size="xs">
						{`${row.label}: reserva ${quantity(row, row.reservedMicros)} de ${quantity(row, row.plannedMicros)}`}
					</Text>
					{row.shortageMicros > 0n ? (
						<Badge tone="warning">
							{`falta ${quantity(row, row.shortageMicros)}`}
						</Badge>
					) : null}
				</div>
			))}
		</div>
	);
}

function PreviewSection({
	people,
	preview,
}: {
	people: PeopleNames;
	preview: ApprovalPreview;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Text weight="semibold">O que a aprovação cria</Text>
			{preview.items.length === 0 ? (
				<Text size="xs" tone="subtle">
					Esta revisão não tem serviço, peça nem material: a OS nasce só com a
					cobrança.
				</Text>
			) : (
				preview.items.map((item, index) => (
					<PreviewItem
						item={item}
						key={item.line.id}
						people={people}
						position={index + 1}
					/>
				))
			)}
			{preview.freeLines.length > 0 ? (
				<Text size="xs" tone="subtle">
					{`Fica só no valor: ${preview.freeLines.join(", ")}.`}
				</Text>
			) : null}
			<Text weight="semibold">
				{preview.receivableCents > 0n
					? `A receber ${moneyLabel(preview.receivableCents)}`
					: "Sem cobrança"}
			</Text>
			{preview.shortage ? (
				<Text size="xs" tone="warning">
					O que falta vira pendência de abastecimento; a reserva não inventa
					saldo.
				</Text>
			) : null}
		</div>
	);
}

function ReadStatus({
	failed,
	message,
	onRetry,
}: {
	failed: boolean;
	message: string;
	onRetry: () => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Text role="status" size="xs" tone="muted">
				{message}
			</Text>
			{failed ? (
				<Button onClick={onRetry} size="sm" type="button" variant="outline">
					Tentar de novo
				</Button>
			) : null}
		</div>
	);
}

function ApproveForm({
	close,
	detail,
	onApprove,
	people,
	revision,
}: {
	close: () => void;
	detail: QuoteDetailView;
	onApprove: ApprovalSubmit;
	people: PeopleNames;
	revision: QuoteRevisionView;
}) {
	const measurements = useQuery({
		...clientMeasurementsQuery(detail.client.id),
		refetchInterval: 15_000,
		refetchOnMount: "always",
	});
	const blocker = approvalBlocker({
		failed: measurements.isError,
		fresh: measurements.isSuccess && measurements.isFetchedAfterMount,
	});
	const [today] = useState(() => localDay(new Date()));
	const [draft, setDraft] = useState(() => approvalDraft(revision, today));
	const [errors, setErrors] = useState<ApprovalErrors>({});
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [sending, setSending] = useState(false);
	const { fieldRef, focusFirst } = useFieldTargets<ApproveField>();
	const measured = measurements.data?.items ?? null;
	const preview = useMemo(
		() => approvalPreview(revision, measured, detail.stock),
		[detail.stock, measured, revision]
	);
	const suggestion =
		suggestedDueOn(draft.approvedOn, revision.content.leadTimeDays) ?? "";
	const unemitted = !sameContent(detail.quote, revision);
	const lastDay = today < revision.validUntil ? today : revision.validUntil;

	const change = (patch: Partial<ApprovalDraft>) =>
		setDraft((current) => ({ ...current, ...patch }));

	const submit = async () => {
		const found = approvalErrors(draft, revision, today);
		setErrors(found);
		if (
			focusFirst(fieldOrder, found) ||
			draft.channel === null ||
			blocker !== null
		) {
			return;
		}
		setFailure(null);
		setSending(true);
		const failed = await onApprove(
			{ ...draft, channel: draft.channel },
			preview
		);
		setSending(false);
		if (failed) {
			setFailure(failed);
			return;
		}
		close();
	};

	const sendLabel = sending ? "Aprovando..." : "Aprovar e abrir OS";

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogTitle>{`Registrar aprovação da rev. ${revision.number}`}</DialogTitle>
			<DialogDescription>
				A aprovação abre a OS com os subitens, congela as medidas, reserva o
				material disponível e cria o valor a receber.
			</DialogDescription>
			{unemitted ? (
				<Alert tone="warning">
					<AlertTitle>Alterações não emitidas</AlertTitle>
					<AlertDescription>
						{`A aprovação vale para a revisão ${revision.number}; as alterações não emitidas ficam de fora.`}
					</AlertDescription>
				</Alert>
			) : null}
			<QuoteField
				error={errors.approvedOn}
				hint={acceptanceHint(revision, today)}
				label="Data do aceite"
				name="approvedOn"
				requirement="required"
			>
				<Input
					aria-invalid={errors.approvedOn ? true : undefined}
					max={lastDay}
					min={revision.emittedOn}
					onChange={(event) => {
						const approvedOn = event.target.value;
						change({
							approvedOn,
							dueOn:
								draft.dueOn === suggestion
									? (suggestedDueOn(
											approvedOn,
											revision.content.leadTimeDays
										) ?? "")
									: draft.dueOn,
						});
					}}
					ref={fieldRef("approvedOn")}
					type="date"
					value={draft.approvedOn}
				/>
			</QuoteField>
			<Fieldset>
				<FieldsetLegend>Canal</FieldsetLegend>
				<ChoiceChips
					onValueChange={(value) =>
						change({ channel: value as ApprovalChannel })
					}
					value={draft.channel}
				>
					{approvalChannels.map((channel, index) => (
						<ChoiceChip
							key={channel}
							ref={index === 0 ? fieldRef("channel") : undefined}
							value={channel}
						>
							{approvalChannelLabels[channel]}
						</ChoiceChip>
					))}
				</ChoiceChips>
				{errors.channel ? (
					<Text role="alert" size="xs" tone="danger">
						{errors.channel}
					</Text>
				) : null}
			</Fieldset>
			<QuoteField
				error={errors.note}
				hint="Como Aceitou por áudio ou Pediu para entregar antes do dia 10."
				label="Nota"
				name="note"
				requirement="optional"
			>
				<Textarea
					aria-invalid={errors.note ? true : undefined}
					maxLength={approvalLimits.note}
					onChange={(event) => change({ note: event.target.value })}
					ref={fieldRef("note")}
					value={draft.note}
				/>
			</QuoteField>
			<QuoteField
				error={errors.dueOn}
				hint={
					suggestion
						? `Sugerido pelo prazo proposto: ${formatDay(suggestion)}. Vazio fica a combinar.`
						: "Sem prazo proposto na revisão. Vazio fica a combinar."
				}
				label="Prazo combinado"
				name="dueOn"
				requirement="optional"
			>
				<Input
					aria-invalid={errors.dueOn ? true : undefined}
					min={draft.approvedOn}
					onChange={(event) => change({ dueOn: event.target.value })}
					ref={fieldRef("dueOn")}
					type="date"
					value={draft.dueOn}
				/>
			</QuoteField>
			{suggestion && draft.dueOn !== suggestion ? (
				<Button
					className="self-start"
					onClick={() => change({ dueOn: suggestion })}
					type="button"
					variant="outline"
				>
					Usar prazo sugerido
				</Button>
			) : null}
			<PreviewSection people={people} preview={preview} />
			<FailureAlert failure={failure} heading="Não foi possível aprovar" />
			{blocker ? (
				<ReadStatus
					failed={measurements.isError}
					message={blocker}
					onRetry={() => measurements.refetch()}
				/>
			) : null}
			<DialogActions>
				<DialogClose render={<Button type="button" variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button disabled={sending || blocker !== null} type="submit">
					{sendLabel}
				</Button>
			</DialogActions>
		</form>
	);
}

export function ApproveDialog({
	detail,
	onApprove,
	onOpenChange,
	open,
	people,
	revision,
}: {
	detail: QuoteDetailView;
	onApprove: ApprovalSubmit;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	people: PeopleNames;
	revision: QuoteRevisionView;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<ApproveForm
						close={() => onOpenChange(false)}
						detail={detail}
						onApprove={onApprove}
						people={people}
						revision={revision}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
