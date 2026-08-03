import { create } from "zustand";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { UserRole } from "./permissions";
import { appPath } from "./paths";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser, rememberMe?: boolean) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

const TOKEN_KEY = "stock_token";
const USER_KEY = "stock_user";

function loadStoredUser(): AuthUser | null {
  try {
    const raw =
      localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken =
    localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  const initialUser = loadStoredUser();

  if (initialToken) {
    setAuthTokenGetter(() => initialToken);
  }

  return {
    token: initialToken,
    user: initialUser,
    setAuth: (token, user, rememberMe = true) => {
      const storage = rememberMe ? localStorage : sessionStorage;
      // Clear from the other storage in case of a previous session with different preference
      if (rememberMe) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
      storage.setItem(TOKEN_KEY, token);
      storage.setItem(USER_KEY, JSON.stringify(user));
      setAuthTokenGetter(() => token);
      set({ token, user });
    },
    setUser: (user) => {
      // Update whichever storage currently holds the user
      if (localStorage.getItem(USER_KEY)) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      set({ user });
    },
    logout: async () => {
      const token =
        localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          await fetch(appPath("/api/auth/logout"), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Clear local session even if revoke request fails
        }
      }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      setAuthTokenGetter(() => null);
      set({ token: null, user: null });
      window.location.href = appPath("/login");
    },
  };
});
