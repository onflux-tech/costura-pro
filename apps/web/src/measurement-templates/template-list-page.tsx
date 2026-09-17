import { Badge } from "@costura-pro/ui/components/badge";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";

import { clientCommandFailure } from "@/lib/client-command-error";
import { measurementTemplatesQuery } from "@/lib/measurement-queries";
import { usePageHeader } from "@/shell/page-header";

const route = getRouteApi("/_app/catalogo-produtos/modelos-de-medidas/");

export function TemplateListPage() {
	const { arquivados } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const templates = useQuery(measurementTemplatesQuery());
	usePageHeader({ eyebrow: "Catálogo", heading: "Modelos de medidas" });
	const items = (templates.data?.items ?? []).filter(
		(item) => (item.archivedAt !== null) === archived
	);
	const emptyTitle = archived
		? "Nenhum modelo arquivado"
		: "Nenhum modelo de medidas ativo";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Modelos de medidas</Heading>
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/catalogo-produtos/modelos-de-medidas/novo" />}
				>
					Novo modelo
				</ButtonLink>
			</div>
			<ChoiceChips
				aria-label="Situação"
				onValueChange={(value) =>
					navigate({
						search: { arquivados: value === "arquivados" ? 1 : undefined },
					})
				}
				value={archived ? "arquivados" : "ativos"}
			>
				<ChoiceChip value="ativos">Ativos</ChoiceChip>
				<ChoiceChip value="arquivados">Arquivados</ChoiceChip>
			</ChoiceChips>
			<Panel>
				{templates.isPending ? (
					<PanelContent className="flex flex-col gap-2">
						<Skeleton className="h-10" />
						<Skeleton className="h-10" />
					</PanelContent>
				) : null}
				{templates.isError ? (
					<PanelContent>
						<Text tone="danger">
							{clientCommandFailure(templates.error, "modelo").message}
						</Text>
					</PanelContent>
				) : null}
				{templates.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{emptyTitle}
						</Heading>
						<Text tone="subtle">
							Cada modelo reúne os campos de medida de um tipo de peça.
						</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList
						aria-label="Modelos de medidas"
						columns="minmax(0,1fr) 10rem 4rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Nome</DataListHeaderCell>
							<DataListHeaderCell>Campos</DataListHeaderCell>
							<DataListHeaderCell align="end">Versão</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Nome">
									<ButtonLink
										className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
										render={
											<Link
												params={{ modeloId: item.id }}
												to="/catalogo-produtos/modelos-de-medidas/$modeloId"
											/>
										}
										variant="link"
									>
										{item.name}
									</ButtonLink>
									{item.archivedAt ? (
										<Badge tone="warning">arquivado</Badge>
									) : null}
								</DataListCell>
								<DataListCell label="Campos">
									{`${item.fields.filter((field) => field.active).length} campos ativos`}
								</DataListCell>
								<DataListCell align="end" label="Versão">
									<Text inline numeric>{`v${item.version}`}</Text>
								</DataListCell>
							</DataListRow>
						))}
					</DataList>
				) : null}
			</Panel>
		</div>
	);
}
