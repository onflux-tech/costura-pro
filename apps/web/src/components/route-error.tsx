import { BrandHeader } from "@costura-pro/ui/components/brand-header";
import { Button } from "@costura-pro/ui/components/button";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";

export default function RouteError({ reset }: ErrorComponentProps) {
	const router = useRouter();
	return (
		<div className="flex min-h-svh flex-col bg-background">
			<BrandHeader />
			<main className="mx-auto flex w-full max-w-md flex-col items-start gap-3 px-4 py-16">
				<Heading>Não foi possível abrir esta tela</Heading>
				<Text tone="subtle">
					Confira se o servidor do Costura Pro está rodando no PC e tente de
					novo.
				</Text>
				<Button
					onClick={() => {
						reset();
						router.invalidate();
					}}
				>
					Tentar de novo
				</Button>
			</main>
		</div>
	);
}
