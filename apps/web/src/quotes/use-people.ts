import { useQuery } from "@tanstack/react-query";

import { clientDetailQuery } from "@/atendimento/client-queries";
import { receivedItemsQuery } from "@/atendimento/received-item-queries";
import type { PeopleNames } from "@/lib/quotes";

export type PersonChoice = { active: boolean; id: string; label: string };

export type PersonChoices = {
	profiles: readonly PersonChoice[];
	receivedItems: readonly PersonChoice[];
};

export function usePeople(clientId: string) {
	const owner = useQuery(clientDetailQuery(clientId));
	const received = useQuery(receivedItemsQuery(clientId));
	const profiles = owner.data?.profiles ?? [];
	const items = received.data?.items ?? [];
	const people: PeopleNames = {
		profiles: new Map(profiles.map((profile) => [profile.id, profile.name])),
		receivedItems: new Map(items.map((item) => [item.id, item.description])),
	};
	const choices: PersonChoices = {
		profiles: profiles.map((profile) => ({
			active: profile.archivedAt === null,
			id: profile.id,
			label:
				profile.archivedAt === null
					? profile.name
					: `${profile.name} (arquivado)`,
		})),
		receivedItems: items.map((item) => ({
			active: item.returnedOn === null && item.archivedAt === null,
			id: item.id,
			label:
				item.returnedOn === null
					? item.description
					: `${item.description} (devolvida)`,
		})),
	};
	return { choices, people };
}
