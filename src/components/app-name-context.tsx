"use client";

import { createContext, useContext } from "react";

const AppNameContext = createContext<string>("Orus Bakery");

/** Makes the configured business / app name available to client components. */
export function AppNameProvider({ value, children }: { value: string; children: React.ReactNode }) {
  return <AppNameContext.Provider value={value}>{children}</AppNameContext.Provider>;
}

/** The current business / app name (e.g. "Alpha Bakery"). */
export function useAppName(): string {
  return useContext(AppNameContext);
}
