import { canonicalJson } from "@costura-pro/domain/canonical-json";
import { defaultTargetMarginBasisPoints } from "@costura-pro/domain/pricing";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	type ConditionsDraft,
	contentWithConditions,
	contentWithLines,
	documentDiscountFits,
	withItem,
	withoutItem,
} from "@/lib/quote-drafts";
import {
	latestRevisionOf,
	type QuoteApprovalView,
	type QuoteContentView,
	type QuoteDetailView,
	type QuoteLineView,
	quoteSummary,
	revisionContent,
} from "@/lib/quotes";
import { useOpId } from "@/lib/use-op-id";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { ApprovedQuote } from "./approved-quote";
import { ConditionsDialog } from "./conditions-dialog";
import { FreeLineDialog } from "./free-line-dialog";
import { MaterialLineDialog } from "./material-line-dialog";
import { PlannedMaterialsPanel } from "./planned-materials-panel";
import { ApprovedQuoteActions, QuoteActions } from "./quote-actions";
import { QuoteHeader } from "./quote-header";
import { QuoteInternalPanel } from "./quote-internal-panel";
import { type NewLineKind, QuoteLinesPanel } from "./quote-lines-panel";
import { failedQuoteCommand, quoteQuery, refreshQuotes } from "./quote-queries";
import { QuoteTotalsPanel } from "./quote-totals-panel";
import { RevisionsPanel } from "./revisions-panel";
import { ServiceLineDialog } from "./service-line-dialog";
import { usePeople } from "./use-people";

type DialogState =
	| { kind: "conditions" }
	| { kind: NewLineKind; lineId: string | null };

const discountTooLarge =
	"O desconto do orçamento passa do subtotal. Ajuste o desconto antes de tirar este item.";

const lineDiscountTooLarge =
	"Com este valor o desconto do orçamento passa do subtotal. Ajuste o desconto do orçamento antes.";

function isKind<Kind extends NewLineKind>(
	line: QuoteLineView,
	kind: Kind
): line is Extract<QuoteLineView, { kind: Kind }> {
	return line.kind === kind;
}

function lineOf<Kind extends NewLineKind>(
	lines: readonly QuoteLineView[],
	dialog: DialogState | null,
	kind: Kind
): Extract<QuoteLineView, { kind: Kind }> | null {
	if (
		dialog === null ||
		dialog.kind === "conditions" ||
		dialog.kind !== kind ||
		dialog.lineId === null
	) {
		return null;
	}
	const line = lines.find((item) => item.id === dialog.lineId);
	return line && isKind(line, kind) ? line : null;
}

