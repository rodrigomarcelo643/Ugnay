import { useAppStore } from '@/store/use-app-store';

export function useUser() {
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);

  return {
    user,
    setUser,
    isLoggedIn: !!user,
  };
}
