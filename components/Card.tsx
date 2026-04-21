import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-100 bg-white shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {children}
    </div>
  );
}
