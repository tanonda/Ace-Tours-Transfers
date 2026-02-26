import { createContext, useContext } from "react";

interface LayoutContextValue {
    insideShell: boolean;
}

export const LayoutContext = createContext<LayoutContextValue>({
    insideShell: false,
});

export function useLayoutContext() {
    return useContext(LayoutContext);
}
