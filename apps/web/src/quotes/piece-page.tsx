import { canonicalJson } from "@costura-pro/domain/canonical-json";
import { formatMoneyInput, parseMoney } from "@costura-pro/domain/money";
import { quoteLimits } from "@costura-pro/domain/quote";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import {
	AlertDialog,
	AlertDialogActions,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "@costura-pro/ui/components/alert-dialog";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Select } from "@costura-pro/ui/components/select";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { pricingPreview } from "@/lib/pricing";
import {
	contentWithLines,
	documentDiscountFits,
	emptyPiece,
	type LineErrors,
	type LineField,
	type PieceDraft,
	pieceCostOf,
	pieceDraftOf,
	pieceErrors,
	pieceLineOf,
	type SheetCopy,
	withItem,
	withoutItem,
} from "@/lib/quote-drafts";
import type { CustomLineView, QuoteDetailView } from "@/lib/quotes";
import { useOpId } from "@/lib/use-op-id";
import { PricingPanel } from "@/pricing/pricing-panel";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { productQuery } from "@/products/product-queries";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { ComponentDialog, type ComponentDialogMode } from "./component-dialog";
import { DiscountFields } from "./discount-fields";
import { PieceComponents } from "./piece-components";
import { ProductSourceDialog } from "./product-source-dialog";
import { QuoteField, useFieldTargets } from "./quote-field";
import { failedQuoteCommand, quoteQuery, refreshQuotes } from "./quote-queries";
import { type PersonChoice, usePeople } from "./use-people";

const fieldOrder: readonly LineField[] = [
	"description",
	"quantity",
	"price",
	"discount",
	"reason",
	"note",
];

const noProfile = "-";

const discountTooLarge: ClientCommandFailure = {
	kind: "other",
	message:
		"Com este preço o desconto do orçamento passa do subtotal. Ajuste o desconto do orçamento antes.",
};

function sourceText(draft: PieceDraft): string | null {
	if (draft.source === null) {
		return null;
	}
	const { productName, productVersion, variantName } = draft.source;
	const sheet = `Copiada da ficha ${productName} v${productVersion}`;
	return variantName ? `${sheet} · variante ${variantName}` : sheet;
}

function profileOptions(
	profiles: readonly PersonChoice[],
	selected: string | null
) {
	return [
		{ label: "Ninguém em especial", value: noProfile },
		...profiles
			.filter((profile) => profile.active || profile.id === selected)
			.map((profile) => ({ label: profile.label, value: profile.id })),
	];
}

function piecePreview(
	draft: PieceDraft,
	price: bigint | null,
	atelierTarget: number | null,
	ownTarget: number | null
) {
	const pieceCost = pieceCostOf(draft.components);
	if (atelierTarget === null || pieceCost === null) {
		return null;
	}
	return pricingPreview(
		{
			costCents: String(pieceCost),
			priceCents: price === null ? null : String(price),
			targetMarginBasisPoints: ownTarget,
		},
		atelierTarget
	);
}

function SaveFailure({
	failure,
	onReload,
}: {
	failure: ClientCommandFailure | null;
	onReload: () => Promise<void>;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (failure) {
			ref.current?.focus();
		}
	}, [failure]);
	if (!failure) {
		return null;
	}
	return (
		<Alert
			ref={ref}
			role="alert"
			tabIndex={-1}
			tone={failure.kind === "other" ? "danger" : "warning"}
		>
			<AlertTitle>Não foi possível salvar a peça</AlertTitle>
			<AlertDescription>{failure.message}</AlertDescription>
			{failure.kind === "stale" ? (
				<AlertActions>
					<Button onClick={onReload} variant="outline">
						Carregar versão atual
					</Button>
				</AlertActions>
			) : null}
		</Alert>
	);
}

