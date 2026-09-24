import { searchLimits } from "@costura-pro/domain/search";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { DataList, DataListRow } from "@costura-pro/ui/components/data-list";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
	type ClientHitView,
	clientDetail,
	type MaterialVariantHitView,
	materialVariantLabel,
	moreVariants,
	type ParentHitView,
	type ProductVariantHitView,
	type ProfileHitView,
	parentDetail,
	productVariantLabel,
	profileDetail,
	type SearchGroupKey,
	type SearchView,
	type ServiceHitView,
	searchGroupOrder,
	seeGroupLabel,
	serviceDetail,
} from "@/lib/search";

import { Marked } from "./marked";

const nameLink =
	"h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0";

export const groupHeadings: Record<SearchGroupKey, string> = {
	clients: "Clientes",
	materials: "Materiais",
	products: "Produtos",
	profiles: "Perfis",
	services: "Serviços",
};

export function SearchFailure({
	description = "Confira a conexão com o servidor e tente de novo.",
	heading,
	onRetry,
}: {
	description?: string;
	heading: string;
	onRetry?: () => void;
}) {
	return (
		<Alert role="alert" tone="danger">
			<AlertTitle>{heading}</AlertTitle>
			<AlertDescription>{description}</AlertDescription>
			{onRetry ? (
				<AlertActions>
					<Button onClick={onRetry} size="sm" variant="outline">
						Tentar de novo
					</Button>
				</AlertActions>
			) : null}
		</Alert>
	);
}

export function ResultPanel({
	children,
	footer,
	heading,
}: {
	children: ReactNode;
	footer?: ReactNode;
	heading: string;
}) {
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{heading}</PanelTitle>
			</PanelHeader>
			<DataList aria-label={heading} columns="minmax(0,1fr)">
				{children}
			</DataList>
			{footer ? (
				<PanelContent className="border-divider border-t py-2">
					{footer}
				</PanelContent>
			) : null}
		</Panel>
	);
}

function Hit({
	badges,
	detail,
	link,
	more,
	variants = [],
}: {
	badges?: ReactNode;
	detail: string;
	link: ReactNode;
	more?: string | null;
	variants?: readonly { id: string; label: ReactNode }[];
}) {
	return (
		<DataListRow className="gap-0.5">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				{link}
				{badges}
			</div>
			<Text size="xs" tone="subtle">
				{detail}
			</Text>
			{variants.map((variant) => (
				<Text key={variant.id} size="xs">
					{variant.label}
				</Text>
			))}
			{more ? (
				<Text size="xs" tone="subtle">
					{more}
				</Text>
			) : null}
		</DataListRow>
	);
}

function ArchivedBadge({ archived }: { archived: boolean }) {
	return archived ? <Badge>arquivado</Badge> : null;
}

export function ClientRow({
	hit,
	query,
}: {
	hit: ClientHitView;
	query: string;
}) {
	return (
		<Hit
			badges={
				<>
					{hit.kind === "organization" ? <Badge>organização</Badge> : null}
					<ArchivedBadge archived={hit.archived} />
				</>
			}
			detail={clientDetail(hit)}
			link={
				<ButtonLink
					className={nameLink}
					render={
						<Link
							params={{ clienteId: hit.id }}
							to="/atendimento/clientes/$clienteId"
						/>
					}
					variant="link"
				>
					<Marked query={query} text={hit.name} />
				</ButtonLink>
			}
		/>
	);
}

export function ProfileRow({
	hit,
	query,
}: {
	hit: ProfileHitView;
	query: string;
}) {
	return (
		<Hit
			badges={<ArchivedBadge archived={hit.archived} />}
			detail={profileDetail(hit)}
			link={
				<ButtonLink
					className={nameLink}
					render={
						<Link
							params={{ clienteId: hit.clientId }}
							search={{ perfil: hit.id }}
							to="/atendimento/clientes/$clienteId"
						/>
					}
					variant="link"
				>
					<Marked query={query} text={hit.name} />
				</ButtonLink>
			}
		/>
	);
}

