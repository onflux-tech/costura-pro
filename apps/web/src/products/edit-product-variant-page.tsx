import { commandMessages } from "@costura-pro/api/command-messages";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	type ProductDetailView,
	type ProductVariantFields,
	type ProductVariantView,
	productVariantFormValues,
	productVariantPatch,
} from "@/lib/products";
import { useOpId } from "@/lib/use-op-id";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { SettingsPending } from "@/pricing/settings-failure";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	failedProductCommand,
	productQuery,
	refreshProducts,
} from "./product-queries";
import { ProductVariantForm } from "./product-variant-form";

type Opened = { detail: ProductDetailView; variant: ProductVariantView };

function openedFrom(
	detail: ProductDetailView | undefined,
	variantId: string
): Opened | null {
	const variant = detail?.variants.find((item) => item.id === variantId);
	return detail && variant ? { detail, variant } : null;
}

function VariantEditor({
	atelierTarget,
	detail,
	onReloadCurrent,
	variant,
}: {
	atelierTarget: number;
	detail: ProductDetailView;
	onReloadCurrent: () => Promise<void>;
	variant: ProductVariantView;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [archiving, setArchiving] = useState(false);
	const [dirty, setDirty] = useState(false);

	const openProduct = () =>
		navigate({
			params: { produtoId: detail.product.id },
			to: "/catalogo-produtos/produtos/$produtoId",
		});

	const reloadCurrent = async () => {
		setFailure(null);
		await onReloadCurrent();
	};

	const submit = async (fields: ProductVariantFields) => {
		setFailure(null);
		const patch = productVariantPatch(variant, fields);
		if (!patch) {
			await openProduct();
			return;
		}
		try {
			await api.productVariants.update({
				baseVersion: variant.version,
				opId: opIdFor(
					`${variant.id}:${variant.version}:${JSON.stringify(patch)}`
				),
				patch,
				variantId: variant.id,
			});
		} catch (error) {
			setFailure(await failedProductCommand(queryClient, error, "variante"));
			return;
		}
		reset();
		await refreshProducts(queryClient);
		toast.success("Variante salva");
		await openProduct();
	};

	const toggleArchive = async () => {
		setArchiving(true);
		setFailure(null);
		const command = variant.archivedAt
			? api.productVariants.unarchive
			: api.productVariants.archive;
		try {
			await command({
				baseVersion: variant.version,
				opId: crypto.randomUUID(),
				variantId: variant.id,
			});
		} catch (error) {
			setFailure(await failedProductCommand(queryClient, error, "variante"));
			return;
		} finally {
			setArchiving(false);
		}
		await refreshProducts(queryClient);
		await reloadCurrent();
	};
	const archiveLabel = variant.archivedAt ? "Desarquivar" : "Arquivar";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{`${detail.product.name} · ${variant.name}`}</Heading>
					<div className="flex flex-wrap items-center gap-2">
						<Text size="sm" tone="muted">
							{`Versão ${variant.version}`}
						</Text>
						{variant.archivedAt ? (
							<Badge tone="warning">arquivada</Badge>
						) : null}
					</div>
				</div>
				<div className="flex flex-col items-end gap-1">
					<Button
						disabled={archiving || dirty}
						onClick={toggleArchive}
						variant="outline"
					>
						{archiveLabel}
					</Button>
					{dirty ? (
						<Text size="xs" tone="muted">
							Salve as mudanças antes de arquivar
						</Text>
					) : null}
				</div>
			</div>
			<ProductVariantForm
				atelierTarget={atelierTarget}
				detail={detail}
				failure={failure}
				initialChanges={variant.sheetChanges}
				initialValues={productVariantFormValues(variant)}
				onDirtyChange={setDirty}
				onReloadCurrent={reloadCurrent}
				onSubmit={submit}
				submitLabel="Salvar variante"
				variantId={variant.id}
			/>
		</div>
	);
}

export function EditProductVariantPage({
	productId,
	variantId,
}: {
	productId: string;
	variantId: string;
}) {
	const detail = useQuery(productQuery(productId));
	const settings = useQuery(pricingSettingsQuery());
	const [opened, setOpened] = useState<Opened | null>(null);
	const live = openedFrom(detail.data, variantId);
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
		}
	}, [opened, live]);
	const current = opened ?? live;
	usePageHeader({
		backHref: `/catalogo-produtos/produtos/${productId}`,
		eyebrow: current?.detail.product.name ?? "Produto",
		heading: current?.variant.name ?? "Variante",
	});

	if (!current && detail.isPending) {
		return <Skeleton className="h-96 md:max-w-3xl" />;
	}
	if (!current) {
		const message = detail.isError
			? clientCommandFailure(detail.error, "variante").message
			: commandMessages.productVariantNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir esta variante</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={
							<Link
								params={{ produtoId: productId }}
								to="/catalogo-produtos/produtos/$produtoId"
							/>
						}
						variant="outline"
					>
						Voltar para o produto
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}
	if (!(opened && settings.data)) {
		return (
			<SettingsPending
				error={settings.error}
				onRetry={() => settings.refetch()}
			/>
		);
	}

	const reloadCurrent = async () => {
		const fresh = await detail.refetch();
		const next = openedFrom(fresh.data, variantId);
		if (next) {
			setOpened(next);
		}
	};

	return (
		<VariantEditor
			atelierTarget={settings.data.targetMarginBasisPoints}
			detail={opened.detail}
			key={`${opened.variant.version}:${opened.detail.product.version}`}
			onReloadCurrent={reloadCurrent}
			variant={opened.variant}
		/>
	);
}
