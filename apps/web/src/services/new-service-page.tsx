import { Heading } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { emptyServiceValues, type ServiceFields } from "@/lib/services";
import { useOpId } from "@/lib/use-op-id";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { SettingsPending } from "@/pricing/settings-failure";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { ServiceForm } from "./service-form";
import {
	failedServiceCommand,
	refreshServices,
	serviceCategoriesQuery,
} from "./service-queries";

export function NewServicePage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [serviceId, setServiceId] = useState(() => crypto.randomUUID());
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const categories = useQuery(serviceCategoriesQuery());
	const settings = useQuery(pricingSettingsQuery());
	usePageHeader({
		backHref: "/catalogo-produtos/servicos",
		eyebrow: "Catálogo",
		heading: "Novo serviço",
	});

	const submit = async (fields: ServiceFields) => {
		setFailure(null);
		try {
			await api.services.create({
				...fields,
				opId: opIdFor(`${serviceId}:${JSON.stringify(fields)}`),
				serviceId,
			});
		} catch (error) {
			const failed = await failedServiceCommand(queryClient, error);
			if (failed.kind === "exists") {
				toast.info("Este serviço já tinha sido salvo. Confira os dados.");
				await navigate({
					params: { servicoId: serviceId },
					to: "/catalogo-produtos/servicos/$servicoId",
				});
				return;
			}
			setFailure(failed);
			return;
		}
		reset();
		setServiceId(crypto.randomUUID());
		await refreshServices(queryClient);
		toast.success("Serviço salvo");
		await navigate({ to: "/catalogo-produtos/servicos" });
	};

	return (
		<>
			<Heading className="max-md:sr-only">Novo serviço</Heading>
			{settings.data ? (
				<ServiceForm
					atelierTarget={settings.data.targetMarginBasisPoints}
					categories={categories.data?.categories ?? []}
					failure={failure}
					initialValues={emptyServiceValues}
					onSubmit={submit}
					submitLabel="Salvar serviço"
				/>
			) : (
				<SettingsPending
					error={settings.error}
					onRetry={() => settings.refetch()}
				/>
			)}
		</>
	);
}
