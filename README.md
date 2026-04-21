# Yummy POS - Super Admin Dashboard

A modern, clean Super Admin Dashboard for managing restaurants using the Yummy POS system. Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and Recharts. Features a stock-market inspired UI design with collapsible sidebar navigation.

## ✨ Features

### Dashboard Overview
- **Stock-style cards** with mini sparkline charts showing trends
- **Investment tracking** with interactive line charts
- **My Stocks section** displaying portfolio performance
- **Trending stocks** with buy/short action buttons
- **Latest transactions** with real-time updates
- **Market movers table** with comprehensive stock data

### Restaurant Management
- View, search, and filter all restaurants
- Detailed restaurant pages with subscription info
- Payment history tracking
- Usage statistics and analytics

### Subscription & Payment Tracking
- Monitor active subscriptions and trial users
- Track expiring subscriptions
- Payment transaction management with filters
- Conversion metrics and retention rates

### Plans Management
- Create, edit, and manage subscription plans
- Visual plan cards with feature lists
- Plan usage statistics

### Modern UI Features
- **Collapsible sidebar** with expandable menu items
- **Badge system** for "New" and "Pro" features
- **Clean header** with search, notifications, and user profile
- **Soft shadows** and rounded corners
- **Responsive design** for all screen sizes
- **Custom scrollbars** for a polished look

## 🎨 Design System

- **Primary Color**: Orange (#f97316)
- **Accent Color**: Dark gray
- **Background**: Light gray (#f9fafb)
- **Cards**: White with soft shadows and rounded corners
- **Typography**: Inter font family
- **Icons**: Lucide React
- **Charts**: Recharts library

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Data**: Static JSON (no backend required)

## 📁 Project Structure

```
yummy-pos-dashboard/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard layout with sidebar & header
│   │   ├── page.tsx             # Main dashboard (stock-style UI)
│   │   ├── restaurants/
│   │   │   ├── page.tsx         # Restaurants list
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Restaurant detail page
│   │   ├── subscriptions/
│   │   │   └── page.tsx         # Subscriptions page
│   │   ├── payments/
│   │   │   └── page.tsx         # Payments page
│   │   ├── plans/
│   │   │   └── page.tsx         # Plans management page
│   │   └── settings/
│   │       └── page.tsx         # Settings page
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page (redirects to dashboard)
│   └── globals.css              # Global styles with custom scrollbar
├── components/
│   ├── Sidebar.tsx              # Collapsible navigation sidebar
│   ├── Header.tsx               # Top header with search & user menu
│   ├── Card.tsx                 # Reusable card component
│   ├── Badge.tsx                # Status badge component
│   ├── KPICard.tsx              # KPI metric card component
│   └── StockCard.tsx            # Stock-style card with sparkline
├── lib/
│   └── data.ts                  # Static data (restaurants, payments, plans)
└── package.json
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Navigate to the project directory:
```bash
cd yummy-pos-dashboard
```

2. Install dependencies (already done):
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

The app will automatically redirect to `/dashboard`.

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🚢 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Deploy with one click

The app is ready for production deployment with no additional configuration needed.

## 🎯 Key Components

### Sidebar Navigation
- Collapsible menu items with submenu support
- Active state indicators
- Badge system for "New" and "Pro" features
- Smooth transitions and hover effects

### Stock Cards
- Mini sparkline charts showing trends
- Color-coded positive/negative indicators
- Total shares and return values
- Hover effects for interactivity

### Header
- Global search functionality
- Theme toggle button
- Notification bell with indicator
- User profile dropdown

### Data Tables
- Sortable columns
- Hover effects on rows
- Status badges
- Action buttons

## 🎨 Customization

### Colors

Update Tailwind colors in `tailwind.config.ts`:
- Primary: Orange (`orange-600`)
- Success: Green (`green-600`)
- Danger: Red (`red-600`)
- Warning: Yellow (`yellow-600`)

### Adding New Pages

1. Create a new folder in `app/dashboard/`
2. Add a `page.tsx` file
3. Update the sidebar menu in `components/Sidebar.tsx`

### Modifying Data

All data is stored in `lib/data.ts` as static JSON:
- `restaurants` - Restaurant information
- `payments` - Payment transactions
- `plans` - Subscription plans
- `revenueData` - Revenue chart data
- `signupData` - Signup trend data
- `planDistribution` - Plan distribution for pie chart

## 🌟 UI Highlights

- **Modern Stock Dashboard Design**: Inspired by financial trading platforms
- **Sparkline Charts**: Mini trend indicators on cards
- **Gradient Accents**: Subtle gradients for visual appeal
- **Micro-interactions**: Smooth hover and transition effects
- **Clean Typography**: Consistent font sizing and weights
- **Proper Spacing**: Generous padding and margins
- **Color-coded Status**: Intuitive visual indicators
- **Responsive Grid**: Adapts to all screen sizes

## 📱 Responsive Design

- **Desktop**: Full sidebar with all features
- **Tablet**: Optimized layout with adjusted grid
- **Mobile**: Collapsible sidebar and stacked cards

## 🔒 Security Note

This is a frontend-only demo with static data. For production use:
- Implement proper authentication
- Add API integration
- Secure sensitive data
- Add input validation
- Implement role-based access control

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 💬 Support

For questions or issues, please open an issue on GitHub.

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS
