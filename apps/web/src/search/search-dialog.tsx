import { searchLimits } from "@costura-pro/domain/search";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import {
	CommandPalette,
	CommandPaletteCollection,
	CommandPaletteEmpty,
	CommandPaletteFooter,
	CommandPaletteGroup,
	CommandPaletteGroupLabel,
	CommandPaletteInput,
	CommandPaletteItem,
	CommandPaletteKey,
	CommandPaletteList,
	CommandPaletteSearch,
	CommandPaletteStatus,
} from "@costura-pro/ui/components/command-palette";
import { Text } from "@costura-pro/ui/components/typography";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
	clientDetail,
	isEmptyResult,
	materialVariantLabel,
	type PaletteGroup,
	type PaletteOption,
	paletteGroups,
	parentDetail,
	productVariantLabel,
	profileDetail,
	searchReady,
	searchStatus,
	serviceDetail,
} from "@/lib/search";
import { orpc } from "@/utils/orpc";

import { Marked } from "./marked";

function Line({ children }: { children: ReactNode }) {
	return (
		<Text inline size="xs" tone="subtle">
			{children}
		</Text>
	);
}

function Title({ query, text }: { query: string; text: string }) {
	return (
		<Text inline weight="semibold">
			<Marked query={query} text={text} />
		</Text>
	);
}

function OptionContent({
	option,
	query,
}: {
	option: PaletteOption;
	query: string;
}) {
	switch (option.kind) {
		case "clients":
			return (
				<>
					<div className="flex flex-wrap items-center gap-x-2">
						<Title query={query} text={option.hit.name} />
						{option.hit.kind === "organization" ? (
							<Badge>organização</Badge>
						) : null}
					</div>
					<Line>{clientDetail(option.hit)}</Line>
				</>
			);
		case "profiles":
			return (
				<>
					<Title query={query} text={option.hit.name} />
					<Line>{profileDetail(option.hit)}</Line>
				</>
			);
		case "products": {
			const [variant] = option.hit.variants;
			return (
				<>
					<Title query={query} text={option.hit.name} />
					<Line>
						{parentDetail(option.hit.category, option.hit.variantCount)}
					</Line>
					{variant ? (
						<Text inline size="xs">
							<Marked query={query} text={productVariantLabel(variant)} />
						</Text>
					) : null}
				</>
			);
		}
		case "materials": {
			const [variant] = option.hit.variants;
			return (
				<>
					<Title query={query} text={option.hit.name} />
					<Line>
						{parentDetail(option.hit.category, option.hit.variantCount)}
					</Line>
					{variant ? (
						<Text inline size="xs">
							<Marked query={query} text={materialVariantLabel(variant)} />
						</Text>
					) : null}
				</>
			);
		}
		case "services":
			return (
				<>
					<div className="flex flex-wrap items-center gap-x-2">
						<Title query={query} text={option.hit.name} />
						{option.hit.outsourced ? <Badge>terceirizado</Badge> : null}
					</div>
					<Line>{serviceDetail(option.hit)}</Line>
				</>
			);
		default:
			return (
				<Text inline weight="semibold">
					{option.label}
				</Text>
			);
	}
}

function EmptyContent({
	failed,
	loading,
	onRetry,
	ready,
}: {
	failed: boolean;
	loading: boolean;
	onRetry: () => void;
	ready: boolean;
}) {
	if (!ready) {
		return "Digite pelo menos 2 letras ou números: nome, telefone, código, material ou serviço.";
	}
	if (failed) {
		return (
			<div className="flex flex-col items-start gap-2">
				<Text inline>Não foi possível buscar.</Text>
				<Button onClick={onRetry} size="sm" variant="outline">
					Tentar de novo
				</Button>
			</div>
		);
	}
	return loading ? "Buscando..." : null;
}

