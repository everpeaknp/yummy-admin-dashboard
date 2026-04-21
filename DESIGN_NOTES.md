# Yummy POS Dashboard - Design Implementation

This dashboard is inspired by the NextAdmin stock dashboard template with custom branding for Yummy POS restaurant management system.

## Design System

### Colors
- **Primary**: Indigo (#6366f1) - Used for active states, buttons, charts
- **Success**: Green (#10b981) - Positive trends, gains
- **Danger**: Red (#ef4444) - Negative trends, losses
- **Background**: Light gray (#f8f9fa)
- **Text**: Gray scale (900, 700, 600, 500, 400)

### Typography
- **Font Family**: Inter
- **Sizes**:
  - 10px - Badges, small labels
  - 11px - Secondary text, table headers
  - 13px - Body text, menu items
  - 14px - Base text
  - 16px - Card values
  - 20px - Section headers
  - 24px - Page titles

### Spacing
- **Card Padding**: 20px (p-5)
- **Section Gaps**: 20px (gap-5)
- **Grid Gaps**: 16px (gap-4)
- **Element Spacing**: 8px, 12px, 16px

### Components

#### Sidebar
- Width: 256px (w-64)
- Background: White
- Border: Gray-100
- Logo: Indigo gradient circle
- Active state: Indigo-50 background, Indigo-600 text
- Badges: Blue (New), Indigo (Pro)

#### Header
- Height: Auto (py-4)
- Background: White
- Border bottom: Gray-100
- Search bar: Gray-50 background
- Icons: 16-18px
- User avatar: 32px (w-8 h-8)

#### Stock Cards
- Border radius: 12px (rounded-xl)
- Border: Gray-100
- Hover: Shadow-md
- Logo: 40px circle, black background
- Sparkline: 60x24px, red stroke
- Values: Bold, gray-900

#### Charts
- Line color: Indigo (#6366f1)
- Grid: Gray-100, dashed
- Axes: Hidden
- Stroke width: 2px
- Height: 240px

#### Tables
- Header: 11px uppercase, gray-500
- Row height: py-3
- Hover: Gray-50 background
- Border: Gray-50 dividers

#### Buttons
- Primary: Indigo-600, white text
- Secondary: Gray-50, gray-700 text
- Border radius: 8px (rounded-lg)
- Padding: px-3 py-2
- Font size: 11px

### Layout Structure

```
Dashboard
├── Stock Cards (4 columns)
├── Main Content (2:1 ratio)
│   ├── Total Investment Chart (2 cols)
│   └── My Stocks Sidebar (1 col)
├── Secondary Content (1:1 ratio)
│   ├── Trending Stocks
│   └── Latest Transactions
└── Market Movers Table (full width)
```

## Pages

1. **Dashboard** (`/dashboard`) - Stock-style overview with charts and metrics
2. **Restaurants** (`/dashboard/restaurants`) - Restaurant management table
3. **Restaurant Detail** (`/dashboard/restaurants/[id]`) - Individual restaurant view
4. **Subscriptions** (`/dashboard/subscriptions`) - Subscription metrics
5. **Payments** (`/dashboard/payments`) - Payment transactions
6. **Plans** (`/dashboard/plans`) - Plan management
7. **Settings** (`/dashboard/settings`) - System settings

## Responsive Breakpoints

- **Mobile**: < 768px (md) - Single column, stacked cards
- **Tablet**: 768px - 1024px (lg) - 2 columns
- **Desktop**: > 1024px - Full layout with sidebar

## Accessibility

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus states on interactive elements
- Color contrast ratios meet WCAG AA standards

## Performance

- Static data (no API calls)
- Optimized images
- Lazy loading for charts
- Minimal bundle size
- Fast page transitions

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