function QuoteWorkspace({
	detail,
	onReload,
}: {
	detail: QuoteDetailView;
	onReload: () => Promise<unknown>;
}) {
	const { client, quote } = detail;
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const settings = useQuery(pricingSettingsQuery());
	const { choices, people } = usePeople(client.id);
	const [dialog, setDialog] = useState<DialogState | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [saving, setSaving] = useState(false);
	const failureRef = useRef<HTMLDivElement>(null);
	const editable = !client.anonymized;
	const target = settings.data?.targetMarginBasisPoints ?? null;
	const summary = quoteSummary(quote, target ?? defaultTargetMarginBasisPoints);

	useEffect(() => {
		if (failure) {
			failureRef.current?.focus();
		}
	}, [failure]);

	const save = async (
		content: QuoteContentView
	): Promise<ClientCommandFailure | null> => {
		setSaving(true);
		try {
			await api.quotes.update({
				baseVersion: quote.version,
				content,
				opId: opIdFor(`${quote.id}:${quote.version}:${canonicalJson(content)}`),
				quoteId: quote.id,
			});
		} catch (error) {
			return failedQuoteCommand(queryClient, error);
		} finally {
			setSaving(false);
		}
		reset();
		await refreshQuotes(queryClient);
		return null;
	};

	const runOnPage = async (content: QuoteContentView, done: string) => {
		setFailure(null);
		const failed = await save(content);
		if (failed) {
			setFailure(failed);
			return;
		}
		toast.success(done);
	};

	const saveLine = async (
		line: QuoteLineView
	): Promise<ClientCommandFailure | null> => {
		const known = quote.lines.some((item) => item.id === line.id);
		const content = contentWithLines(quote, withItem(quote.lines, line));
		if (!documentDiscountFits(content)) {
			return { kind: "other", message: lineDiscountTooLarge };
		}
		const failed = await save(content);
		if (!failed) {
			toast.success(known ? "Item salvo" : "Item acrescentado");
		}
		return failed;
	};

	const saveConditions = async (draft: ConditionsDraft) => {
		const failed = await save(contentWithConditions(quote, draft));
		if (!failed) {
			toast.success("Condições salvas");
		}
		return failed;
	};

	const remove = (line: QuoteLineView) => {
		const content = contentWithLines(quote, withoutItem(quote.lines, line.id));
		if (!documentDiscountFits(content)) {
			setFailure({ kind: "other", message: discountTooLarge });
			return;
		}
		runOnPage(content, "Item tirado");
	};

	const edit = (line: QuoteLineView) => {
		if (line.kind === "custom") {
			navigate({
				params: { linhaId: line.id, orcamentoId: quote.id },
				to: "/orcamentos/$orcamentoId/pecas/$linhaId",
			});
			return;
		}
		setDialog({ kind: line.kind, lineId: line.id });
	};

	const discard = () => {
		const latest = latestRevisionOf(detail.revisions);
		if (latest) {
			runOnPage(revisionContent(latest), "Alterações descartadas");
		}
	};

	const closeDialog = (open: boolean) => {
		if (!open) {
			setDialog(null);
		}
	};

	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="flex min-w-0 flex-col gap-4">
				<QuoteHeader
					actions={
						editable ? (
							<QuoteActions
								detail={detail}
								onFailure={setFailure}
								people={people}
								summary={summary}
								targetKnown={target !== null}
							/>
						) : undefined
					}
					busy={saving}
					detail={detail}
					editable={editable}
					onDiscard={discard}
				/>
				{failure ? (
					<Alert
						ref={failureRef}
						role="alert"
						tabIndex={-1}
						tone={failure.kind === "other" ? "danger" : "warning"}
					>
						<AlertTitle>Não foi possível mudar o orçamento</AlertTitle>
						<AlertDescription>{failure.message}</AlertDescription>
						{failure.kind === "stale" ? (
							<AlertActions>
								<Button
									onClick={async () => {
										await onReload();
										setFailure(null);
									}}
									variant="outline"
								>
									Carregar versão atual
								</Button>
							</AlertActions>
						) : null}
					</Alert>
				) : null}
				<QuoteLinesPanel
					busy={saving}
					editable={editable}
					lines={quote.lines}
					onAdd={(kind) => {
						setFailure(null);
						setDialog({ kind, lineId: null });
					}}
					onEdit={edit}
					onRemove={remove}
					people={people}
					quoteId={quote.id}
					totals={summary.totals}
				/>
				<PlannedMaterialsPanel lines={quote.lines} stock={detail.stock} />
				<RevisionsPanel quoteId={quote.id} revisions={detail.revisions} />
			</div>
			<div className="flex min-w-0 flex-col gap-4">
				<QuoteTotalsPanel
					content={quote}
					editable={editable}
					onEditConditions={() => setDialog({ kind: "conditions" })}
					totals={summary.totals}
				/>
				<QuoteInternalPanel
					summary={summary}
					target={target}
					targetFailed={settings.isError}
				/>
			</div>
			<ServiceLineDialog
				atelierTarget={target}
				choices={choices}
				line={lineOf(quote.lines, dialog, "service")}
				onOpenChange={closeDialog}
				onSave={saveLine}
				open={dialog?.kind === "service"}
			/>
			<MaterialLineDialog
				atelierTarget={target}
				line={lineOf(quote.lines, dialog, "material")}
				onOpenChange={closeDialog}
				onSave={saveLine}
				open={dialog?.kind === "material"}
			/>
			<FreeLineDialog
				line={lineOf(quote.lines, dialog, "free")}
				onOpenChange={closeDialog}
				onSave={saveLine}
				open={dialog?.kind === "free"}
			/>
			<ConditionsDialog
				content={quote}
				onOpenChange={closeDialog}
				onSave={saveConditions}
				open={dialog?.kind === "conditions"}
				subtotalCents={summary.totals.subtotalCents}
			/>
		</div>
	);
}

function ApprovedWorkspace({
	approval,
	detail,
}: {
	approval: QuoteApprovalView;
	detail: QuoteDetailView;
}) {
	const { people } = usePeople(detail.client.id);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	return (
		<div className="flex flex-col gap-4">
			{failure ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível mudar o orçamento</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
				</Alert>
			) : null}
			<ApprovedQuote
				actions={
					<ApprovedQuoteActions onFailure={setFailure} quote={detail.quote} />
				}
				approval={approval}
				detail={detail}
				people={people}
			/>
		</div>
	);
}

export function QuotePage({ quoteId }: { quoteId: string }) {
	const detail = useQuery(quoteQuery(quoteId));
	usePageHeader({
		backHref: "/orcamentos/rascunhos",
		eyebrow: "Orçamento",
		heading: detail.data?.quote.code ?? "Orçamento",
	});

	if (detail.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!detail.data) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir este orçamento</AlertTitle>
				<AlertDescription>
					{clientCommandFailure(detail.error, "orçamento").message}
				</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/orcamentos/rascunhos" />}
						variant="outline"
					>
						Voltar para orçamentos
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}
	if (detail.data.approval) {
		return (
			<ApprovedWorkspace approval={detail.data.approval} detail={detail.data} />
		);
	}
	return <QuoteWorkspace detail={detail.data} onReload={detail.refetch} />;
}
