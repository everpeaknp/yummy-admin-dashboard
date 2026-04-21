import { LucideIcon } from "lucide-react";
import Card from "./Card";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export default function KPICard({ title, value, icon: Icon, trend, trendUp }: KPICardProps) {
  const trendClass = trendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm text-gray-600 dark:text-gray-300">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
          {trend && (
            <p className={`mt-2 text-sm ${trendClass}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-500/10">
          <Icon className="text-orange-600" size={24} />
        </div>
      </div>
    </Card>
  );
}
