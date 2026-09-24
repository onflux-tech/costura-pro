import { highlightRanges, searchTokens } from "@costura-pro/domain/search";
import { Highlight } from "@costura-pro/ui/components/highlight";

export function Marked({ query, text }: { query: string; text: string }) {
	return (
		<Highlight
			ranges={highlightRanges(text, searchTokens(query))}
			text={text}
		/>
	);
}
