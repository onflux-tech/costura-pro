const formatter = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeStyle: "short",
	timeZone: "America/Recife",
});

export function formatDateTime(date: Date): string {
	return formatter.format(date);
}
