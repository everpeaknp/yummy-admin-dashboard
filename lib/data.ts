// Static data for Restaurant POS Dashboard

export const restaurants = [
  {
    id: 1,
    name: "Momo King",
    owner: "Ram Thapa",
    email: "ram@momoking.com",
    plan: "Pro",
    status: "Active",
    paymentStatus: "Paid",
    expiryDate: "2026-04-12",
    monthlyRevenue: 1200,
    branches: 3,
    joinedDate: "2023-10-12",
    phone: "+1 (555) 012-3456"
  },
  {
    id: 2,
    name: "Burger House",
    owner: "Sita Sharma",
    email: "sita@burgerhouse.com",
    plan: "Basic",
    status: "Active",
    paymentStatus: "Paid",
    expiryDate: "2026-03-20",
    monthlyRevenue: 800,
    branches: 1,
    joinedDate: "2024-02-10",
    phone: "+1 (555) 234-5678"
  },
  {
    id: 3,
    name: "Pizza Corner",
    owner: "Hari Prasad",
    email: "hari@pizzacorner.com",
    plan: "Enterprise",
    status: "Active",
    paymentStatus: "Paid",
    expiryDate: "2026-05-30",
    monthlyRevenue: 2500,
    branches: 5,
    joinedDate: "2023-11-05",
    phone: "+1 (555) 345-6789"
  },
  {
    id: 4,
    name: "Thakali Kitchen",
    owner: "Maya Gurung",
    email: "maya@thakalikitchen.com",
    plan: "Pro",
    status: "Trial",
    paymentStatus: "Pending",
    expiryDate: "2026-03-10",
    monthlyRevenue: 0,
    branches: 2,
    joinedDate: "2024-02-25",
    phone: "+1 (555) 456-7890"
  },
  {
    id: 5,
    name: "Newari Bhoj",
    owner: "Bikash Shrestha",
    email: "bikash@newaribhoj.com",
    plan: "Basic",
    status: "Suspended",
    paymentStatus: "Failed",
    expiryDate: "2024-02-28",
    monthlyRevenue: 600,
    branches: 1,
    joinedDate: "2023-08-12",
    phone: "+1 (555) 567-8901"
  },
  {
    id: 6,
    name: "Cafe Delight",
    owner: "Anjali Rai",
    email: "anjali@cafedelight.com",
    plan: "Pro",
    status: "Active",
    paymentStatus: "Paid",
    expiryDate: "2026-04-05",
    monthlyRevenue: 1500,
    branches: 2,
    joinedDate: "2024-03-18",
    phone: "+1 (555) 678-9012"
  }
];

export const payments = [
  {
    id: 1,
    restaurantId: 1,
    restaurantName: "Momo King",
    plan: "Pro Plan - Annual",
    amount: 1200.00,
    date: "2024-04-12",
    paymentMethod: "Credit Card",
    status: "Paid",
    invoiceNumber: "INV-001"
  },
  {
    id: 2,
    restaurantId: 1,
    restaurantName: "Momo King",
    plan: "Basic Plan - Monthly",
    amount: 120.00,
    date: "2024-03-12",
    paymentMethod: "Bank Transfer",
    status: "Paid",
    invoiceNumber: "INV-000-PREV"
  },
  {
    id: 3,
    restaurantId: 2,
    restaurantName: "Burger House",
    plan: "Basic Plan",
    amount: 800,
    date: "2024-02-20",
    paymentMethod: "Bank Transfer",
    status: "Paid",
    invoiceNumber: "INV-002"
  },
  {
    id: 4,
    restaurantId: 3,
    restaurantName: "Pizza Corner",
    plan: "Enterprise Plan",
    amount: 2500,
    date: "2024-02-28",
    paymentMethod: "Credit Card",
    status: "Paid",
    invoiceNumber: "INV-003"
  },
  {
    id: 5,
    restaurantId: 4,
    restaurantName: "Thakali Kitchen",
    plan: "Pro Plan",
    amount: 1200,
    date: "2024-03-01",
    paymentMethod: "Pending",
    status: "Pending",
    invoiceNumber: "INV-004"
  },
  {
    id: 6,
    restaurantId: 5,
    restaurantName: "Newari Bhoj",
    plan: "Basic Plan",
    amount: 600,
    date: "2024-02-28",
    paymentMethod: "Credit Card",
    status: "Failed",
    invoiceNumber: "INV-005"
  }
];

export const revenueData = [
  { month: "Jan", revenue: 12000 },
  { month: "Feb", revenue: 15000 },
  { month: "Mar", revenue: 18000 },
  { month: "Apr", revenue: 22000 },
  { month: "May", revenue: 25000 },
  { month: "Jun", revenue: 28000 },
  { month: "Jul", revenue: 32000 }
];

export const kpiData = {
  totalRestaurants: 6,
  activeSubscriptions: 4,
  monthlyRevenue: 8600,
  pendingPayments: 1,
  trialUsers: 1,
  expiringSoon: 2
};