export function SearchDialog({
	onOpenChange,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [text, setText] = useState("");
	const [query, setQuery] = useState("");
	const input = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();

	useEffect(() => {
		const timer = setTimeout(() => setQuery(text.trim()), 250);
		return () => clearTimeout(timer);
	}, [text]);

	useEffect(() => {
		if (!open) {
			setText("");
			setQuery("");
		}
	}, [open]);

	const ready = searchReady(query);
	const results = useQuery({
		...orpc.search.global.queryOptions({
			input: { archived: false, query },
			meta: { silent: true },
		}),
		enabled: open && ready,
		networkMode: "always",
		placeholderData: keepPreviousData,
	});
	const data = ready ? results.data : undefined;
	const stale = ready && results.isPlaceholderData;
	const groups: PaletteGroup[] = data ? paletteGroups(data) : [];

	const navigateTo = (option: PaletteOption) => {
		switch (option.kind) {
			case "clients":
				return navigate({
					params: { clienteId: option.hit.id },
					to: "/atendimento/clientes/$clienteId",
				});
			case "profiles":
				return navigate({
					params: { clienteId: option.hit.clientId },
					search: { perfil: option.hit.id },
					to: "/atendimento/clientes/$clienteId",
				});
			case "products":
				return navigate({
					params: { produtoId: option.hit.id },
					to: "/catalogo-produtos/produtos/$produtoId",
				});
			case "materials":
				return navigate({
					params: { materialId: option.hit.id },
					to: "/catalogo-produtos/materiais/$materialId",
				});
			case "services":
				return navigate({
					params: { servicoId: option.hit.id },
					to: "/catalogo-produtos/servicos/$servicoId",
				});
			case "all":
				return navigate({ search: { busca: query }, to: "/busca" });
			default:
				return navigate({
					search: { arquivados: 1, busca: query },
					to: "/busca",
				});
		}
	};

	const choose = (option: PaletteOption) => {
		onOpenChange(false);
		return navigateTo(option);
	};

	return (
		<CommandPalette label="Buscar" onOpenChange={onOpenChange} open={open}>
			<CommandPaletteSearch
				items={groups}
				itemToStringValue={(option: PaletteOption) => option.label}
				onValueChange={setText}
				value={text}
			>
				<CommandPaletteInput
					aria-label="Buscar"
					maxLength={searchLimits.query.max}
					placeholder="Buscar cliente, telefone, produto, material ou serviço"
					ref={input}
				/>
				{data && !stale && isEmptyResult(data) ? (
					<Text className="px-5 pt-4" tone="subtle">
						Nada encontrado para “{query}”.
					</Text>
				) : null}
				<CommandPaletteList
					aria-busy={stale}
					className={stale ? "opacity-60" : undefined}
				>
					{(group: PaletteGroup) => (
						<CommandPaletteGroup items={group.items} key={group.id}>
							{group.label ? (
								<CommandPaletteGroupLabel>
									{group.label}
								</CommandPaletteGroupLabel>
							) : null}
							<CommandPaletteCollection>
								{(option: PaletteOption) => (
									<CommandPaletteItem
										key={option.id}
										onClick={() => choose(option)}
										value={option}
									>
										<OptionContent option={option} query={query} />
									</CommandPaletteItem>
								)}
							</CommandPaletteCollection>
						</CommandPaletteGroup>
					)}
				</CommandPaletteList>
				<CommandPaletteEmpty>
					<EmptyContent
						failed={results.isError && !results.data}
						loading={results.isFetching}
						onRetry={() => {
							results.refetch();
							input.current?.focus();
						}}
						ready={ready}
					/>
				</CommandPaletteEmpty>
				<CommandPaletteStatus>
					{ready ? searchStatus(data, query, stale) : ""}
				</CommandPaletteStatus>
				<CommandPaletteFooter>
					<Text inline size="xs" tone="muted">
						<CommandPaletteKey>↑</CommandPaletteKey>{" "}
						<CommandPaletteKey>↓</CommandPaletteKey> navegar
					</Text>
					<Text inline size="xs" tone="muted">
						<CommandPaletteKey>Enter</CommandPaletteKey> abrir
					</Text>
					<Text inline size="xs" tone="muted">
						<CommandPaletteKey>Esc</CommandPaletteKey> fechar
					</Text>
				</CommandPaletteFooter>
			</CommandPaletteSearch>
		</CommandPalette>
	);
}
