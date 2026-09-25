import { quoteLineOfText } from "@costura-pro/domain/quote";
import {
	isWorkLine,
	linePlannedMaterials,
} from "@costura-pro/domain/service-order";

import {
	completeWizard,
	newOpId,
	rpc,
	type ServerOptions,
	startTestServer,
	type TestServer,
} from "./support";

export type Owner = ReturnType<typeof rpc>;

type QuoteDetail = Awaited<ReturnType<Owner["quotes"]["get"]>>;

export type Revision = QuoteDetail["revisions"][number];

export type Snapshot = {
	fields: { fieldId: string; label: string; valueMm: number | null }[];
	measurementId: string;
	notes: string | null;
	takenOn: string;
	templateId: string;
	templateName: string;
	templateVersion: number;
};

export async function ownerSetup(
	servers: TestServer[],
	options: ServerOptions = {}
) {
	const server = await startTestServer(options);
	servers.push(server);
	const { cookie } = await completeWizard(server);
	return { owner: rpc(server, { cookie }), server };
}

export async function createClient(
	owner: Owner,
	name = "Maria Beatriz Alencar"
): Promise<string> {
	const clientId = crypto.randomUUID();
	await owner.clients.create({
		clientId,
		kind: "person",
		name,
		opId: newOpId(),
	});
	return clientId;
}

export type Stock = { crepeId: string; locationId: string; zipperId: string };

export async function createVariant(
	owner: Owner,
	material: string,
	variant: Record<string, unknown>
): Promise<string> {
	const created = await owner.materials.create({
		category: null,
		materialId: crypto.randomUUID(),
		name: material,
		notes: null,
		opId: newOpId(),
	});
	const { id } = await owner.materialVariants.create({
		materialId: created.id,
		opId: newOpId(),
		variantId: crypto.randomUUID(),
		...variant,
	} as Parameters<Owner["materialVariants"]["create"]>[0]);
	return id;
}

function opening(
	owner: Owner,
	variantId: string,
	locationId: string,
	quantityMicros: string,
	valueCents: string
) {
	return owner.stockMovements.create({
		kind: "opening",
		locationId,
		lotId: null,
		movementId: crypto.randomUUID(),
		occurredOn: "2026-09-01",
		opId: newOpId(),
		quantityMicros,
		reason: null,
		valueCents,
		variantId,
	});
}

export async function seedStock(owner: Owner): Promise<Stock> {
	const { id: locationId } = await owner.stockLocations.create({
		locationId: crypto.randomUUID(),
		name: "Armário",
		notes: null,
		opId: newOpId(),
	});
	const crepeId = await createVariant(owner, "Crepe", {
		baseUnit: "m",
		code: "CRP-PT",
		displayPrecision: 2,
		name: "Preto",
		referenceCostCents: "3000",
	});
	const zipperId = await createVariant(owner, "Zíper", {
		baseUnit: "un",
		code: null,
		displayPrecision: 0,
		name: "20 cm",
		referenceCostCents: "370",
	});
	await opening(owner, crepeId, locationId, "2500000", "7500");
	await opening(owner, zipperId, locationId, "5000000", "1850");
	return { crepeId, locationId, zipperId };
}

async function templateNamed(owner: Owner, name: string) {
	const { items } = await owner.measurementTemplates.list({});
	const found = items.find((item) => item.name === name);
	if (!found) {
		throw new Error(`Modelo ${name} ausente`);
	}
	return found;
}

export async function recordMeasurement(
	owner: Owner,
	profileId: string,
	templateName: string,
	takenOn: string,
	valueMm: number
): Promise<string> {
	const template = await templateNamed(owner, templateName);
	const measurementId = crypto.randomUUID();
	await owner.measurements.create({
		fields: template.fields
			.filter((field) => field.active)
			.map((field, index) => ({
				fieldId: field.id,
				label: field.label,
				valueMm: index === 0 ? valueMm : null,
			})),
		measurementId,
		notes: null,
		opId: newOpId(),
		profileId,
		takenOn,
		templateId: template.id,
		templateName: template.name,
		templateVersion: template.version,
	});
	return measurementId;
}

export async function createProfile(
	owner: Owner,
	clientId: string,
	name: string
): Promise<string> {
	const profileId = crypto.randomUUID();
	await owner.profiles.create({ clientId, name, opId: newOpId(), profileId });
	return profileId;
}

export type Person = { profileId: string; receivedItemId: string };

export async function seedPerson(
	owner: Owner,
	clientId: string
): Promise<Person> {
	const profileId = await createProfile(owner, clientId, "Maria");
	await recordMeasurement(owner, profileId, "Vestido", "2026-09-01", 880);
	await recordMeasurement(
		owner,
		profileId,
		"Blazer e paletó",
		"2026-09-10",
		400
	);
	const received = await owner.receivedItems.create({
		accessories: null,
		clientId,
		condition: "good",
		description: "Blazer de linho",
		expectedReturnOn: null,
		notes: null,
		opId: newOpId(),
		photos: [],
		quantity: 1,
		receivedItemId: crypto.randomUUID(),
		receivedOn: "2026-09-15",
	});
	return { profileId, receivedItemId: received.id };
}

export function serviceLine(
	person: Person,
	{ serviceId = crypto.randomUUID() }: { serviceId?: string } = {}
) {
	return {
		catalogPriceCents: "16000",
		discount: null,
		estimatedMinutes: 90,
		id: crypto.randomUUID(),
		kind: "service" as const,
		note: null,
		outsourced: false,
		profileId: person.profileId,
		quantity: 1,
		receivedItemId: person.receivedItemId,
		serviceId,
		serviceName: "Ajuste de cava",
		serviceVersion: 1,
		unitCostCents: "6000",
		unitPriceCents: "16000",
	};
}

