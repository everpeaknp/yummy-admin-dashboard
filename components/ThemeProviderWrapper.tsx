"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { ReactNode } from "react";

export function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
