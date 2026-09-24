import { canonicalJson } from "@costura-pro/domain/canonical-json";
import { Button } from "@costura-pro/ui/components/button";
import { Text } from "@costura-pro/ui/components/typography";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	quoteAlreadyApproved,
} from "@/lib/client-command-error";
import { useDrafts } from "@/lib/drafts";
import { clientMeasurementsQuery } from "@/lib/measurement-queries";
import { emissionFields, refusalFields } from "@/lib/quote-drafts";
import {
	emissionWarnings,
	latestRevisionOf,
	nextRevisionNumber,
	type PeopleNames,
	type QuoteDetailView,
	type QuoteSummary,
	sameContent,
} from "@/lib/quotes";
import {
	type ApprovalIds,
	approvalFields,
	approvalIds,
} from "@/lib/service-orders";
import { useOpId } from "@/lib/use-op-id";
import { refreshServiceOrders } from "@/service-orders/service-order-queries";
import { client as api } from "@/utils/orpc";

import { type ApprovalSubmit, ApproveDialog } from "./approve-dialog";
import { EmitDialog } from "./emit-dialog";
import { failedQuoteCommand, quoteQuery, refreshQuotes } from "./quote-queries";
import { RefuseDialog } from "./refuse-dialog";

const emitDraftKey = "emitir";

type Toggle = "archive" | "unarchive" | "unrefuse";

const toggleDone: Record<Toggle, string> = {
	archive: "Orçamento arquivado",
	unarchive: "Orçamento desarquivado",
	unrefuse: "Recusa desfeita",
};

function emitBlocker(lineCount: number, targetKnown: boolean): string | null {
	if (lineCount === 0) {
		return "Acrescente pelo menos um item para emitir.";
	}
	return targetKnown
		? null
		: "A emissão espera a meta de margem do ateliê, que ainda não carregou.";
}

function ArchiveToggle({
	archived,
	busy,
	onToggle,
}: {
	archived: boolean;
	busy: boolean;
	onToggle: (command: Toggle) => void;
}) {
	return (
		<Button
			disabled={busy}
			onClick={() => onToggle(archived ? "unarchive" : "archive")}
			variant="outline"
		>
			{archived ? "Desarquivar" : "Arquivar"}
		</Button>
	);
}

function useQuoteToggle(
	quote: QuoteDetailView["quote"],
	onFailure: (failure: ClientCommandFailure | null) => void
) {
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [busy, setBusy] = useState(false);
	const toggle = async (command: Toggle) => {
		onFailure(null);
		setBusy(true);
		try {
			await api.quotes[command]({
				baseVersion: quote.version,
				opId: opIdFor(`${quote.id}:${quote.version}:${command}`),
				quoteId: quote.id,
			});
		} catch (error) {
			onFailure(await failedQuoteCommand(queryClient, error));
			return;
		} finally {
			setBusy(false);
		}
		reset();
		await refreshQuotes(queryClient);
		toast.success(toggleDone[command]);
	};
	return { busy, toggle };
}

export function ApprovedQuoteActions({
	onFailure,
	quote,
}: {
	onFailure: (failure: ClientCommandFailure | null) => void;
	quote: QuoteDetailView["quote"];
}) {
	const { busy, toggle } = useQuoteToggle(quote, onFailure);
	return (
		<ArchiveToggle
			archived={quote.archivedAt !== null}
			busy={busy}
			onToggle={toggle}
		/>
	);
}

