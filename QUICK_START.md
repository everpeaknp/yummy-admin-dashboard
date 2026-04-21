# 🚀 Quick Start Guide - Yummy POS Dashboard

## Prerequisites

Before you begin, ensure you have:
- Node.js 18 or higher installed
- npm or yarn package manager
- A code editor (VS Code recommended)

## Installation Steps

### 1. Navigate to Project Directory
```bash
cd yummy-pos-dashboard
```

### 2. Install Dependencies
```bash
npm install
```

This will install:
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React

### 3. Start Development Server
```bash
npm run dev
```

### 4. Open in Browser
Navigate to: [http://localhost:3000](http://localhost:3000)

The app will automatically redirect to `/dashboard`

## 📁 Project Structure Overview

```
yummy-pos-dashboard/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── layout/           # Layout components
│   ├── dashboard/        # Dashboard components
│   └── ui/              # UI components
└── lib/                  # Utilities and data
    └── data.ts          # Static data
```

## 🎯 Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/dashboard` | Main overview with charts |
| Restaurants | `/dashboard/restaurants` | Restaurant management |
| Restaurant Detail | `/dashboard/restaurants/1` | Individual restaurant |
| Payments | `/dashboard/payments` | Payment tracking |
| Subscriptions | `/dashboard/subscriptions` | Subscription metrics |
| Plans | `/dashboard/plans` | Plan management |
| Settings | `/dashboard/settings` | System settings |

## 🎨 Customization Guide

### Change Primary Color

Edit `app/globals.css`:
```css
--primary: 221.2 83.2% 53.3%;  /* Indigo */
```

### Add New Menu Item

Edit `components/layout/Sidebar.tsx`:
```typescript
const menuItems: MenuItem[] = [
  // ... existing items
  {
    label: "New Page",
    icon: YourIcon,
    href: "/dashboard/new-page",
  },
];
```

### Modify Data

Edit `lib/data.ts`:
```typescript
export const restaurants = [
  // Add or modify restaurant data
];
```

## 🔧 Common Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript types

# Clean Install
rm -rf node_modules package-lock.json
npm install
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
npm run dev -- -p 3001
```

### Module Not Found
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
```

### TypeScript Errors
```bash
# Check types
npm run type-check

# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

## 📦 Building for Production

### 1. Build the Project
```bash
npm run build
```

### 2. Test Production Build
```bash
npm start
```

### 3. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 🎓 Next Steps

1. **Explore the Dashboard**
   - Navigate through all pages
   - Test search and filters
   - Check responsive design

2. **Customize the Design**
   - Change colors
   - Update logo
   - Modify layouts

3. **Add Your Data**
   - Replace static data in `lib/data.ts`
   - Connect to your backend API
   - Add authentication

4. **Extend Functionality**
   - Add new pages
   - Create custom components
   - Implement real-time updates

## 📚 Helpful Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Recharts Examples](https://recharts.org/en-US/examples)
- [Lucide Icons](https://lucide.dev/icons)

## 💡 Pro Tips

1. **Use TypeScript**: Take advantage of type safety
2. **Component Reusability**: Create reusable components
3. **Consistent Styling**: Follow the design system
4. **Performance**: Optimize images and lazy load components
5. **Accessibility**: Use semantic HTML and ARIA labels

## 🆘 Need Help?

- Check `README.md` for detailed documentation
- Review `PROJECT_SUMMARY.md` for complete overview
- Open an issue on GitHub
- Contact support team

## ✅ Checklist

- [ ] Dependencies installed
- [ ] Development server running
- [ ] All pages accessible
- [ ] No console errors
- [ ] Responsive design working
- [ ] Ready to customize

---

Happy coding! 🎉