export function ProductRow({
	hit,
	query,
}: {
	hit: ParentHitView<ProductVariantHitView>;
	query: string;
}) {
	return (
		<Hit
			badges={<ArchivedBadge archived={hit.archived} />}
			detail={parentDetail(hit.category, hit.variantCount)}
			link={
				<ButtonLink
					className={nameLink}
					render={
						<Link
							params={{ produtoId: hit.id }}
							to="/catalogo-produtos/produtos/$produtoId"
						/>
					}
					variant="link"
				>
					<Marked query={query} text={hit.name} />
				</ButtonLink>
			}
			more={moreVariants(hit.matchedCount, hit.variants.length)}
			variants={hit.variants.map((variant) => ({
				id: variant.id,
				label: <Marked query={query} text={productVariantLabel(variant)} />,
			}))}
		/>
	);
}

export function MaterialRow({
	hit,
	query,
}: {
	hit: ParentHitView<MaterialVariantHitView>;
	query: string;
}) {
	return (
		<Hit
			badges={<ArchivedBadge archived={hit.archived} />}
			detail={parentDetail(hit.category, hit.variantCount)}
			link={
				<ButtonLink
					className={nameLink}
					render={
						<Link
							params={{ materialId: hit.id }}
							to="/catalogo-produtos/materiais/$materialId"
						/>
					}
					variant="link"
				>
					<Marked query={query} text={hit.name} />
				</ButtonLink>
			}
			more={moreVariants(hit.matchedCount, hit.variants.length)}
			variants={hit.variants.map((variant) => ({
				id: variant.id,
				label: <Marked query={query} text={materialVariantLabel(variant)} />,
			}))}
		/>
	);
}

export function ServiceRow({
	hit,
	query,
}: {
	hit: ServiceHitView;
	query: string;
}) {
	return (
		<Hit
			badges={
				<>
					{hit.outsourced ? <Badge>terceirizado</Badge> : null}
					<ArchivedBadge archived={hit.archived} />
				</>
			}
			detail={serviceDetail(hit)}
			link={
				<ButtonLink
					className={nameLink}
					render={
						<Link
							params={{ servicoId: hit.id }}
							to="/catalogo-produtos/servicos/$servicoId"
						/>
					}
					variant="link"
				>
					<Marked query={query} text={hit.name} />
				</ButtonLink>
			}
		/>
	);
}

function GroupRows({
	group,
	query,
	result,
}: {
	group: SearchGroupKey;
	query: string;
	result: SearchView;
}) {
	switch (group) {
		case "clients":
			return result.clients.items.map((hit) => (
				<ClientRow hit={hit} key={hit.id} query={query} />
			));
		case "profiles":
			return result.profiles.items.map((hit) => (
				<ProfileRow hit={hit} key={hit.id} query={query} />
			));
		case "products":
			return result.products.items.map((hit) => (
				<ProductRow hit={hit} key={hit.id} query={query} />
			));
		case "materials":
			return result.materials.items.map((hit) => (
				<MaterialRow hit={hit} key={hit.id} query={query} />
			));
		default:
			return result.services.items.map((hit) => (
				<ServiceRow hit={hit} key={hit.id} query={query} />
			));
	}
}

export function AllResults({
	onShowGroup,
	query,
	result,
}: {
	onShowGroup: (group: SearchGroupKey) => void;
	query: string;
	result: SearchView;
}) {
	return (
		<div className="flex flex-col gap-4">
			{searchGroupOrder
				.filter((group) => result[group].items.length > 0)
				.map((group) => (
					<ResultPanel
						footer={
							result[group].total > searchLimits.perGroup ? (
								<Button
									className="px-0"
									onClick={() => onShowGroup(group)}
									variant="link"
								>
									{seeGroupLabel(group, result[group].total)}
								</Button>
							) : null
						}
						heading={groupHeadings[group]}
						key={group}
					>
						<GroupRows group={group} query={query} result={result} />
					</ResultPanel>
				))}
		</div>
	);
}
