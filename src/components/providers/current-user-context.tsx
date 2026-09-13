"use client";

import { createContext, useContext } from "react";

type CurrentUserValue = {
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
};

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

export function CurrentUserProvider({
  value,
  children,
}: {
  value: CurrentUserValue;
  children: React.ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
