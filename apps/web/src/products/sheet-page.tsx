import { commandMessages } from "@costura-pro/api/command-messages";
import { productLimits } from "@costura-pro/domain/product";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
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
import { moneyLabel } from "@/lib/finance";
import {
	baseEstimate,
	draftOf,
	type ProductDetailView,
	type ProductReferences,
	type SheetItemDraft,
	type SheetItemView,
	upsertItem,
	withMaterial,
	withoutItem,
	withService,
} from "@/lib/products";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { MissingCosts } from "./missing-costs";
import {
	failedProductCommand,
	productQuery,
	refreshProducts,
} from "./product-queries";
import { SheetItemDialog, type SheetItemDialogMode } from "./sheet-item-dialog";
import { SheetLines } from "./sheet-lines";

const pendingMeta = { empty: "vazia", incomplete: "Custo incompleto" } as const;

function withReference(
	references: ProductReferences,
	draft: SheetItemDraft
): ProductReferences {
	return draft.kind === "material"
		? withMaterial(references, draft.variant)
		: withService(references, draft.service);
}

function SheetEditor({
	detail,
	onReloadCurrent,
}: {
	detail: ProductDetailView;
	onReloadCurrent: () => Promise<void>;
}) {
	const { product } = detail;
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [sheet, setSheet] = useState<SheetItemView[]>(() => [...product.sheet]);
	const [references, setReferences] = useState(detail.references);
	const [dialog, setDialog] = useState<SheetItemDialogMode | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [saving, setSaving] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const estimate = baseEstimate(sheet, references);
	const full = sheet.length >= productLimits.sheetItems;

	useEffect(() => {
		if (failure) {
			alertRef.current?.focus();
		}
	}, [failure]);

	const openProduct = () =>
		navigate({
			params: { produtoId: product.id },
			to: "/catalogo-produtos/produtos/$produtoId",
		});

	const saveItem = (item: SheetItemView, draft: SheetItemDraft) => {
		setReferences((current) => withReference(current, draft));
		setSheet((current) => upsertItem(current, item));
	};

	const save = async () => {
		setFailure(null);
		if (JSON.stringify(sheet) === JSON.stringify(product.sheet)) {
			await openProduct();
			return;
		}
		setSaving(true);
		try {
			await api.products.update({
				baseVersion: product.version,
				opId: opIdFor(
					`${product.id}:${product.version}:${JSON.stringify(sheet)}`
				),
				patch: { sheet },
				productId: product.id,
			});
		} catch (error) {
			setFailure(await failedProductCommand(queryClient, error));
			return;
		} finally {
			setSaving(false);
		}
		reset();
		await refreshProducts(queryClient);
		toast.success("Ficha salva");
		await openProduct();
	};

	const rows = estimate.lines.map((line) => {
		const draft = draftOf(line.item, references);
		return {
			actions: (
				<>
					<Button
						disabled={draft === null}
						onClick={() => {
							if (draft) {
								setDialog({
									draft,
									heading: "Editar item",
									itemId: line.item.id,
									kind: "edit",
								});
							}
						}}
						size="sm"
						variant="outline"
					>
						Editar
					</Button>
					<Button
						onClick={() =>
							setSheet((current) => withoutItem(current, line.item.id))
						}
						size="sm"
						variant="outline"
					>
						Tirar
					</Button>
				</>
			),
			cost: line.cost,
			item: line.item,
		};
	});

	const saveLabel = saving ? "Salvando..." : "Salvar ficha";
	const metaText =
		estimate.status === "complete"
			? `Custo da base ${moneyLabel(estimate.totalCents)}`
			: pendingMeta[estimate.status];

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">{`Ficha técnica de ${product.name}`}</Heading>
			<Panel>
				<PanelHeader>
					<PanelTitle>Itens da ficha</PanelTitle>
					<PanelMeta>{metaText}</PanelMeta>
				</PanelHeader>
				{sheet.length === 0 ? (
					<PanelContent>
						<Text tone="subtle">
							Nenhum item ainda. Acrescente os materiais, com a quantidade de
							uma peça e a perda normal, e os serviços.
						</Text>
					</PanelContent>
				) : (
					<SheetLines
						label="Itens da ficha"
						references={references}
						rows={rows}
					/>
				)}
				<PanelContent className="flex flex-col gap-2 border-divider border-t">
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={full}
							onClick={() =>
								setDialog({
									heading: "Adicionar material",
									kind: "newMaterial",
								})
							}
							variant="outline"
						>
							Adicionar material
						</Button>
						<Button
							disabled={full}
							onClick={() =>
								setDialog({ heading: "Adicionar serviço", kind: "newService" })
							}
							variant="outline"
						>
							Adicionar serviço
						</Button>
					</div>
					{full ? (
						<Text size="xs" tone="muted">
							{`A ficha já tem ${productLimits.sheetItems} itens, o máximo.`}
						</Text>
					) : null}
				</PanelContent>
			</Panel>
			<MissingCosts lines={estimate.missing} references={references} />
			{failure ? (
				<Alert
					ref={alertRef}
					role="alert"
					tabIndex={-1}
					tone={failure.kind === "stale" ? "warning" : "danger"}
				>
					<AlertTitle>Não foi possível salvar a ficha</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
					{failure.kind === "stale" ? (
						<AlertActions>
							<Button onClick={onReloadCurrent} variant="outline">
								Carregar versão atual
							</Button>
						</AlertActions>
					) : null}
				</Alert>
			) : null}
			<div className="flex flex-wrap gap-2">
				<Button disabled={saving} onClick={save} size="touch">
					{saveLabel}
				</Button>
				<ButtonLink
					render={
						<Link
							params={{ produtoId: product.id }}
							to="/catalogo-produtos/produtos/$produtoId"
						/>
					}
					size="touch"
					variant="outline"
				>
					Cancelar
				</ButtonLink>
			</div>
			<SheetItemDialog
				mode={dialog}
				onOpenChange={(open) => {
					if (!open) {
						setDialog(null);
					}
				}}
				onSave={saveItem}
			/>
		</div>
	);
}

export function SheetPage({ productId }: { productId: string }) {
	const detail = useQuery(productQuery(productId));
	const [opened, setOpened] = useState<ProductDetailView | null>(null);
	useEffect(() => {
		if (!opened && detail.data) {
			setOpened(detail.data);
		}
	}, [opened, detail.data]);
	usePageHeader({
		backHref: `/catalogo-produtos/produtos/${productId}`,
		eyebrow: "Ficha técnica",
		heading: opened?.product.name ?? "Produto",
	});

	if (!(opened || detail.data) && detail.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!(opened || detail.data)) {
		const message = detail.isError
			? clientCommandFailure(detail.error, "produto").message
			: commandMessages.productNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir este produto</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/catalogo-produtos/produtos" />}
						variant="outline"
					>
						Voltar para produtos
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}
	if (!opened) {
		return <Skeleton className="h-96" />;
	}

	const reloadCurrent = async () => {
		const fresh = await detail.refetch();
		if (fresh.data) {
			setOpened(fresh.data);
		}
	};

	return (
		<SheetEditor
			detail={opened}
			key={opened.product.version}
			onReloadCurrent={reloadCurrent}
		/>
	);
}
