"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, getToken, setToken } from "./api-client";
import type { AuthSession, Profile, PublicBusiness, PublicUser } from "./types";

interface AuthContextValue {
  user: PublicUser | null;
  business: PublicBusiness | null;
  status: "loading" | "authenticated" | "anonymous";
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signUp: (input: {
    fullName: string;
    email: string;
    password: string;
    businessName?: string;
  }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  useEffect(() => {
    const controller = new AbortController();

    const restoreSession = async () => {
      if (!getToken()) {
        setStatus("anonymous");
        return;
      }

      try {
        setProfile(await api.profile(controller.signal));
        setStatus("authenticated");
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) return;
        setToken(null);
        setStatus("anonymous");
      }
    };

    void restoreSession();

    return () => controller.abort();
  }, []);

  const applySession = useCallback(
    (session: AuthSession) => {
      setToken(session.token);
      setProfile({ user: session.user, business: session.business });
      setStatus("authenticated");
      router.push("/dashboard");
    },
    [router],
  );

  const signIn = useCallback(
    async (credentials: { email: string; password: string }) => {
      applySession(await api.login(credentials));
    },
    [applySession],
  );

  const signUp = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      businessName?: string;
    }) => {
      applySession(await api.signup(input));
    },
    [applySession],
  );

  const signOut = useCallback(() => {
    setToken(null);
    setProfile(null);
    setStatus("anonymous");
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: profile?.user ?? null,
      business: profile?.business ?? null,
      status,
      signIn,
      signUp,
      signOut,
    }),
    [profile, status, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
