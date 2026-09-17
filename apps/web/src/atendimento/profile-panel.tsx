import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	DataList,
	DataListCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { client as api } from "@/utils/orpc";

import { type EditableProfile, ProfileDialog } from "./profile-dialog";
import { useClientAction } from "./use-client-action";

type Profile = EditableProfile & { archivedAt: string | null };

function ProfileRow({
	clientId,
	onEdit,
	onToggle,
	pending,
	profile,
	readOnly,
	selected,
	summary,
}: {
	clientId: string;
	onEdit: () => void;
	onToggle: () => void;
	pending: boolean;
	profile: Profile;
	readOnly: boolean;
	selected: boolean;
	summary: string | null;
}) {
	const toggleLabel = profile.archivedAt ? "Desarquivar" : "Arquivar";
	return (
		<DataListRow className={selected ? "bg-accent" : undefined}>
			<DataListCell label="Perfil">
				<ButtonLink
					aria-current={selected ? "true" : undefined}
					className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
					render={
						<Link
							params={{ clienteId: clientId }}
							search={{ perfil: profile.id }}
							to="/atendimento/clientes/$clienteId"
						/>
					}
					variant="link"
				>
					{profile.name}
				</ButtonLink>
				{summary === null ? null : (
					<Text size="xs" tone="muted">
						{summary}
					</Text>
				)}
				{profile.notes ? (
					<Text size="xs" tone="muted">
						{profile.notes}
					</Text>
				) : null}
				{profile.archivedAt ? <Badge tone="warning">arquivado</Badge> : null}
			</DataListCell>
			{readOnly ? null : (
				<DataListCell align="end" label="Ações">
					<Button onClick={onEdit} size="sm" variant="ghost">
						Editar
					</Button>
					<Button
						disabled={pending}
						onClick={onToggle}
						size="sm"
						variant="ghost"
					>
						{toggleLabel}
					</Button>
				</DataListCell>
			)}
		</DataListRow>
	);
}

export function ProfilePanel({
	clientId,
	profiles,
	readOnly,
	selectedId,
	summaries,
}: {
	clientId: string;
	profiles: readonly Profile[];
	readOnly: boolean;
	selectedId: string | null;
	summaries: ReadonlyMap<string, string> | null;
}) {
	const action = useClientAction();
	const [showArchived, setShowArchived] = useState(false);
	const [editing, setEditing] = useState<string | null>(null);
	const active = profiles.filter((profile) => profile.archivedAt === null);
	const archivedCount = profiles.length - active.length;
	const visible = showArchived ? profiles : active;

	const toggle = (profile: Profile) => {
		const command = profile.archivedAt
			? api.profiles.unarchive
			: api.profiles.archive;
		return action.run(
			profile.id,
			() =>
				command({
					baseVersion: profile.version,
					opId: crypto.randomUUID(),
					profileId: profile.id,
				}),
			"perfil"
		);
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Perfis de usuário da peça</PanelTitle>
				<PanelMeta>{active.length}</PanelMeta>
			</PanelHeader>
			{visible.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">Nenhum perfil ainda.</Text>
				</PanelContent>
			) : (
				<DataList aria-label="Perfis" columns="minmax(0,1fr)">
					{visible.map((profile) => (
						<ProfileRow
							clientId={clientId}
							key={profile.id}
							onEdit={() => setEditing(profile.id)}
							onToggle={() => toggle(profile)}
							pending={action.pending === profile.id}
							profile={profile}
							readOnly={readOnly}
							selected={profile.id === selectedId}
							summary={
								summaries ? (summaries.get(profile.id) ?? "Sem medição") : null
							}
						/>
					))}
				</DataList>
			)}
			{readOnly ? null : (
				<PanelContent className="flex flex-col gap-2 border-divider border-t">
					<Button onClick={() => setEditing("new")} variant="dashed">
						Adicionar perfil
					</Button>
					{archivedCount > 0 ? (
						<Button
							onClick={() => setShowArchived((current) => !current)}
							variant="link"
						>
							{showArchived
								? "Ocultar arquivados"
								: `Mostrar arquivados (${archivedCount})`}
						</Button>
					) : null}
				</PanelContent>
			)}
			<ProfileDialog
				clientId={clientId}
				onOpenChange={(open) => {
					if (!open) {
						setEditing(null);
					}
				}}
				open={editing !== null}
				profile={profiles.find((profile) => profile.id === editing) ?? null}
			/>
		</Panel>
	);
}
