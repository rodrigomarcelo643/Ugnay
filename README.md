# UGNAY - AI-Powered Universal Emergency Response & Dispatch Platform

UGNAY is an intelligent, real-time emergency triage and multi-agency dispatch platform designed to connect citizens in distress with local first responders (EMS, Police, Fire, DRRMO) seamlessly.

---

## 🚑 Key Features

- **Live AI Voice Intake & Triage:** Multi-lingual conversational intake supporting Tagalog, Cebuano/Bisaya, and English with real-time emotion and behavioral guidance.
- **Smart Automated Routing:** Haversine distance-based proximity routing with automated re-routing to available backup units when a station is occupied or declines.
- **Real-Time Video & Audio Intercom:** Powered by Agora RTC for high-res low-latency communication between caller and first responders.
- **Supabase Realtime Sync:** Live incident updates, state synchronization, and dispatch event queues.
- **Hands-Free Calming Guidance:** Interactive box breathing and emergency scenario guidance for callers in distress.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the example environment file and add your credentials:
```bash
cp .env.example .env
```

### 3. Start Development Server
```bash
npx expo start
```

---

## 📱 Tech Stack

- **Framework:** React Native / Expo (SDK 57)
- **Routing:** Expo Router
- **Backend & Database:** Supabase (PostgreSQL + Realtime)
- **Live RTC Streaming:** Agora RTC
- **Styling:** NativeWind (Tailwind CSS)
- **Icons:** Lucide React Native

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
