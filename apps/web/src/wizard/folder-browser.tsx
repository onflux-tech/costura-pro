import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { DataList, DataListRow } from "@costura-pro/ui/components/data-list";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Mono, Text } from "@costura-pro/ui/components/typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, FolderIcon } from "lucide-react";
import { useState } from "react";

import { commandErrorMessage } from "@/lib/command-error";
import { refreshInstallation } from "@/lib/installation-queries";
import { useOpId } from "@/lib/use-op-id";
import { orpc } from "@/utils/orpc";

export function FolderBrowser({
	initialPath,
	onTested,
}: {
	initialPath: string | null;
	onTested: () => void;
}) {
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [path, setPath] = useState(initialPath ?? undefined);
	const [typed, setTyped] = useState(initialPath ?? "");
	const [failure, setFailure] = useState<string | null>(null);
	const listing = useQuery(
		orpc.installation.listFolders.queryOptions({
			input: { path },
			meta: { silent: true },
			retry: false,
		})
	);
	const test = useMutation(
		orpc.installation.testBackupFolder.mutationOptions()
	);

	const open = (next: string | undefined) => {
		setFailure(null);
		setPath(next);
		setTyped(next ?? "");
	};

	const testFolder = async (target: string) => {
		setFailure(null);
		try {
			await test.mutateAsync({ opId: opIdFor(target), path: target });
			reset();
			onTested();
		} catch (error) {
			setFailure(commandErrorMessage(error));
		}
		await refreshInstallation(queryClient);
	};

	const current = listing.data?.path ?? null;

	return (
		<>
			<form
				className="flex flex-col gap-2 md:flex-row md:items-end"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					open(typed.trim() || undefined);
				}}
			>
				<Field className="flex-1">
					<FieldLabel>Caminho da pasta</FieldLabel>
					<Input
						autoCapitalize="none"
						onChange={(event) => setTyped(event.target.value)}
						placeholder="D:\Backups"
						spellCheck={false}
						value={typed}
					/>
				</Field>
				<Button type="submit" variant="outline">
					Abrir
				</Button>
			</form>
			<Panel>
				<PanelHeader>
					<PanelTitle level={3}>
						{current ? (
							<Mono className="break-all">{current}</Mono>
						) : (
							"Unidades do servidor"
						)}
					</PanelTitle>
					{current ? (
						<Button
							onClick={() => open(listing.data?.parent ?? undefined)}
							size="sm"
							variant="ghost"
						>
							<ArrowUpIcon aria-hidden="true" />
							Subir um nível
						</Button>
					) : null}
				</PanelHeader>
				{listing.isPending ? (
					<PanelContent>
						<Skeleton className="h-24" />
					</PanelContent>
				) : null}
				{listing.isError ? (
					<PanelContent>
						<Alert tone="danger">
							<AlertTitle>Não foi possível abrir a pasta</AlertTitle>
							<AlertDescription>
								{commandErrorMessage(listing.error)}
							</AlertDescription>
						</Alert>
					</PanelContent>
				) : null}
				{listing.data?.folders.length === 0 ? (
					<PanelContent>
						<Text tone="muted">Nenhuma subpasta.</Text>
					</PanelContent>
				) : null}
				{listing.data && listing.data.folders.length > 0 ? (
					<DataList
						aria-label="Subpastas"
						className="max-h-72 overflow-y-auto"
						columns="minmax(0,1fr)"
					>
						{listing.data.folders.map((folder) => (
							<DataListRow className="p-0 md:p-0" key={folder.path}>
								<Button
									className="w-full justify-start rounded-none px-4"
									onClick={() => open(folder.path)}
									variant="ghost"
								>
									<FolderIcon aria-hidden="true" />
									<Text className="truncate" inline>
										{folder.name}
									</Text>
								</Button>
							</DataListRow>
						))}
					</DataList>
				) : null}
			</Panel>
			{failure ? (
				<Alert tone="danger">
					<AlertTitle>A pasta não passou no teste</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<Button
				className="md:w-auto md:self-end"
				disabled={!current || test.isPending}
				onClick={() => current && testFolder(current)}
				size="touch"
			>
				{test.isPending ? "Testando..." : "Testar esta pasta"}
			</Button>
		</>
	);
}
