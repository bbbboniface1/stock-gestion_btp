import { create } from "zustand";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const TOKEN_KEY = "stock_token";

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = localStorage.getItem(TOKEN_KEY);
  
  if (initialToken) {
    setAuthTokenGetter(() => initialToken);
  }

  return {
    token: initialToken,
    setToken: (token) => {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        setAuthTokenGetter(() => token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setAuthTokenGetter(() => null);
      }
      set({ token });
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      setAuthTokenGetter(() => null);
      set({ token: null });
      window.location.href = "/login";
    },
  };
});
