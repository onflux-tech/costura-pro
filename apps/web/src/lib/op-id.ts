export type OpIdSlot = { key: string; opId: string };

export function nextOpId(
	previous: OpIdSlot | null,
	key: string,
	create: () => string
): OpIdSlot {
	return previous?.key === key ? previous : { key, opId: create() };
}
