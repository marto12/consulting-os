import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface UserContextValue {
  users: User[];
  activeUser: User | null;
  setActiveUserId: (id: number | null) => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    refetchInterval: 10000,
  });

  const activeUser = useMemo(() => {
    if (activeId === null && users.length > 0) return users[0];
    return users.find((u) => u.id === activeId) || null;
  }, [activeId, users]);

  const value = useMemo(
    () => ({
      users,
      activeUser,
      setActiveUserId: setActiveId,
      isLoading,
    }),
    [users, activeUser, isLoading]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within UserProvider");
  return ctx;
}
