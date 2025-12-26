# AVARTAH // Revenue Architecture Engine
> **Logic over Varnish. Engineering over Aesthetics.**

![Status](https://img.shields.io/badge/System_Status-Operational-success?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Production_Ready-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20|%20Supabase%20|%20EmailJS-orange?style=flat-square)

## 01 // Executive Summary
AVARTAH is a forensic conversion engine designed for high-stakes digital service providers. Unlike traditional landing pages, this infrastructure is built to capture, analyze, and escalate leads through a multi-step data ingestion pipeline. It is specifically engineered to handle $10k+ scalability by prioritizing technical authority and friction-free user logic.

## 02 // Core Architecture
The system operates on a "Dual-Node" logic:
* **The Frontend:** A responsive, high-fidelity UI that scales from a compact mobile form to a wide-screen desktop dashboard.
* **The Intelligence Layer:** A custom telemetry suite that tracks visitor duration, click-through rates, and form drop-off points.
* **The Bridge:** Automated handshakes between Supabase (Database), EmailJS (Communications), and Calendly (Booking).

## 03 // Technical Features
- **Forensic Intake Pipeline:** 5-step serialized data ingestion with unique `session_id` tracking.
- **Desktop Optimization:** Advanced CSS Grid/Flex layout logic that eliminates negative space on wide screens without compromising mobile verticality.
- **Dynamic Aesthetic:** Laboratory White (`#F8FAFC`) surfaces with Sunset Orange (`#F97316`) call-to-action nodes.
- **Projected Revenue Logic:** SQL-based pipeline analysis to calculate potential revenue based on user-selected capital tiers.

## 04 // Environment Variables
To deploy this engine, the following environment variables are required:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# EmailJS Configuration
NEXT_PUBLIC_EMAILJS_SERVICE_ID=service_xxxx
NEXT_PUBLIC_EMAILJS_TEMPLATE_ADMIN=template_xxxx
NEXT_PUBLIC_EMAILJS_TEMPLATE_CLIENT=template_xxxx
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=user_xxxx

# External Handshakes
NEXT_PUBLIC_CALENDLY_URL=your_calendly_link
NEXT_PUBLIC_WHATSAPP_LINK=your_whatsapp_api_link
