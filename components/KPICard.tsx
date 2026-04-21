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
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          {trend && (
            <p className={`text-sm mt-2 ${trendUp ? "text-green-600" : "text-red-600"}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-orange-50 rounded-lg">
          <Icon className="text-orange-600" size={24} />
        </div>
      </div>
    </Card>
  );
}
