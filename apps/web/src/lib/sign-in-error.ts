const messages: Partial<Record<number, string>> = {
	401: "Usuário ou senha inválidos",
	422: "Usuário ou senha inválidos",
	429: "Muitas tentativas. Tente de novo mais tarde.",
};

export function signInErrorMessage(status: number): string {
	return messages[status] ?? "Não foi possível entrar agora. Tente de novo.";
}
