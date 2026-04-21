"use client";

import { Search, Bell, ChevronDown } from "lucide-react";

interface NavbarProps {
  title: string;
  subtitle?: string;
}

export function Navbar({ title, subtitle }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 backdrop-blur-sm bg-white/95">
      <div className="h-full px-8 flex items-center justify-between">
        {/* Page Title */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-80 h-10 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Notifications */}
          <button className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full"></span>
          </button>

          {/* Profile */}
          <button className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
            <img
              src="https://ui-avatars.com/api/?name=Admin&background=f97316&color=fff&bold=true"
              alt="Admin"
              className="w-8 h-8 rounded-lg"
            />
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
