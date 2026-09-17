import { ORPCError } from "@orpc/client";

const messages: Partial<Record<string, string>> = {
	CONFLICT: "A instalação mudou. Confira e envie de novo.",
	FORBIDDEN: "Disponível só no acesso local do PC.",
	PRECONDITION_FAILED:
		"A configuração avançou em outra janela. A tela foi atualizada.",
	UNAUTHORIZED: "Sua sessão terminou. Entre de novo.",
};

export function sessionEnded(error: unknown): boolean {
	return error instanceof ORPCError && error.code === "UNAUTHORIZED";
}

function hasIssues(data: unknown) {
	return typeof data === "object" && data !== null && "issues" in data;
}

export function commandErrorMessage(error: unknown): string {
	if (!(error instanceof ORPCError)) {
		return "Não foi possível falar com o servidor. Tente de novo.";
	}
	if (error.code === "BAD_REQUEST") {
		return hasIssues(error.data)
			? "Confira os campos e tente de novo."
			: error.message;
	}
	return messages[error.code] ?? "Não foi possível concluir. Tente de novo.";
}