export function QuoteActions({
	detail,
	onFailure,
	people,
	summary,
	targetKnown,
}: {
	detail: QuoteDetailView;
	onFailure: (failure: ClientCommandFailure | null) => void;
	people: PeopleNames;
	summary: QuoteSummary;
	targetKnown: boolean;
}) {
	const { quote, revisions } = detail;
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { opIdFor, reset } = useOpId();
	const { draftFor, forget } = useDrafts();
	const approvals = useRef(new Map<string, ApprovalIds>());
	const [emitting, setEmitting] = useState(false);
	const [approving, setApproving] = useState(false);
	const [refusing, setRefusing] = useState(false);
	const { busy, toggle } = useQuoteToggle(quote, onFailure);
	const number = nextRevisionNumber(revisions);
	const latest = latestRevisionOf(revisions);
	const refused = quote.refusedOn !== null;
	const archived = quote.archivedAt !== null;
	const blocker = emitBlocker(quote.lines.length, targetKnown);
	const approvalFirst = latest !== undefined && sameContent(quote, latest);

	const emit = async (
		emittedOn: string,
		reason: string
	): Promise<ClientCommandFailure | null> => {
		const previous = draftFor(emitDraftKey);
		if (revisions.some((revision) => revision.id === previous.movementId)) {
			forget(emitDraftKey);
		}
		const draft = draftFor(emitDraftKey);
		const fields = {
			...emissionFields(quote, emittedOn, reason),
			quoteId: quote.id,
		};
		let existed = false;
		try {
			await api.quotes.emit({
				...fields,
				opId: draft.opIdFor(`${draft.movementId}:${canonicalJson(fields)}`),
				revisionId: draft.movementId,
			});
		} catch (error) {
			const failed = await failedQuoteCommand(queryClient, error);
			if (failed.kind !== "exists" || quoteAlreadyApproved(error)) {
				return failed;
			}
			existed = true;
		}
		forget(emitDraftKey);
		await refreshQuotes(queryClient);
		if (existed) {
			toast.info(
				"Esta revisão já tinha sido emitida. Confira a data e o motivo na lista de revisões."
			);
		} else {
			toast.success(`Revisão ${number} emitida`);
		}
		return null;
	};

	const approve: ApprovalSubmit = async (draft, preview) => {
		if (!latest) {
			return null;
		}
		const ids =
			approvals.current.get(latest.id) ??
			approvalIds(latest, () => crypto.randomUUID());
		approvals.current.set(latest.id, ids);
		const fields = approvalFields({
			draft,
			ids,
			preview,
			quoteId: quote.id,
			revisionId: latest.id,
		});
		let existed = false;
		try {
			await api.quotes.approve({
				...fields,
				opId: opIdFor(`${fields.approvalId}:${canonicalJson(fields)}`),
			});
		} catch (error) {
			const failed = await failedQuoteCommand(queryClient, error);
			if (failed.kind === "other") {
				await Promise.all([
					refreshQuotes(queryClient),
					queryClient.invalidateQueries({
						queryKey: clientMeasurementsQuery(detail.client.id).queryKey,
					}),
				]);
			}
			if (failed.kind !== "exists") {
				return failed;
			}
			existed = true;
		}
		reset();
		approvals.current.delete(latest.id);
		await refreshServiceOrders(queryClient);
		const { approval } = await queryClient.query(quoteQuery(quote.id));
		if (!approval) {
			return {
				kind: "other",
				message: "A aprovação não apareceu no orçamento. Recarregue a tela.",
			};
		}
		if (existed) {
			toast.info(
				approval.id === fields.approvalId
					? "Esta aprovação já tinha sido registrada."
					: "Este orçamento já tinha sido aprovado em outra janela."
			);
		} else {
			toast.success(`${approval.serviceOrderCode} aberta`);
		}
		await navigate({
			params: { osId: approval.serviceOrderId },
			to: "/os/$osId",
		});
		return null;
	};

	const refuse = async (
		refusedOn: string,
		reason: string
	): Promise<ClientCommandFailure | null> => {
		const fields = refusalFields(refusedOn, reason);
		try {
			await api.quotes.refuse({
				...fields,
				baseVersion: quote.version,
				opId: opIdFor(
					`${quote.id}:${quote.version}:refuse:${canonicalJson(fields)}`
				),
				quoteId: quote.id,
			});
		} catch (error) {
			return failedQuoteCommand(queryClient, error);
		}
		reset();
		await refreshQuotes(queryClient);
		toast.success("Recusa registrada");
		return null;
	};

	return (
		<div className="flex flex-col gap-2 md:items-end">
			<div className="flex flex-wrap gap-2 md:justify-end">
				{latest ? (
					<Button
						className="max-md:w-full"
						disabled={busy}
						onClick={() => setApproving(true)}
						variant={approvalFirst ? "default" : "outline"}
					>
						Registrar aprovação
					</Button>
				) : null}
				<Button
					className="max-md:w-full"
					disabled={busy || blocker !== null}
					onClick={() => setEmitting(true)}
					variant={approvalFirst ? "outline" : "default"}
				>
					{`Emitir revisão ${number}`}
				</Button>
				{refused ? (
					<Button
						disabled={busy}
						onClick={() => toggle("unrefuse")}
						variant="outline"
					>
						Desfazer recusa
					</Button>
				) : (
					<Button
						disabled={busy}
						onClick={() => setRefusing(true)}
						variant="outline"
					>
						Registrar recusa
					</Button>
				)}
				<ArchiveToggle archived={archived} busy={busy} onToggle={toggle} />
			</div>
			{blocker ? (
				<Text size="xs" tone="muted">
					{blocker}
				</Text>
			) : null}
			<EmitDialog
				number={number}
				onEmit={emit}
				onOpenChange={setEmitting}
				open={emitting}
				refused={refused}
				totalCents={summary.totals.totalCents}
				validityDays={quote.validityDays}
				warnings={emissionWarnings(summary)}
			/>
			{latest ? (
				<ApproveDialog
					detail={detail}
					onApprove={approve}
					onOpenChange={setApproving}
					open={approving}
					people={people}
					revision={latest}
				/>
			) : null}
			<RefuseDialog
				onOpenChange={setRefusing}
				onRefuse={refuse}
				open={refusing}
			/>
		</div>
	);
}
