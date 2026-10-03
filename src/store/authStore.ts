import { create } from 'zustand';
import { UserRole } from '@/types/incident';

interface AuthState {
  role: UserRole;
  userName: string;
  isAvailable: boolean;
  setRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
  toggleAvailability: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: 'CALLER',
  userName: 'Marcelo Response',
  isAvailable: true,
  setRole: (role) => set({ role }),
  setUserName: (userName) => set({ userName }),
  toggleAvailability: () => set((state) => ({ isAvailable: !state.isAvailable })),
}));
