import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@costura-pro/ui/components/dropdown-menu";
import { TopNavAvatar } from "@costura-pro/ui/components/top-nav";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/initials";
import { sessionQuery } from "@/lib/session";

export function AccountMenu() {
	const { data: session } = useQuery(sessionQuery);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const username = session?.user.username ?? session?.user.name ?? "";

	const signOut = async () => {
		const result = await authClient.signOut().catch(() => null);
		if (!result || result.error) {
			toast.error("Não foi possível sair. Tente de novo.");
			return;
		}
		queryClient.removeQueries({ queryKey: sessionQuery.queryKey });
		await navigate({ to: "/login" });
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<TopNavAvatar
						aria-label={`Conta de ${username}`}
						initials={initials(username)}
					/>
				}
			/>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{username}</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={signOut} variant="destructive">
					Sair
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
