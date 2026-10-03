import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
}

interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  setUser: (user: User | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: {
    id: '1',
    name: 'UGNAY User',
    email: 'user@ugnay.app',
  },
  theme: 'dark',
  setUser: (user) => set({ user }),
  setTheme: (theme) => set({ theme }),
}));
