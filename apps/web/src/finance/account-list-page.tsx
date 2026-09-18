import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@costura-pro/ui/components/dropdown-menu";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { clientCommandFailure } from "@/lib/client-command-error";
import { useDrafts } from "@/lib/drafts";
import { type AccountView, accountKindLabel, moneyLabel } from "@/lib/finance";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { AccountDialog } from "./account-dialog";
import {
	type AccountAction,
	AccountMovementDialog,
} from "./account-movement-dialog";
import { AccountStatementPanel } from "./account-statement-panel";
import {
	accountsQuery,
	failedFinanceCommand,
	refreshFinance,
} from "./finance-queries";

const route = getRouteApi("/_app/financas/contas");

export function AccountListPage() {
	const { arquivadas } = route.useSearch();
	const navigate = route.useNavigate();
	const archived = arquivadas === 1;
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [editing, setEditing] = useState<AccountView | null>(null);
	const [formOpen, setFormOpen] = useState(false);
	const [target, setTarget] = useState<AccountView | null>(null);
	const [action, setAction] = useState<AccountAction>("opening");
	const [movementOpen, setMovementOpen] = useState(false);
	const [opened, setOpened] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const { draftFor, forget } = useDrafts();
	usePageHeader({ eyebrow: "Finanças", heading: "Contas" });

	const list = useQuery(accountsQuery(archived));
	const items = list.data?.items ?? [];

	const start = (account: AccountView, next: AccountAction) => {
		setTarget(account);
		setAction(next);
		setMovementOpen(true);
	};

	const toggleArchive = async (account: AccountView) => {
		setBusy(account.id);
		try {
			const input = {
				accountId: account.id,
				baseVersion: account.version,
				opId: opIdFor(`${account.id}:${account.version}`),
			};
			if (account.archivedAt) {
				await api.financialAccounts.unarchive(input);
			} else {
				await api.financialAccounts.archive(input);
			}
			await refreshFinance(queryClient);
		} catch (error) {
			const failed = await failedFinanceCommand(queryClient, error);
			toast.error(failed.message);
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Heading className="max-md:sr-only">Contas</Heading>
				<Button
					className="max-md:w-full"
					onClick={() => {
						setEditing(null);
						setFormOpen(true);
					}}
				>
					Nova conta
				</Button>
			</div>
			<ChoiceChips
				aria-label="Situação"
				onValueChange={(value) =>
					navigate({
						search: () => ({
							arquivadas: value === "arquivadas" ? (1 as const) : undefined,
						}),
					})
				}
				value={archived ? "arquivadas" : "ativas"}
			>
				<ChoiceChip value="ativas">Ativas</ChoiceChip>
				<ChoiceChip value="arquivadas">Arquivadas</ChoiceChip>
			</ChoiceChips>
			<Panel>
				{list.isPending ? (
					<PanelContent className="flex flex-col gap-2">
						<Skeleton className="h-10" />
						<Skeleton className="h-10" />
					</PanelContent>
				) : null}
				{list.isError ? (
					<PanelContent>
						<Text tone="danger">
							{clientCommandFailure(list.error, "conta").message}
						</Text>
					</PanelContent>
				) : null}
				{list.isSuccess && items.length === 0 ? (
					<PanelContent className="flex flex-col items-start gap-2 p-6">
						<Heading level={2} size="section">
							{archived ? "Nenhuma conta arquivada" : "Nenhuma conta ainda"}
						</Heading>
						<Text tone="subtle">
							{archived
								? "Conta arquivada sai das escolhas e mantém o extrato."
								: "Crie o caixa do ateliê e as contas de banco ou Pix, e lance o saldo de abertura de cada uma."}
						</Text>
					</PanelContent>
				) : null}
				{items.length > 0 ? (
					<DataList aria-label="Contas" columns="minmax(0,1fr) 10rem 7rem">
						<DataListHeader>
							<DataListHeaderCell>Conta</DataListHeaderCell>
							<DataListHeaderCell align="end">Saldo</DataListHeaderCell>
							<DataListHeaderCell align="end">Ações</DataListHeaderCell>
						</DataListHeader>
						{items.map((item) => (
							<DataListRow key={item.id}>
								<DataListCell label="Conta">
									<div className="flex flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											<Button
												aria-expanded={opened === item.id}
												className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
												onClick={() =>
													setOpened(opened === item.id ? null : item.id)
												}
												variant="link"
											>
												{item.name}
											</Button>
											<Badge tone="neutral">
												{accountKindLabel(item.kind)}
											</Badge>
											{item.archivedAt ? (
												<Badge tone="warning">arquivada</Badge>
											) : null}
										</div>
										{item.notes ? (
											<Text size="sm" tone="subtle">
												{item.notes}
											</Text>
										) : null}
									</div>
								</DataListCell>
								<DataListCell align="end" label="Saldo">
									<Text
										inline
										numeric
										tone={
											item.balanceCents.startsWith("-") ? "danger" : "default"
										}
									>
										{moneyLabel(item.balanceCents)}
									</Text>
								</DataListCell>
								<DataListCell align="end" label="Ações">
									<DropdownMenu>
										<DropdownMenuTrigger
											render={
												<Button
													aria-label={`Ações de ${item.name}`}
													size="sm"
													variant="outline"
												/>
											}
										>
											Ações
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											<DropdownMenuItem onClick={() => start(item, "opening")}>
												Saldo de abertura
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => start(item, "transfer")}>
												Transferir
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													setEditing(item);
													setFormOpen(true);
												}}
											>
												Editar
											</DropdownMenuItem>
											<DropdownMenuItem
												disabled={busy === item.id}
												onClick={() => toggleArchive(item)}
											>
												{item.archivedAt ? "Desarquivar" : "Arquivar"}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</DataListCell>
								{opened === item.id ? (
									<AccountStatementPanel accountId={item.id} />
								) : null}
							</DataListRow>
						))}
					</DataList>
				) : null}
			</Panel>
			<AccountDialog
				account={editing}
				onOpenChange={setFormOpen}
				open={formOpen}
			/>
			{target ? (
				<AccountMovementDialog
					account={target}
					action={action}
					draft={draftFor(`${target.id}:${action}`)}
					onDone={() => forget(`${target.id}:${action}`)}
					onOpenChange={setMovementOpen}
					open={movementOpen}
				/>
			) : null}
		</div>
	);
}
