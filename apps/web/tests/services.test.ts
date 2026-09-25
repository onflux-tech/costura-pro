import { describe, expect, test } from "bun:test";
import { pricingPreview } from "../src/lib/pricing";
import {
	emptyServiceValues,
	formPricing,
	formPricingHint,
	type ServiceFormValues,
	type ServiceView,
	sameServiceValues,
	serviceFields,
	serviceFormErrors,
	serviceFormValues,
	servicePatch,
	servicePriceFacts,
	targetMarginFields,
} from "../src/lib/services";

const fitting = "c0000000-0000-4000-8000-000000000003";
const finishing = "c0000000-0000-4000-8000-000000000004";

const service: ServiceView = {
	archivedAt: null,
	category: "Barra",
	costCents: "6000",
	createdAt: "2026-09-18T12:00:00.000Z",
	estimatedMinutes: 30,
	id: "11111111-1111-4111-8111-111111111111",
	name: "Barra de calça",
	notes: null,
	outsourced: false,
	priceCents: "10000",
	suggestedStageIds: [fitting, finishing],
	targetMarginBasisPoints: 3750,
	version: 2,
};

const values = (overrides: Partial<ServiceFormValues> = {}) => ({
	...serviceFormValues(service),
	...overrides,
});

describe("formulário de serviço", () => {
	test("lê o serviço e grava de volta os mesmos campos", () => {
		expect(serviceFormValues(service)).toEqual({
			category: "Barra",
			cost: "60,00",
			estimatedMinutes: "30",
			kind: "own",
			name: "Barra de calça",
			notes: "",
			price: "100,00",
			suggestedStageIds: [fitting, finishing],
			targetMargin: "37,5",
		});
		expect(serviceFields(values())).toEqual({
			category: "Barra",
			costCents: "6000",
			estimatedMinutes: 30,
			name: "Barra de calça",
			notes: null,
			outsourced: false,
			priceCents: "10000",
			suggestedStageIds: [fitting, finishing],
			targetMarginBasisPoints: 3750,
		});
	});

	test("texto vazio vira nulo e terceirizado vira a marca", () => {
		expect(
			serviceFields({
				...emptyServiceValues,
				cost: "80",
				kind: "outsourced",
				name: " Bordado ",
				price: "150,5",
			})
		).toEqual({
			category: null,
			costCents: "8000",
			estimatedMinutes: null,
			name: "Bordado",
			notes: null,
			outsourced: true,
			priceCents: "15050",
			suggestedStageIds: [],
			targetMarginBasisPoints: null,
		});
	});

	test("aponta cada campo inválido", () => {
		expect(serviceFormErrors(emptyServiceValues)).toEqual({
			cost: "Informe o custo",
			name: "Informe o nome do serviço",
			price: "Informe o preço praticado",
		});
		expect(
			serviceFormErrors(
				values({
					cost: "12,505",
					estimatedMinutes: "1,5",
					price: "-3",
					targetMargin: "100",
				})
			)
		).toEqual({
			cost: "Use valor com até 2 casas",
			estimatedMinutes: "Use minutos inteiros de 1 a 9999",
			price: "Use valor com até 2 casas",
			targetMargin: "Use de 0 a 99,99%",
		});
		expect(serviceFormErrors(values({ estimatedMinutes: "0" }))).toEqual({
			estimatedMinutes: "Use minutos inteiros de 1 a 9999",
		});
		expect(serviceFormErrors(values())).toEqual({});
	});

	test("aceita até 50 etapas sugeridas", () => {
		const stageIds = (count: number) =>
			Array.from(
				{ length: count },
				(_, index) =>
					`c0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
			);
		expect(
			serviceFormErrors(values({ suggestedStageIds: stageIds(51) }))
		).toEqual({ suggestedStageIds: "Até 50 etapas sugeridas." });
		expect(
			serviceFormErrors(values({ suggestedStageIds: stageIds(50) }))
		).toEqual({});
	});

	test("o patch leva só o que mudou", () => {
		expect(servicePatch(service, serviceFields(values()))).toBeNull();
		expect(
			servicePatch(
				service,
				serviceFields(values({ category: "", price: "120", targetMargin: "" }))
			)
		).toEqual({
			category: null,
			priceCents: "12000",
			targetMarginBasisPoints: null,
		});
	});

	test("o patch leva as etapas sugeridas só quando a escolha muda", () => {
		expect(
			servicePatch(
				service,
				serviceFields(values({ suggestedStageIds: [finishing, fitting] }))
			)
		).toBeNull();
		expect(
			servicePatch(
				service,
				serviceFields(values({ suggestedStageIds: [finishing] }))
			)
		).toEqual({ suggestedStageIds: [finishing] });
		expect(
			servicePatch(service, serviceFields(values({ suggestedStageIds: [] })))
		).toEqual({ suggestedStageIds: [] });
	});

	test("o formulário fica sujo quando a escolha de etapas muda", () => {
		expect(sameServiceValues(values(), values())).toBe(true);
		expect(
			sameServiceValues(
				values({ suggestedStageIds: [finishing, fitting] }),
				values()
			)
		).toBe(true);
		expect(
			sameServiceValues(values({ suggestedStageIds: [finishing] }), values())
		).toBe(false);
		expect(
			sameServiceValues(
				values({ suggestedStageIds: [finishing, fitting, finishing] }),
				values({ suggestedStageIds: [finishing, fitting] })
			)
		).toBe(false);
		expect(sameServiceValues(values({ name: "Barra" }), values())).toBe(false);
	});
});

describe("edição completa e meta do diálogo", () => {
	test("o patch leva os nove campos quando todos mudam", () => {
		expect(
			servicePatch(
				service,
				serviceFields(
					values({
						category: "Ajuste",
						cost: "70",
						estimatedMinutes: "45",
						kind: "outsourced",
						name: "Barra italiana",
						notes: "Com overloque",
						price: "120",
						suggestedStageIds: [fitting],
						targetMargin: "",
					})
				)
			)
		).toEqual({
			category: "Ajuste",
			costCents: "7000",
			estimatedMinutes: 45,
			name: "Barra italiana",
			notes: "Com overloque",
			outsourced: true,
			priceCents: "12000",
			suggestedStageIds: [fitting],
			targetMarginBasisPoints: null,
		});
	});

	test("a meta digitada no diálogo vira pontos-base", () => {
		expect(targetMarginFields("40")).toEqual({ targetMarginBasisPoints: 4000 });
		expect(targetMarginFields(" 37,5 ")).toEqual({
			targetMarginBasisPoints: 3750,
		});
		expect(targetMarginFields("")).toBeNull();
		expect(targetMarginFields("100")).toBeNull();
	});
});

describe("preço sugerido na tela", () => {
	test("a meta própria vence a do ateliê", () => {
		expect(pricingPreview(service, 4000)).toEqual({
			ownTarget: true,
			pricing: {
				belowCost: false,
				belowTarget: false,
				marginBasisPoints: 4000,
				suggestedCents: 9600n,
			},
			suggestedCents: 9600n,
			targetMarginBasisPoints: 3750,
		});
	});

	test("sem meta própria usa a do ateliê", () => {
		const view = pricingPreview(
			{ ...service, targetMarginBasisPoints: null },
			5000
		);
		expect(view).toMatchObject({
			ownTarget: false,
			suggestedCents: 12_000n,
			targetMarginBasisPoints: 5000,
		});
		expect(view.pricing?.belowTarget).toBe(true);
	});

	test("a prévia do formulário usa a meta própria válida", () => {
		expect(formPricing(values(), 4000)).toMatchObject({
			ownTarget: true,
			suggestedCents: 9600n,
			targetMarginBasisPoints: 3750,
		});
	});

	test("sem prévia, a dica diz o que falta", () => {
		expect(formPricingHint(values({ cost: "" }))).toBe(
			"Informe o custo para ver o preço sugerido."
		);
		expect(formPricingHint(values({ cost: "12,505" }))).toBe(
			"Informe o custo para ver o preço sugerido."
		);
		expect(formPricingHint(values({ targetMargin: "100" }))).toBe(
			"Corrija a meta própria, de 0 a 99,99%, para ver o preço sugerido."
		);
	});

	test("a margem e o aviso de custo da lista não dependem da meta", () => {
		expect(servicePriceFacts({ ...service, priceCents: "5000" })).toEqual({
			belowCost: true,
			marginBasisPoints: -2000,
		});
		expect(servicePriceFacts({ ...service, priceCents: "0" })).toEqual({
			belowCost: true,
			marginBasisPoints: null,
		});
	});

	test("a prévia do formulário espera o custo e aceita preço vazio", () => {
		expect(formPricing(values({ cost: "" }), 4000)).toBeNull();
		expect(formPricing(values({ targetMargin: "abc" }), 4000)).toBeNull();
		expect(formPricing(values({ price: "", targetMargin: "" }), 4000)).toEqual({
			ownTarget: false,
			pricing: null,
			suggestedCents: 10_000n,
			targetMarginBasisPoints: 4000,
		});
	});
});
