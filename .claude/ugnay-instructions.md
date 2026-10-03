# UGNAY Emergency Platform Guidelines

## Overview
UGNAY is an AI-powered universal emergency dispatch platform connecting citizens with first responders across the Philippines.

## Core Services & Architecture
- **Voice AI Intake:** Multi-lingual speech intake (Tagalog, Cebuano, English) with situational panic analysis and box-breathing guidance.
- **Department Routing:** Geodesic proximity matching prioritizing available units across Medical (EMS), Security (Police), Fire (BFP), and Flood/Typhoon (DRRMO).
- **Video & Audio Calling:** Agora RTC channels bridging citizens and dispatchers.
- **Data Persistence:** Supabase PostgreSQL with Realtime subscriptions for dispatch status synchronization.
