import { canonicalJson } from "@costura-pro/domain/canonical-json";
import { Button } from "@costura-pro/ui/components/button";
import { Text } from "@costura-pro/ui/components/typography";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { useDrafts } from "@/lib/drafts";
import { emissionFields, refusalFields } from "@/lib/quote-drafts";
import {
	emissionWarnings,
	nextRevisionNumber,
	type QuoteDetailView,
	type QuoteSummary,
} from "@/lib/quotes";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import { EmitDialog } from "./emit-dialog";
import { failedQuoteCommand, refreshQuotes } from "./quote-queries";
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

export function QuoteActions({
	detail,
	onFailure,
	summary,
	targetKnown,
}: {
	detail: QuoteDetailView;
	onFailure: (failure: ClientCommandFailure | null) => void;
	summary: QuoteSummary;
	targetKnown: boolean;
}) {
	const { quote, revisions } = detail;
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const { draftFor, forget } = useDrafts();
	const [emitting, setEmitting] = useState(false);
	const [refusing, setRefusing] = useState(false);
	const [busy, setBusy] = useState(false);
	const number = nextRevisionNumber(revisions);
	const refused = quote.refusedOn !== null;
	const archived = quote.archivedAt !== null;
	const blocker = emitBlocker(quote.lines.length, targetKnown);

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
			if (failed.kind !== "exists") {
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

	return (
		<div className="flex flex-col gap-2 md:items-end">
			<div className="flex flex-wrap gap-2 md:justify-end">
				<Button
					className="max-md:w-full"
					disabled={busy || blocker !== null}
					onClick={() => setEmitting(true)}
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
				<Button
					disabled={busy}
					onClick={() => toggle(archived ? "unarchive" : "archive")}
					variant="outline"
				>
					{archived ? "Desarquivar" : "Arquivar"}
				</Button>
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
			<RefuseDialog
				onOpenChange={setRefusing}
				onRefuse={refuse}
				open={refusing}
			/>
		</div>
	);
}
