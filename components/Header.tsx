"use client";

import { Search, Bell, ChevronDown } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-8 py-4 sticky top-0 z-10 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Next.js Admin Dashboard Solution</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search"
              className="pl-9 pr-4 py-2 w-72 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
            />
          </div>
          
          {/* Notifications */}
          <button className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
            <Bell size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
          </button>
          
          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg pr-2 py-1 transition-colors">
            <img
              src="https://ui-avatars.com/api/?name=John+Smith&background=6366f1&color=fff&bold=true"
              alt="User"
              className="w-8 h-8 rounded-full"
            />
            <div className="text-sm">
              <p className="font-semibold text-gray-900 dark:text-white text-xs">Admin</p>
            </div>
            <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
          </div>
        </div>
      </div>
    </header>
  );
}
