const inFlight = new Map<string, Promise<unknown>>();

export function withMediaLock<T>(
	hash: string,
	run: () => Promise<T>
): Promise<T> {
	const previous = inFlight.get(hash) ?? Promise.resolve();
	const current = previous.catch(() => undefined).then(run);
	inFlight.set(hash, current);
	return current.finally(() => {
		if (inFlight.get(hash) === current) {
			inFlight.delete(hash);
		}
	});
}
