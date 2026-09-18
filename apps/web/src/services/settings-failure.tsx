import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { Skeleton } from "@costura-pro/ui/components/skeleton";

import { clientCommandFailure } from "@/lib/client-command-error";

export function SettingsPending({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	if (!error) {
		return <Skeleton className="h-96 md:max-w-2xl" />;
	}
	return (
		<Alert tone="danger">
			<AlertTitle>Não foi possível carregar a meta de margem</AlertTitle>
			<AlertDescription>
				{clientCommandFailure(error, "meta").message}
			</AlertDescription>
			<AlertActions>
				<Button onClick={onRetry} variant="outline">
					Tentar de novo
				</Button>
			</AlertActions>
		</Alert>
	);
}
