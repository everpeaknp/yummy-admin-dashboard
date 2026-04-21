export interface Restaurant {
  id: string;
  name: string;
  location: string;
  plan: string;
  status: "Active" | "Trial" | "Suspended";
  payment: string;
  expiryDate: string;
  hasRestaurant: boolean;
  hasHotel: boolean;
}

// Initial restaurant data
export const initialRestaurants: Restaurant[] = [
  {
    id: "R-001",
    name: "Gourmet Garden",
    location: "New York, USA",
    plan: "ENTERPRISE",
    status: "Active",
    payment: "Paid",
    expiryDate: "Dec 12, 2025",
    hasRestaurant: true,
    hasHotel: false
  },
  {
    id: "R-002",
    name: "Sushi Master",
    location: "Tokyo, Japan",
    plan: "PRO",
    status: "Active",
    payment: "Paid",
    expiryDate: "Oct 24, 2024",
    hasRestaurant: true,
    hasHotel: false
  },
  {
    id: "R-003",
    name: "Burger Barn",
    location: "London, UK",
    plan: "FREE",
    status: "Trial",
    payment: "N/A",
    expiryDate: "Sep 15, 2024",
    hasRestaurant: true,
    hasHotel: false
  },
  {
    id: "R-004",
    name: "Pasta Palace",
    location: "Rome, Italy",
    plan: "PRO",
    status: "Suspended",
    payment: "Overdue",
    expiryDate: "Jan 10, 2024",
    hasRestaurant: true,
    hasHotel: true
  },
  {
    id: "R-005",
    name: "Grand Hotel & Bistro",
    location: "Paris, France",
    plan: "ENTERPRISE",
    status: "Active",
    payment: "Paid",
    expiryDate: "Aug 30, 2025",
    hasRestaurant: true,
    hasHotel: true
  },
  {
    id: "R-006",
    name: "Seaside Resort",
    location: "Maldives",
    plan: "PRO",
    status: "Active",
    payment: "Paid",
    expiryDate: "Nov 15, 2025",
    hasRestaurant: false,
    hasHotel: true
  }
];

// In-memory store (in a real app, this would be in a database or state management)
let restaurantsStore = [...initialRestaurants];

export const getRestaurants = () => {
  return restaurantsStore;
};

export const updateRestaurant = (id: string, updates: Partial<Restaurant>) => {
  restaurantsStore = restaurantsStore.map(restaurant =>
    restaurant.id === id ? { ...restaurant, ...updates } : restaurant
  );
  return restaurantsStore;
};

export const getHotels = () => {
  return restaurantsStore.filter(restaurant => restaurant.hasHotel);
};

export const getRestaurantsOnly = () => {
  return restaurantsStore.filter(restaurant => restaurant.hasRestaurant);
};
