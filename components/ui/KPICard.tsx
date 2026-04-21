import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  changeLabel?: string;
}

export function KPICard({ title, value, icon: Icon, change, changeLabel }: KPICardProps) {
  const isPositive = change && change > 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
          <Icon className="w-6 h-6 text-orange-600" strokeWidth={2} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
            {isPositive ? (
              <TrendingUp className={`w-3 h-3 ${isPositive ? 'text-green-600' : 'text-red-600'}`} />
            ) : (
              <TrendingDown className={`w-3 h-3 text-red-600`} />
            )}
            <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(change)}%
            </span>
          </div>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {changeLabel && (
          <p className="text-xs text-gray-500 mt-2">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
