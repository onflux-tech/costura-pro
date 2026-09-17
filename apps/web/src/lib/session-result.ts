export function sessionFromResult<T>({
	data,
	error,
}: {
	data: T | null;
	error: unknown;
}): T | null {
	if (error) {
		throw new Error("Sessão indisponível");
	}
	return data;
}
