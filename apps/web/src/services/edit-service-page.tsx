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
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	type ServiceFields,
	type ServiceView,
	serviceFormValues,
	servicePatch,
} from "@/lib/services";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { ServiceForm } from "./service-form";
import {
	failedServiceCommand,
	pricingSettingsQuery,
	refreshServices,
	serviceCategoriesQuery,
	serviceQuery,
} from "./service-queries";
import { SettingsPending } from "./settings-failure";

function ServiceEditor({
	atelierTarget,
	categories,
	onReloadCurrent,
	service,
}: {
	atelierTarget: number;
	categories: readonly string[];
	onReloadCurrent: () => Promise<void>;
	service: ServiceView;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [archiving, setArchiving] = useState(false);
	const [dirty, setDirty] = useState(false);

	const openList = () => navigate({ to: "/catalogo-produtos/servicos" });

	const reloadCurrent = async () => {
		setFailure(null);
		await onReloadCurrent();
	};

	const submit = async (fields: ServiceFields) => {
		setFailure(null);
		const patch = servicePatch(service, fields);
		if (!patch) {
			await openList();
			return;
		}
		try {
			await api.services.update({
				baseVersion: service.version,
				opId: opIdFor(
					`${service.id}:${service.version}:${JSON.stringify(patch)}`
				),
				patch,
				serviceId: service.id,
			});
		} catch (error) {
			setFailure(await failedServiceCommand(queryClient, error));
			return;
		}
		reset();
		await refreshServices(queryClient);
		toast.success("Serviço salvo");
		await openList();
	};

	const toggleArchive = async () => {
		setArchiving(true);
		setFailure(null);
		const command = service.archivedAt
			? api.services.unarchive
			: api.services.archive;
		try {
			await command({
				baseVersion: service.version,
				opId: crypto.randomUUID(),
				serviceId: service.id,
			});
		} catch (error) {
			setFailure(await failedServiceCommand(queryClient, error));
			return;
		} finally {
			setArchiving(false);
		}
		await refreshServices(queryClient);
		await reloadCurrent();
	};
	const archiveLabel = service.archivedAt ? "Desarquivar" : "Arquivar";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{service.name}</Heading>
					<div className="flex flex-wrap items-center gap-2">
						<Text size="sm" tone="muted">
							{`Versão ${service.version}`}
						</Text>
						{service.archivedAt ? (
							<Badge tone="warning">arquivado</Badge>
						) : null}
					</div>
				</div>
				<div className="flex flex-col items-end gap-1">
					<Button
						disabled={archiving || dirty}
						onClick={toggleArchive}
						variant="outline"
					>
						{archiveLabel}
					</Button>
					{dirty ? (
						<Text size="xs" tone="muted">
							Salve as mudanças antes de arquivar
						</Text>
					) : null}
				</div>
			</div>
			<ServiceForm
				atelierTarget={atelierTarget}
				categories={categories}
				failure={failure}
				initialValues={serviceFormValues(service)}
				onDirtyChange={setDirty}
				onReloadCurrent={reloadCurrent}
				onSubmit={submit}
				submitLabel="Salvar serviço"
			/>
		</div>
	);
}

export function EditServicePage({ serviceId }: { serviceId: string }) {
	const service = useQuery(serviceQuery(serviceId));
	const settings = useQuery(pricingSettingsQuery());
	const categories = useQuery(serviceCategoriesQuery());
	const [opened, setOpened] = useState<ServiceView | null>(null);
	const live = service.data;
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
		}
	}, [opened, live]);
	const current = opened ?? live;
	usePageHeader({
		backHref: "/catalogo-produtos/servicos",
		eyebrow: "Catálogo",
		heading: current?.name ?? "Serviço",
	});

	if (!current && service.isPending) {
		return <Skeleton className="h-96 md:max-w-2xl" />;
	}
	if (!current) {
		const message = service.isError
			? clientCommandFailure(service.error, "serviço").message
			: commandMessages.serviceNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir este serviço</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/catalogo-produtos/servicos" />}
						variant="outline"
					>
						Voltar para serviços
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}
	if (!settings.data) {
		return (
			<SettingsPending
				error={settings.error}
				onRetry={() => settings.refetch()}
			/>
		);
	}

	const reloadCurrent = async () => {
		const fresh = await service.refetch();
		if (fresh.data) {
			setOpened(fresh.data);
		}
	};

	return (
		<ServiceEditor
			atelierTarget={settings.data.targetMarginBasisPoints}
			categories={categories.data?.categories ?? []}
			key={current.version}
			onReloadCurrent={reloadCurrent}
			service={current}
		/>
	);
}