function crepeComponent(stock: Stock, quantityMicros: string) {
	return {
		baseUnit: "m" as const,
		code: "CRP-PT",
		displayPrecision: 2,
		id: crypto.randomUUID(),
		kind: "material" as const,
		materialName: "Crepe",
		materialVariantId: stock.crepeId,
		quantityMicros,
		unitCostCents: "3000",
		variantName: "Preto",
	};
}

function serviceComponent(serviceId: string) {
	return {
		count: 1,
		estimatedMinutes: 600,
		id: crypto.randomUUID(),
		kind: "service" as const,
		outsourced: false,
		serviceId,
		serviceName: "Costura sob medida",
		serviceVersion: 1,
		unitCostCents: "30000",
	};
}

export function pieceLine(
	stock: Stock,
	profileId: string | null,
	{ serviceIds = [crypto.randomUUID()] }: { serviceIds?: string[] } = {}
) {
	return {
		components: [
			crepeComponent(stock, "3400000"),
			{
				baseUnit: "un" as const,
				code: null,
				displayPrecision: 0,
				id: crypto.randomUUID(),
				kind: "material" as const,
				materialName: "Zíper",
				materialVariantId: stock.zipperId,
				quantityMicros: "1000000",
				unitCostCents: "370",
				variantName: "20 cm",
			},
			...serviceIds.map(serviceComponent),
		],
		description: "Vestido de festa",
		discount: null,
		id: crypto.randomUUID(),
		kind: "custom" as const,
		note: null,
		profileId,
		quantity: 1,
		source: null,
		unitPriceCents: "98000",
	};
}

export function materialLine(
	variantId: string,
	quantityMicros: string,
	names = { materialName: "Zíper", variantName: "20 cm" }
) {
	return {
		baseUnit: "un" as const,
		code: null,
		discount: null,
		displayPrecision: 0,
		id: crypto.randomUUID(),
		kind: "material" as const,
		...names,
		materialVariantId: variantId,
		note: null,
		quantityMicros,
		unitCostCents: "370",
		unitPriceCents: "800",
	};
}

type Emission = {
	discount?: { amountCents: string; kind: "amount"; reason: null } | null;
	emittedOn?: string;
	validityDays?: number;
};

export async function emittedQuote(
	owner: Owner,
	clientId: string,
	lines: unknown[],
	{
		discount = null,
		emittedOn = "2026-09-20",
		validityDays = 15,
	}: Emission = {}
): Promise<{ quoteId: string; revision: Revision }> {
	const quoteId = crypto.randomUUID();
	const content = {
		discount,
		leadTimeDays: 20,
		lines,
		notes: null,
		validityDays,
	} as Parameters<Owner["quotes"]["emit"]>[0]["content"];
	await owner.quotes.create({
		...content,
		clientId,
		createdOn: emittedOn,
		opId: newOpId(),
		quoteId,
	});
	await owner.quotes.emit({
		content,
		emittedOn,
		opId: newOpId(),
		quoteId,
		reason: null,
		revisionId: crypto.randomUUID(),
	});
	const [revision] = (await owner.quotes.get({ quoteId })).revisions;
	if (!revision) {
		throw new Error("Revisão ausente");
	}
	return { quoteId, revision };
}

export function approvalInput(
	revision: Revision,
	snapshots: ReadonlyMap<string, Snapshot[]>,
	overrides: Record<string, unknown> = {}
) {
	const work = revision.content.lines.filter(isWorkLine);
	return {
		approvalId: crypto.randomUUID(),
		approvedOn: "2026-09-22",
		channel: "whatsapp" as const,
		dueOn: "2026-10-12",
		items: work.map((line) => {
			const profileId = line.kind === "material" ? null : line.profileId;
			return {
				itemId: crypto.randomUUID(),
				lineId: line.id,
				measurements:
					profileId === null ? [] : (snapshots.get(profileId) ?? []),
				reservations: linePlannedMaterials(quoteLineOfText(line)).map(
					(material) => ({
						reservationId: crypto.randomUUID(),
						variantId: material.variantId,
					})
				),
			};
		}),
		note: " Aceitou por áudio ",
		opId: newOpId(),
		quoteId: revision.quoteId,
		receivableId: crypto.randomUUID(),
		revisionId: revision.id,
		serviceOrderId: crypto.randomUUID(),
		...overrides,
	} as Parameters<Owner["quotes"]["approve"]>[0];
}

export async function approvedQuote(
	owner: Owner,
	clientId: string,
	lines: unknown[],
	overrides: Record<string, unknown> = {}
) {
	const { revision } = await emittedQuote(owner, clientId, lines);
	const input = approvalInput(revision, new Map(), overrides);
	await owner.quotes.approve(input);
	return input;
}

type ItemRow = {
	due_on: string | null;
	id: string;
	kind: string;
	line: string;
	measurements: string;
	position: number;
};

export function itemsOf(server: TestServer, serviceOrderId: string) {
	return server
		.native()
		.query<ItemRow, [string]>(
			"SELECT id, kind, position, due_on, line, measurements FROM service_order_item WHERE service_order_id = ? ORDER BY position"
		)
		.all(serviceOrderId)
		.map((row) => ({
			dueOn: row.due_on,
			id: row.id,
			kind: row.kind,
			line: JSON.parse(row.line),
			measurements: JSON.parse(row.measurements) as Snapshot[],
			position: row.position,
		}));
}
