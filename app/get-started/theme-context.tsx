"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { useClientValue } from "@/hooks/use-client-value";

type OnboardingTheme = "light" | "dark";

interface OnboardingThemeContextValue {
  theme: OnboardingTheme;
  toggleTheme: () => void;
}

const OnboardingThemeContext =
  createContext<OnboardingThemeContextValue | null>(null);

const STORAGE_KEY = "ap-onboarding-theme";

function readStoredTheme(): OnboardingTheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // no-op
  }
  return "light";
}

export function OnboardingThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // The saved choice only exists in the browser: "light" on the server and
  // during hydration, then whatever is in localStorage.
  const storedTheme = useClientValue(
    readStoredTheme,
    "light",
  ) as OnboardingTheme;
  // Set once the user toggles in this session; wins over the stored value.
  const [chosenTheme, setChosenTheme] = useState<OnboardingTheme | null>(null);
  const theme = chosenTheme ?? storedTheme;

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        const next = theme === "light" ? "dark" : "light";
        setChosenTheme(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // no-op
        }
      },
    }),
    [theme],
  );

  return (
    <OnboardingThemeContext.Provider value={value}>
      {children}
    </OnboardingThemeContext.Provider>
  );
}

export function useOnboardingTheme() {
  const context = useContext(OnboardingThemeContext);
  return (
    context ?? {
      theme: "light",
      toggleTheme: () => {},
    }
  );
}
