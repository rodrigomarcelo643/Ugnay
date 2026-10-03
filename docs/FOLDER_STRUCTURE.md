# Project Folder Structure Reference

This document maps out the folder organization for the UGNAY application.

## Directory Map

```
c:/Users/admin/Ugnay/UGNAY/
├── docs/                      # Architectural & AI Documentation
│   ├── ARCHITECTURE.md        # Core rules for AI coding assistants
│   └── FOLDER_STRUCTURE.md    # Folder layout reference
├── src/                       # Application Source Code
│   ├── app/                   # Expo Router File-Based Routing
│   │   ├── _layout.tsx        # Root layout & global providers
│   │   ├── index.tsx          # Home screen route
│   │   └── explore.tsx        # Explore screen route
│   ├── components/            # UI Components
│   │   └── ui/                # Atomic UI Primitives (Button, Card, Input)
│   ├── services/              # API Data Services
│   │   └── user-service.ts    # Example User API service
│   ├── store/                 # Zustand Global State
│   │   └── use-app-store.ts   # Main Application Zustand store
│   ├── hooks/                 # Custom React Hooks
│   │   └── use-user.ts        # Example Custom hook
│   ├── lib/                   # Infrastructure & Helper Libraries
│   │   └── api.ts             # Central API HTTP Client
│   ├── constants/             # Design Tokens & Theme Definitions
│   │   └── theme.ts           # App colors and typography
│   └── global.css             # Tailwind CSS Directives & Global Styles
├── .env                       # Local Environment Variables
├── .env.example               # Template Environment Variables
├── tailwind.config.js         # Tailwind CSS & NativeWind scanning rules
├── metro.config.js            # Metro Bundler with NativeWind wrapper
├── babel.config.js            # Babel preset configuration
├── package.json               # Dependencies & scripts
└── tsconfig.json              # TypeScript path aliases (@/* -> ./src/*)
```

## Path Alias Reference

TypeScript path aliases are configured in `tsconfig.json`:

- `@/components/*` -> `src/components/*`
- `@/services/*` -> `src/services/*`
- `@/store/*` -> `src/store/*`
- `@/hooks/*` -> `src/hooks/*`
- `@/lib/*` -> `src/lib/*`
- `@/constants/*` -> `src/constants/*`
- `@/assets/*` -> `assets/*`
