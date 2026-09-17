import { formatDateTime } from "./format-date-time";

export const recoveryCodesFileName = "costura-pro-codigos-de-recuperacao.txt";

export function recoveryCodesFile({
	atelierName,
	codes,
	generatedAt,
}: {
	atelierName: string | null;
	codes: readonly string[];
	generatedAt: Date;
}): string {
	return [
		"Costura Pro: códigos de recuperação",
		...(atelierName ? [`Ateliê: ${atelierName}`] : []),
		`Gerados em ${formatDateTime(generatedAt)}`,
		"",
		...codes.map(
			(code, index) => `${String(index + 1).padStart(2, " ")}. ${code}`
		),
		"",
		"Cada código vale uma vez e redefine a senha do dono no PC do ateliê.",
		"Guarde este arquivo fora do PC, num lugar que só você acessa.",
		"Gerar novos códigos invalida todos estes.",
		"",
	].join("\n");
}
