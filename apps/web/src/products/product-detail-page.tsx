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
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { SettingsPending } from "@/pricing/settings-failure";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { GalleryStrip } from "./gallery-strip";
import {
	failedProductCommand,
	productQuery,
	refreshProducts,
} from "./product-queries";
import { ProductVariantPanel } from "./product-variant-panel";
import { SheetPanel } from "./sheet-panel";

export function ProductDetailPage({ productId }: { productId: string }) {
	const queryClient = useQueryClient();
	const detail = useQuery(productQuery(productId));
	const settings = useQuery(pricingSettingsQuery());
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [archiving, setArchiving] = useState(false);
	const current = detail.data?.product;
	usePageHeader({
		backHref: "/catalogo-produtos/produtos",
		eyebrow: "Catálogo",
		heading: current?.name ?? "Produto",
	});

	if (!detail.data && detail.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!(detail.data && current)) {
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

	const toggleArchive = async () => {
		setArchiving(true);
		setFailure(null);
		const command = current.archivedAt
			? api.products.unarchive
			: api.products.archive;
		try {
			await command({
				baseVersion: current.version,
				opId: crypto.randomUUID(),
				productId,
			});
		} catch (error) {
			setFailure(await failedProductCommand(queryClient, error));
			return;
		} finally {
			setArchiving(false);
		}
		await refreshProducts(queryClient);
	};
	const archiveLabel = current.archivedAt ? "Desarquivar" : "Arquivar";
	const { references, variants } = detail.data;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{current.name}</Heading>
					<div className="flex flex-wrap items-center gap-2">
						<Text size="xs" tone="muted">
							{current.category ?? "Sem categoria"}
						</Text>
						{current.archivedAt ? (
							<Badge tone="warning">arquivado</Badge>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<ButtonLink
						render={
							<Link
								params={{ produtoId: productId }}
								to="/catalogo-produtos/produtos/$produtoId/editar"
							/>
						}
						variant="outline"
					>
						Editar
					</ButtonLink>
					<Button
						disabled={archiving}
						onClick={toggleArchive}
						variant="outline"
					>
						{archiveLabel}
					</Button>
				</div>
			</div>
			{failure ? (
				<Alert tone={failure.kind === "stale" ? "warning" : "danger"}>
					<AlertTitle>Não foi possível salvar</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
				</Alert>
			) : null}
			{current.notes ? (
				<Panel>
					<PanelHeader>
						<PanelTitle>Notas</PanelTitle>
					</PanelHeader>
					<PanelContent>
						<Text>{current.notes}</Text>
					</PanelContent>
				</Panel>
			) : null}
			<GalleryStrip photos={current.photos} productId={productId} />
			<SheetPanel product={current} references={references} />
			{settings.isError && !settings.data ? (
				<SettingsPending
					error={settings.error}
					onRetry={() => settings.refetch()}
				/>
			) : null}
			<ProductVariantPanel
				atelierTarget={settings.data?.targetMarginBasisPoints}
				product={current}
				references={references}
				variants={variants}
			/>
		</div>
	);
}