function ReplaceComponentsDialog({
	count,
	onConfirm,
	onOpenChange,
	open,
}: {
	count: number;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent>
				<AlertDialogTitle>
					Trocar os componentes pelos da ficha?
				</AlertDialogTitle>
				<AlertDialogDescription>
					{count === 1
						? "O componente atual sai e entram os da ficha."
						: `Os ${count} componentes atuais saem e entram os da ficha.`}
				</AlertDialogDescription>
				<AlertDialogActions>
					<AlertDialogClose render={<Button variant="outline" />}>
						Cancelar
					</AlertDialogClose>
					<Button onClick={onConfirm}>Trocar componentes</Button>
				</AlertDialogActions>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function PieceEditor({
	detail,
	line,
	onReload,
}: {
	detail: QuoteDetailView;
	line: CustomLineView | null;
	onReload: () => Promise<void>;
}) {
	const { quote } = detail;
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const { choices } = usePeople(detail.client.id);
	const settings = useQuery(pricingSettingsQuery());
	const [lineId] = useState(() => line?.id ?? crypto.randomUUID());
	const [draft, setDraft] = useState<PieceDraft>(() =>
		line ? pieceDraftOf(line) : emptyPiece
	);
	const [errors, setErrors] = useState<LineErrors>({});
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [saving, setSaving] = useState(false);
	const [component, setComponent] = useState<ComponentDialogMode | null>(null);
	const [choosingSource, setChoosingSource] = useState(false);
	const [pendingCopy, setPendingCopy] = useState<SheetCopy | null>(null);
	const { fieldRef, focusFirst } = useFieldTargets<LineField>();
	const source = useQuery({
		...productQuery(draft.source?.productId ?? ""),
		enabled: draft.source !== null,
	});
	const price = parseMoney(draft.price);
	const preview = piecePreview(
		draft,
		price,
		settings.data?.targetMarginBasisPoints ?? null,
		source.data?.product.targetMarginBasisPoints ?? null
	);

	const applyCopy = (copy: SheetCopy) => {
		setDraft((current) => ({
			...current,
			components: copy.components,
			description:
				current.description.trim() === ""
					? copy.source.productName
					: current.description,
			price:
				current.price.trim() === "" && copy.priceCents !== null
					? formatMoneyInput(BigInt(copy.priceCents))
					: current.price,
			source: copy.source,
		}));
	};

	const save = async () => {
		const found = pieceErrors(draft);
		setErrors(found);
		if (focusFirst(fieldOrder, found) || found.components) {
			return;
		}
		const content = contentWithLines(
			quote,
			withItem(quote.lines, pieceLineOf(draft, lineId))
		);
		if (!documentDiscountFits(content)) {
			setFailure(discountTooLarge);
			return;
		}
		setFailure(null);
		setSaving(true);
		try {
			await api.quotes.update({
				baseVersion: quote.version,
				content,
				opId: opIdFor(`${quote.id}:${quote.version}:${canonicalJson(content)}`),
				quoteId: quote.id,
			});
		} catch (error) {
			setFailure(await failedQuoteCommand(queryClient, error));
			setSaving(false);
			return;
		}
		reset();
		await refreshQuotes(queryClient);
		toast.success("Peça salva");
		await navigate({
			params: { orcamentoId: quote.id },
			to: "/orcamentos/$orcamentoId",
		});
	};

	const provenance = sourceText(draft);
	const saveLabel = saving ? "Salvando..." : "Salvar peça";

	return (
		<div className="flex flex-col gap-4 md:max-w-3xl">
			<Heading className="max-md:sr-only">
				{line ? "Peça sob medida" : "Nova peça sob medida"}
			</Heading>
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					<QuoteField
						error={errors.description}
						hint="Sai no orçamento para o cliente."
						label="Descrição"
						name="description"
						requirement="required"
					>
						<Input
							aria-invalid={errors.description ? true : undefined}
							maxLength={quoteLimits.description.max}
							onChange={(event) =>
								setDraft({ ...draft, description: event.target.value })
							}
							ref={fieldRef("description")}
							value={draft.description}
						/>
					</QuoteField>
					<div className="grid gap-4 sm:grid-cols-2">
						<QuoteField
							error={undefined}
							label="Para quem"
							name="profileId"
							requirement="optional"
						>
							<Select
								items={profileOptions(choices.profiles, draft.profileId)}
								onValueChange={(value) =>
									setDraft({
										...draft,
										profileId: value === noProfile ? null : value,
									})
								}
								value={draft.profileId ?? noProfile}
							/>
						</QuoteField>
						<QuoteField
							error={errors.quantity}
							label="Quantidade de peças"
							name="quantity"
							requirement="required"
						>
							<NumberField
								aria-invalid={errors.quantity ? true : undefined}
								inputMode="numeric"
								maxLength={4}
								onChange={(event) =>
									setDraft({ ...draft, quantity: event.target.value })
								}
								ref={fieldRef("quantity")}
								suffix="un"
								value={draft.quantity}
							/>
						</QuoteField>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Button onClick={() => setChoosingSource(true)} variant="outline">
							Partir da ficha de um produto
						</Button>
						{provenance ? (
							<Text size="xs" tone="subtle">
								{provenance}
							</Text>
						) : null}
					</div>
				</PanelContent>
			</Panel>
			<PieceComponents
				components={draft.components}
				onAdd={(kind) => setComponent({ kind })}
				onEdit={(item) => setComponent({ component: item, kind: "edit" })}
				onRemove={(item) =>
					setDraft({
						...draft,
						components: withoutItem(draft.components, item.id),
					})
				}
			/>
			{errors.components ? (
				<Text tone="danger">{errors.components}</Text>
			) : null}
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					<QuoteField
						error={errors.price}
						hint="Preço de uma peça, antes do desconto."
						label="Preço por peça"
						name="price"
						requirement="required"
					>
						<NumberField
							aria-invalid={errors.price ? true : undefined}
							maxLength={20}
							onChange={(event) =>
								setDraft({ ...draft, price: event.target.value })
							}
							ref={fieldRef("price")}
							suffix="R$"
							value={draft.price}
						/>
					</QuoteField>
					<PricingPanel
						hint="Complete o custo dos componentes para ver o preço sugerido."
						onUseSuggestion={() => {
							if (preview) {
								setDraft({
									...draft,
									price: formatMoneyInput(preview.suggestedCents),
								});
							}
						}}
						preview={preview}
						suggestionApplied={
							preview !== null && price === preview.suggestedCents
						}
					/>
					<DiscountFields
						draft={draft.discount}
						errors={errors}
						fieldRef={fieldRef}
						onChange={(discount) => setDraft({ ...draft, discount })}
					/>
					<QuoteField
						error={errors.note}
						label="Observação"
						name="note"
						requirement="optional"
					>
						<Input
							aria-invalid={errors.note ? true : undefined}
							maxLength={quoteLimits.lineNote}
							onChange={(event) =>
								setDraft({ ...draft, note: event.target.value })
							}
							ref={fieldRef("note")}
							value={draft.note}
						/>
					</QuoteField>
				</PanelContent>
			</Panel>
			<SaveFailure
				failure={failure}
				onReload={async () => {
					await onReload();
					setFailure(null);
				}}
			/>
			<div className="flex flex-wrap gap-2">
				<Button disabled={saving} onClick={save} size="touch">
					{saveLabel}
				</Button>
				<ButtonLink
					render={
						<Link
							params={{ orcamentoId: quote.id }}
							to="/orcamentos/$orcamentoId"
						/>
					}
					size="touch"
					variant="outline"
				>
					Cancelar
				</ButtonLink>
			</div>
			<ComponentDialog
				mode={component}
				onOpenChange={(open) => {
					if (!open) {
						setComponent(null);
					}
				}}
				onSave={(item) =>
					setDraft((current) => ({
						...current,
						components: withItem(current.components, item),
					}))
				}
			/>
			<ProductSourceDialog
				onCopy={(copy) => {
					setChoosingSource(false);
					if (draft.components.length > 0) {
						setPendingCopy(copy);
						return;
					}
					applyCopy(copy);
				}}
				onOpenChange={setChoosingSource}
				open={choosingSource}
			/>
			<ReplaceComponentsDialog
				count={draft.components.length}
				onConfirm={() => {
					if (pendingCopy) {
						applyCopy(pendingCopy);
					}
					setPendingCopy(null);
				}}
				onOpenChange={(open) => {
					if (!open) {
						setPendingCopy(null);
					}
				}}
				open={pendingCopy !== null}
			/>
		</div>
	);
}

type Session = {
	detail: QuoteDetailView;
	line: CustomLineView | null;
	missing: boolean;
};

function sessionOf(detail: QuoteDetailView, lineId: string | null): Session {
	const found =
		lineId === null
			? undefined
			: detail.quote.lines.find((item) => item.id === lineId);
	return {
		detail,
		line: found?.kind === "custom" ? found : null,
		missing: lineId !== null && found?.kind !== "custom",
	};
}

export function PiecePage({
	lineId,
	quoteId,
}: {
	lineId: string | null;
	quoteId: string;
}) {
	const detail = useQuery(quoteQuery(quoteId));
	const [session, setSession] = useState<Session | null>(null);
	useEffect(() => {
		if (!session && detail.data) {
			setSession(sessionOf(detail.data, lineId));
		}
	}, [session, detail.data, lineId]);
	usePageHeader({
		backHref: `/orcamentos/${quoteId}`,
		eyebrow: session?.detail.quote.code ?? "Orçamento",
		heading: lineId ? "Peça sob medida" : "Nova peça sob medida",
	});

	if (!(session || detail.data)) {
		if (detail.isPending) {
			return <Skeleton className="h-96" />;
		}
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
	if (!session) {
		return <Skeleton className="h-96" />;
	}
	if (session.missing) {
		return (
			<Alert tone="warning">
				<AlertTitle>Este item não está mais no orçamento.</AlertTitle>
				<AlertDescription>
					Ele pode ter sido tirado em outra janela ou aparelho.
				</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={
							<Link
								params={{ orcamentoId: quoteId }}
								to="/orcamentos/$orcamentoId"
							/>
						}
						variant="outline"
					>
						Voltar para o orçamento
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	const { approval } = detail.data ?? session.detail;
	if (approval) {
		return (
			<Alert tone="warning">
				<AlertTitle>{`Este orçamento foi aprovado e abriu a ${approval.serviceOrderCode}.`}</AlertTitle>
				<AlertDescription>
					O orçamento aprovado fica só leitura. Mudança de preço, prazo ou
					material chega com a revisão comercial da OS.
				</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={
							<Link
								params={{ orcamentoId: quoteId }}
								to="/orcamentos/$orcamentoId"
							/>
						}
						variant="outline"
					>
						Voltar para o orçamento
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	const reload = async () => {
		const fresh = await detail.refetch();
		const { data } = fresh;
		if (data) {
			setSession((current) =>
				current ? { ...current, detail: data } : current
			);
		}
	};

	return (
		<PieceEditor
			detail={session.detail}
			line={session.line}
			onReload={reload}
		/>
	);
}
