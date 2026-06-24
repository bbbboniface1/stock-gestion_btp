import { create } from "zustand";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { UserRole } from "./permissions";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

const TOKEN_KEY = "stock_token";
const USER_KEY = "stock_user";

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = localStorage.getItem(TOKEN_KEY);
  const initialUser = loadStoredUser();

  if (initialToken) {
    setAuthTokenGetter(() => initialToken);
  }

  return {
    token: initialToken,
    user: initialUser,
    setAuth: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setAuthTokenGetter(() => token);
      set({ token, user });
    },
    setUser: (user) => {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user });
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setAuthTokenGetter(() => null);
      set({ token: null, user: null });
      window.location.href = "/login";
    },
  };
});
