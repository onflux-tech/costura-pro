import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

export default function NotFound() {
	return (
		<main className="mx-auto flex w-full max-w-md flex-col items-start gap-3 px-4 py-16">
			<Heading>Página não encontrada</Heading>
			<Text tone="muted">
				O endereço não existe ou ainda não faz parte do Costura Pro.
			</Text>
			<ButtonLink render={<Link to="/" />} variant="outline">
				Voltar ao início
			</ButtonLink>
		</main>
	);
}
