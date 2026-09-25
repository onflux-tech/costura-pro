export type OpIdSlot = { key: string; opId: string };

export function nextOpId(
	previous: OpIdSlot | null,
	key: string,
	create: () => string
): OpIdSlot {
	return previous?.key === key ? previous : { key, opId: create() };
}

export function opIdsByTarget(
	create: () => string
): (target: string) => (key: string) => string {
	const slots = new Map<string, OpIdSlot>();
	return (target) => (key) => {
		const slot = nextOpId(slots.get(target) ?? null, key, create);
		slots.set(target, slot);
		return slot.opId;
	};
}
