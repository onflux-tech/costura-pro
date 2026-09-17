import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type PageHeader = {
	backHref?: string;
	eyebrow?: string;
	heading: string;
};

type PageHeaderStore = {
	header: PageHeader | null;
	setHeader: (header: PageHeader | null) => void;
};

const PageHeaderContext = createContext<PageHeaderStore>({
	header: null,
	setHeader: () => undefined,
});

export function PageHeaderProvider({ children }: { children: ReactNode }) {
	const [header, setHeader] = useState<PageHeader | null>(null);
	const value = useMemo(() => ({ header, setHeader }), [header]);
	return <PageHeaderContext value={value}>{children}</PageHeaderContext>;
}

export function usePageHeaderState(): PageHeader | null {
	return useContext(PageHeaderContext).header;
}

export function usePageHeader({ backHref, eyebrow, heading }: PageHeader) {
	const { setHeader } = useContext(PageHeaderContext);
	useEffect(() => {
		setHeader({ backHref, eyebrow, heading });
		return () => setHeader(null);
	}, [backHref, eyebrow, heading, setHeader]);
}
