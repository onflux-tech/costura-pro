import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "@/production/board-page";
import { boardSearch } from "@/production/board-search";

export const Route = createFileRoute("/_app/producao/quadro")({
	component: BoardPage,
	validateSearch: boardSearch,
});
