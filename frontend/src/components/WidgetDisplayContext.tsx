import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { WidgetStyle } from "../types";

const WidgetDisplayContext = createContext<WidgetStyle>("cards");

export function WidgetDisplayProvider({ children, style }: { children: ReactNode; style: WidgetStyle }) {
  return <WidgetDisplayContext.Provider value={style}>{children}</WidgetDisplayContext.Provider>;
}

export function useWidgetDisplay() {
  return useContext(WidgetDisplayContext);
}
