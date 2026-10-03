import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, UserProfile } from '@/types/incident';
import { AIService } from '@/services/ai';
import { supabase } from '@/services/supabase';

export type ExtendedRole = UserRole | 'PUBLIC';

interface AuthContextType {
  user: UserProfile | null;
  role: ExtendedRole;
  isLoggedIn: boolean;
  isLoading: boolean;
  isAvailable: boolean;
  hasCompletedOnboarding: boolean;
  setRole: (role: UserRole) => void;
  login: (name: string, role: UserRole, customProfile?: UserProfile) => void;
  logout: () => void;
  toggleAvailability: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  triggerAIVoiceGreeting: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<ExtendedRole>('PUBLIC');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Restore active user session from browser sessionStorage on page refresh
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem('ugnay_active_user');
        if (stored) {
          const parsed: UserProfile = JSON.parse(stored);
          if (parsed && parsed.role) {
            setUser(parsed);
            setRoleState(parsed.role as ExtendedRole);
            setHasCompletedOnboarding(true);
          }
        }
      } catch (e) {}
    }

    // 2. Also check Supabase Auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const roleFromMeta = (session.user.user_metadata?.role as UserRole) || 'CALLER';
        const nameFromMeta = session.user.user_metadata?.full_name || 'Citizen User';
        const sessionUser: UserProfile = {
          id: session.user.id,
          name: nameFromMeta,
          role: roleFromMeta,
          availability: 'AVAILABLE',
        };
        setUser(sessionUser);
        setRoleState(roleFromMeta);
        setHasCompletedOnboarding(true);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const roleFromMeta = (session.user.user_metadata?.role as UserRole) || 'CALLER';
        const nameFromMeta = session.user.user_metadata?.full_name || 'Citizen User';
        setUser({
          id: session.user.id,
          name: nameFromMeta,
          role: roleFromMeta,
          availability: 'AVAILABLE',
        });
        setRoleState(roleFromMeta);
        setHasCompletedOnboarding(true);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const triggerAIVoiceGreeting = () => {
    AIService.speakGreeting('How can I help?');
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  const login = (name: string, newRole: UserRole, customProfile?: UserProfile) => {
    const newUser: UserProfile = customProfile || {
      id: `user-${Date.now()}`,
      name: name || (newRole === 'CALLER' ? 'Citizen User' : 'Marcelo Responder'),
      role: newRole,
      availability: 'AVAILABLE',
    };
    setUser(newUser);
    setRoleState(newRole);
    setHasCompletedOnboarding(true);

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('ugnay_active_user', JSON.stringify(newUser));
      } catch (e) {}
    }

    // Speak AI Voice greeting "How can I help?" upon login
    setTimeout(() => {
      AIService.speakGreeting('How can I help?');
    }, 400);
  };

  const logout = () => {
    setUser(null);
    setRoleState('PUBLIC');
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem('ugnay_active_user');
      } catch (e) {}
    }
    supabase.auth.signOut().catch(() => {});
  };

  const toggleAvailability = () => {
    const nextAvailability = !isAvailable;
    setIsAvailable(nextAvailability);
    if (user) {
      const updatedUser: UserProfile = {
        ...user,
        availability: nextAvailability ? 'AVAILABLE' : 'BUSY',
      };
      setUser(updatedUser);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.setItem('ugnay_active_user', JSON.stringify(updatedUser));
        } catch (e) {}
      }
    }
  };

  const completeOnboarding = () => {
    setHasCompletedOnboarding(true);
  };

  const resetOnboarding = () => {
    setHasCompletedOnboarding(false);
    logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoggedIn: !!user && role !== 'PUBLIC',
        isLoading,
        isAvailable,
        hasCompletedOnboarding,
        setRole,
        login,
        logout,
        toggleAvailability,
        completeOnboarding,
        resetOnboarding,
        triggerAIVoiceGreeting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
