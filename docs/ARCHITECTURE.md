# UGNAY Architecture & Engineering Guidelines

This document serves as the single source of truth for **AI Coding Assistants** (Antigravity, Claude, ChatGPT, Cursor, etc.) working on the UGNAY codebase. All new features, refactors, and file creations **MUST** strictly adhere to the standards outlined below.

---

## 1. Directory Blueprint & Separation of Concerns

All application source code resides under the `src/` directory.

```
UGNAY/
├── docs/                      # AI Architecture & Documentation
├── src/
│   ├── app/                   # Expo Router routes & screen layouts ONLY
│   ├── components/            # Reusable UI Components
│   │   └── ui/                # Base design system primitives (buttons, inputs, cards)
│   ├── services/              # API / Async Data fetching services
│   ├── store/                 # Zustand state management stores
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Third-party wrappers, API clients, helpers
│   ├── constants/              # App constants, design tokens, theme definitions
│   └── global.css             # Tailwind CSS directives & global resets
├── .env                       # Environment variables (ignored by git)
├── .env.example               # Template environment variables
├── tailwind.config.js         # Tailwind CSS configuration
├── metro.config.js            # Metro configuration with NativeWind
└── babel.config.js            # Babel configuration with NativeWind
```

### Module Responsibilities

| Directory | Responsibility | Rule / Standard |
| :--- | :--- | :--- |
| `src/app/` | Screen routes & layouts | Keep lightweight. Delegate UI rendering to `components` and logic to `hooks`/`store`. |
| `src/components/` | Visual UI components | Styled using NativeWind (`className="..."`). Must be modular and reusable. |
| `src/services/` | API communication | Pure TypeScript functions/classes for HTTP API requests. No React hooks inside. |
| `src/store/` | Global state management | Built with **Zustand**. Holds application-wide state (auth, settings, user data). |
| `src/hooks/` | Custom React hooks | Encapsulates React stateful logic, side effects, and connects stores to UI components. |
| `src/lib/` | Infrastructure / Utilities | Configures HTTP clients (axios/fetch), helper utilities, and third-party SDK wrappers. |
| `src/constants/` | Theme & Static configuration | Design system tokens, color maps, and fixed application constants. |

---

## 2. State Management Standard (Zustand)

- Global state **MUST** use **Zustand** stores located in `src/store/`.
- Never create ad-hoc React Contexts for global state.
- Stores should follow the `use<Name>Store` naming convention (e.g., `useAppStore`, `useAuthStore`).
- Always define clear TypeScript interfaces for state slices and action handlers.

Example Store (`src/store/use-app-store.ts`):
```typescript
import { create } from 'zustand';

interface AppState {
  user: { name: string; email: string } | null;
  isConnected: boolean;
  setUser: (user: { name: string; email: string } | null) => void;
  setConnected: (status: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isConnected: true,
  setUser: (user) => set({ user }),
  setConnected: (isConnected) => set({ isConnected }),
}));
```

---

## 3. API & Data Services Standard

- API requests must be abstracted into `src/services/` using functions or class-based service modules.
- Use `src/lib/api.ts` as the central HTTP client consuming environment variables (`process.env.EXPO_PUBLIC_API_URL`).

Example Service (`src/services/user-service.ts`):
```typescript
import { apiClient } from '@/lib/api';

export interface UserProfile {
  id: string;
  name: string;
  status: string;
}

export const UserService = {
  async fetchProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/user/profile');
  },
};
```

---

## 4. Custom Hooks Standard

- Custom hooks belong in `src/hooks/`.
- Connect UI components to services and Zustand stores through custom hooks.

Example Hook (`src/hooks/use-user.ts`):
```typescript
import { useState, useEffect } from 'react';
import { UserService, UserProfile } from '@/services/user-service';

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    UserService.fetchProfile()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
```

---

## 5. NativeWind & Styling Guidelines

- Use NativeWind Tailwind classes via `className="..."` on standard React Native components (`View`, `Text`, `Pressable`, `Image`).
- Ensure `tailwind.config.js` content array scans `./src/**/*.{js,jsx,ts,tsx}` so styles build correctly on both Web and Native.
- Do not use inline `style={{ ... }}` unless calculating dynamic pixel transforms or animated values.

---

## 6. Environment Variables (`.env`)

- All public runtime variables MUST be prefixed with `EXPO_PUBLIC_` (e.g. `EXPO_PUBLIC_API_URL`).
- Access environment variables using `process.env.EXPO_PUBLIC_<KEY>`.
- Always update `.env.example` when introducing new environment configuration keys.
