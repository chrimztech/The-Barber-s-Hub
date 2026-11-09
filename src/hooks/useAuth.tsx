import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, AUTH_CHANGED_EVENT, getToken, setToken } from "@/lib/api/client";
import type { AuthResponse, AuthUser } from "@/lib/api/types";

type SignUpInput = { email: string; password: string; full_name: string; phone?: string };

type Ctx = {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (input: SignUpInput) => Promise<AuthUser>;
  /** Stores a token issued elsewhere (e.g. after a password reset). */
  acceptSession: (response: AuthResponse) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => {
    throw new Error("AuthProvider missing");
  },
  signUp: async () => {
    throw new Error("AuthProvider missing");
  },
  acceptSession: () => {},
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => {
      if (!getToken()) {
        setUser(null);
        setLoading(false);
      }
    };
    // Keep tabs in sync when the user signs in or out elsewhere.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("barbershub_")) refresh();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const acceptSession = useCallback((response: AuthResponse) => {
    setUser(response.user);
    setLoading(false);
    setToken(response.token);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await api.post<AuthResponse>("/auth/login", { email, password });
      acceptSession(response);
      return response.user;
    },
    [acceptSession],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const response = await api.post<AuthResponse>("/auth/register", input);
      acceptSession(response);
      return response.user;
    },
    [acceptSession],
  );

  const signOut = useCallback(async () => {
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: !!user?.isAdmin,
        loading,
        signIn,
        signUp,
        acceptSession,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
