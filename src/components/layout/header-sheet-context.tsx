"use client";

import * as React from "react";

export type HeaderSheet = "menu" | "notifications";

type HeaderSheetContextValue = {
  activeSheet: HeaderSheet | null;
  setSheetOpen: (sheet: HeaderSheet, open: boolean) => void;
};

const HeaderSheetContext = React.createContext<HeaderSheetContextValue | null>(
  null,
);

export function HeaderSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeSheet, setActiveSheet] = React.useState<HeaderSheet | null>(
    null,
  );

  const setSheetOpen = React.useCallback(
    (sheet: HeaderSheet, open: boolean) => {
      setActiveSheet(open ? sheet : null);
    },
    [],
  );

  const value = React.useMemo(
    () => ({ activeSheet, setSheetOpen }),
    [activeSheet, setSheetOpen],
  );

  return (
    <HeaderSheetContext.Provider value={value}>
      {children}
    </HeaderSheetContext.Provider>
  );
}

export function useHeaderSheet() {
  const context = React.useContext(HeaderSheetContext);
  if (!context) {
    throw new Error("useHeaderSheet must be used within HeaderSheetProvider");
  }
  return context;
}
