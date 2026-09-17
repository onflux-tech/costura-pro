import type { LinkTarget } from "@costura-pro/ui/lib/navigation";
import type * as React from "react";

type LinkRenderer = (
	target: LinkTarget,
	props: React.ComponentProps<"a">
) => React.ReactElement;

const renderAnchor: LinkRenderer = (target, props) => (
	<a href={target.href} {...props} />
);

export { type LinkRenderer, renderAnchor };
