import { BrandHeader } from "@costura-pro/ui/components/brand-header";
import { createFileRoute, redirect } from "@tanstack/react-router";

import SignInForm from "@/components/sign-in-form";
import { loginGate, safeRedirect } from "@/lib/installation-gates";
import { readGate } from "@/lib/installation-queries";

export const Route = createFileRoute("/login")({
	beforeLoad: async ({ context, search }) => {
		const decision = loginGate(await readGate(context.queryClient));
		if (decision?.to === "redirect") {
			throw redirect({ href: safeRedirect(search.redirect) });
		}
		if (decision) {
			throw redirect({ to: decision.to });
		}
	},
	component: LoginPage,
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
});

function LoginPage() {
	const { redirect: target } = Route.useSearch();
	return (
		<div className="flex min-h-svh flex-col bg-background">
			<BrandHeader />
			<SignInForm redirectTo={safeRedirect(target)} />
		</div>
	);
}
