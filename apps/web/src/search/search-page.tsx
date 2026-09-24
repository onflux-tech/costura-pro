import { searchLimits } from "@costura-pro/domain/search";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import {
	Tabs,
	TabsList,
	TabsPanel,
	TabsTab,
} from "@costura-pro/ui/components/tabs";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	emptyHint,
	type GroupParam,
	groupParams,
	groupParamValues,
	isEmptyResult,
	type SearchGroupKey,
	type SearchView,
	searchReady,
	searchStatus,
	searchTabs,
} from "@/lib/search";
import { usePageHeader } from "@/shell/page-header";
import { orpc } from "@/utils/orpc";

import { GroupResults } from "./search-group-results";
import { AllResults, SearchFailure } from "./search-results";
import { useSearchShortcut } from "./use-search-shortcut";

const route = getRouteApi("/_app/busca");

type TabId = "tudo" | GroupParam;

function ResultTabs({
	active,
	archived,
	focusField,
	onShowGroup,
	onShowTab,
	panel,
	query,
	result,
	stale,
}: {
	active: TabId;
	archived: boolean;
	focusField: () => void;
	onShowGroup: (group: SearchGroupKey) => void;
	onShowTab: (value: unknown) => void;
	panel: RefObject<HTMLDivElement | null>;
	query: string;
	result: SearchView;
	stale: boolean;
}) {
	const tabs = searchTabs(result);
	return (
		<Tabs
			aria-busy={stale}
			className={stale ? "opacity-60" : undefined}
			onValueChange={onShowTab}
			value={active}
		>
			<TabsList aria-label="Resultados por grupo">
				{tabs.map((tab) => (
					<TabsTab count={tab.count} key={tab.id} value={tab.id}>
						{tab.label}
					</TabsTab>
				))}
			</TabsList>
			<TabsPanel value="tudo">
				<AllResults onShowGroup={onShowGroup} query={query} result={result} />
			</TabsPanel>
			{tabs.map((tab) =>
				tab.group === null ? null : (
					<TabsPanel key={tab.id} ref={panel} value={tab.id}>
						<GroupResults
							archived={archived}
							focusField={focusField}
							group={tab.group}
							query={query}
						/>
					</TabsPanel>
				)
			)}
		</Tabs>
	);
}

function SearchBody({
	active,
	archived,
	data,
	failed,
	focusField,
	onRetry,
	onShowGroup,
	onShowTab,
	panel,
	query,
	stale,
}: {
	active: TabId;
	archived: boolean;
	data: SearchView | undefined;
	failed: boolean;
	focusField: () => void;
	onRetry: () => void;
	onShowGroup: (group: SearchGroupKey) => void;
	onShowTab: (value: unknown) => void;
	panel: RefObject<HTMLDivElement | null>;
	query: string;
	stale: boolean;
}) {
	if (!searchReady(query)) {
		return (
			<Panel>
				<PanelContent>
					<Text tone="subtle">
						Digite pelo menos 2 letras ou números: nome, telefone, código,
						material ou serviço.
					</Text>
				</PanelContent>
			</Panel>
		);
	}
	if (failed && !data) {
		return (
			<SearchFailure heading="Não foi possível buscar" onRetry={onRetry} />
		);
	}
	if (!data || (stale && isEmptyResult(data))) {
		return (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
			</div>
		);
	}
	if (isEmptyResult(data)) {
		return (
			<Panel>
				<PanelContent className="flex flex-col items-start gap-2 p-6">
					<Heading level={2} size="section">
						Nada encontrado para “{query}”
					</Heading>
					<Text tone="subtle">{emptyHint(archived)}</Text>
				</PanelContent>
			</Panel>
		);
	}
	return (
		<ResultTabs
			active={active}
			archived={archived}
			focusField={focusField}
			onShowGroup={onShowGroup}
			onShowTab={onShowTab}
			panel={panel}
			query={query}
			result={data}
			stale={stale}
		/>
	);
}

export function SearchPage() {
	const { arquivados, busca = "", grupo } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivados === 1;
	const [text, setText] = useState(busca);
	const [focusOnOpen] = useState(busca === "");
	const [pendingPanel, setPendingPanel] = useState<GroupParam | null>(null);
	const field = useRef<HTMLInputElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const typed = useRef(busca);
	usePageHeader({ heading: "Busca" });

	useEffect(() => {
		if (busca !== typed.current) {
			typed.current = busca;
			setText(busca);
		}
	}, [busca]);

	useEffect(() => {
		if (focusOnOpen) {
			field.current?.focus();
		}
	}, [focusOnOpen]);

	const focusField = useCallback(() => field.current?.focus(), []);
	const selectField = useCallback(() => {
		field.current?.focus();
		field.current?.select();
	}, []);
	useSearchShortcut(selectField);

	useEffect(() => {
		const next = text.trim();
		if (next === busca) {
			return;
		}
		const timer = setTimeout(() => {
			typed.current = next;
			navigate({
				replace: true,
				search: (previous) => ({ ...previous, busca: next || undefined }),
			});
		}, 300);
		return () => clearTimeout(timer);
	}, [busca, navigate, text]);

	const ready = searchReady(busca);
	const results = useQuery({
		...orpc.search.global.queryOptions({
			input: { archived, query: busca },
			meta: { silent: true },
		}),
		enabled: ready,
		networkMode: "always",
		placeholderData: keepPreviousData,
	});
	const data = ready ? results.data : undefined;
	const stale = ready && results.isPlaceholderData;
	const tabIds = data ? searchTabs(data).map((tab) => tab.id) : [];
	const active: TabId = grupo && tabIds.includes(grupo) ? grupo : "tudo";

	useEffect(() => {
		if (pendingPanel && pendingPanel === active) {
			panel.current?.focus();
			setPendingPanel(null);
		}
	}, [active, pendingPanel]);

	const showTab = (value: unknown) => {
		const next = groupParamValues.find((param) => param === value);
		navigate({ search: (previous) => ({ ...previous, grupo: next }) });
	};

	const showGroup = (group: SearchGroupKey) => {
		setPendingPanel(groupParams[group]);
		navigate({
			search: (previous) => ({ ...previous, grupo: groupParams[group] }),
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">Busca</Heading>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<Field className="md:w-96">
					<FieldLabel>Buscar</FieldLabel>
					<Input
						maxLength={searchLimits.query.max}
						onChange={(event) => setText(event.target.value)}
						placeholder="Nome, telefone, código, material ou serviço"
						ref={field}
						type="search"
						value={text}
					/>
				</Field>
				<Checkbox
					checked={archived}
					onCheckedChange={(checked) =>
						navigate({
							search: (previous) => ({
								...previous,
								arquivados: checked ? 1 : undefined,
							}),
						})
					}
				>
					Incluir arquivados
				</Checkbox>
			</div>
			<Text className="sr-only" role="status">
				{ready ? searchStatus(data, busca, stale) : ""}
			</Text>
			<SearchBody
				active={active}
				archived={archived}
				data={data}
				failed={results.isError}
				focusField={focusField}
				onRetry={() => {
					results.refetch();
					focusField();
				}}
				onShowGroup={showGroup}
				onShowTab={showTab}
				panel={panel}
				query={busca}
				stale={stale}
			/>
		</div>
	);
}
