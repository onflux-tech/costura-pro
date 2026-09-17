import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
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
import { useState } from "react";

import { client as api } from "@/utils/orpc";

import { type EditableProfile, ProfileDialog } from "./profile-dialog";
import { useClientAction } from "./use-client-action";

type Profile = EditableProfile & { archivedAt: string | null };

export function ProfilePanel({
	clientId,
	profiles,
	readOnly,
}: {
	clientId: string;
	profiles: readonly Profile[];
	readOnly: boolean;
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
				<DataList aria-label="Perfis" columns="minmax(0,1fr) auto">
					{visible.map((profile) => (
						<DataListRow key={profile.id}>
							<DataListCell label="Perfil">
								<Text weight="medium">{profile.name}</Text>
								{profile.notes ? (
									<Text size="xs" tone="muted">
										{profile.notes}
									</Text>
								) : null}
								{profile.archivedAt ? (
									<Badge tone="warning">arquivado</Badge>
								) : null}
							</DataListCell>
							{readOnly ? null : (
								<DataListCell align="end" label="Ações">
									<Button
										onClick={() => setEditing(profile.id)}
										size="sm"
										variant="ghost"
									>
										Editar
									</Button>
									<Button
										disabled={action.pending === profile.id}
										onClick={() => toggle(profile)}
										size="sm"
										variant="ghost"
									>
										{profile.archivedAt ? "Desarquivar" : "Arquivar"}
									</Button>
								</DataListCell>
							)}
						</DataListRow>
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
