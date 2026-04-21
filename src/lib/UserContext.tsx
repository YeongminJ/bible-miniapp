import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loadUserData, saveUserData, type UserData } from "./userStore";

interface UserContextType {
  data: UserData | null;
  loading: boolean;
  update: (partial: Partial<UserData>) => void;
}

const UserContext = createContext<UserContextType>({
  data: null,
  loading: true,
  update: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const update = useCallback((partial: Partial<UserData>) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    saveUserData(partial);
  }, []);

  return (
    <UserContext.Provider value={{ data, loading, update }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
