# Avartah Solutions

**High-Conversion Engineered Systems**

Avartah Solutions is a premium agency platform specializing in logic-driven UI/UX and high-performance revenue architecture for scaling businesses. This repository contains the full-stack application powering the agency's digital presence, including integrated analytics, lead generation, booking systems, and a comprehensive admin dashboard.

## 🚀 Key Features

- **Logic-Driven UI/UX:** High-performance, responsive frontend built with React 19 and Framer Motion.
- **Revenue Architecture:** Built-in lead tracking, conversion telemetry, and projected revenue forecasting.
- **Integrated Analytics:** Custom session tracking, CTA click monitoring, and form progress telemetry stored directly in a PostgreSQL database.
- **Booking System:** Seamless Calendly/WhatsApp handshakes and direct booking capabilities.
- **Admin Dashboard:** Secure, real-time overview of site visitors, active leads, and pipeline revenue.
- **Full-Stack Infrastructure:** Express.js backend seamlessly integrated with Vite, powered by Neon Serverless PostgreSQL.

## 🛠️ Tech Stack

**Frontend:**
- React 19
- Vite
- Tailwind CSS
- Framer Motion (Animations)
- Lucide React (Icons)
- React Router DOM

**Backend & Database:**
- Node.js & Express.js
- Neon Serverless (PostgreSQL)
- Google GenAI (Gemini Integration)

**Integrations:**
- EmailJS (Automated Email Notifications)

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Neon PostgreSQL database
- An EmailJS account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/avartah-solutions.git
   cd avartah-solutions
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy the `.env.example` file to `.env` and fill in your credentials.
   ```bash
   cp .env.example .env
   ```

### Environment Variables

Your `.env` file should include the following:

```env
# DATABASE
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# AI INTEGRATION
GEMINI_API_KEY="your_google_gemini_api_key"

# EMAIL NOTIFICATIONS (EmailJS)
VITE_EMAILJS_PUBLIC_KEY="your_emailjs_public_key"
VITE_EMAILJS_SERVICE_ID="your_emailjs_service_id"
VITE_EMAILJS_TEMPLATE_ID="your_emailjs_template_id"
```

### Running the Application

To start the development server (which runs both the Express backend and the Vite frontend middleware):

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Building for Production

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm start
```

## 📂 Project Structure

```text
├── components/          # Reusable React components (UI, Forms, Layout)
├── context/             # React Context providers (State management)
├── lib/                 # Utility functions, Analytics, and Database (Neon) config
├── pages/               # Page-level components (Home, Admin Dashboard, etc.)
├── server.ts            # Express backend entry point & API routes
├── App.tsx              # Main React application routing
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
└── package.json         # Project dependencies and scripts
```

## 🛡️ License

This project is proprietary and confidential. Unauthorized copying of this file, via any medium, is strictly prohibited.
