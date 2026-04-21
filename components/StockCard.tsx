interface StockCardProps {
  name: string;
  logo: string;
  totalShares: string;
  totalReturn: string;
  returnPercentage: number;
  chartData?: number[];
}

export default function StockCard({ 
  name, 
  logo, 
  totalShares, 
  totalReturn, 
  returnPercentage,
  chartData = [20, 35, 25, 45, 30, 50, 40, 55, 45, 60]
}: StockCardProps) {
  const isPositive = returnPercentage >= 0;
  
  // Simple sparkline SVG
  const width = 60;
  const height = 24;
  const max = Math.max(...chartData);
  const min = Math.min(...chartData);
  const range = max - min;
  
  const points = chartData.map((value, index) => {
    const x = (index / (chartData.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-sm font-bold">
            {logo}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
          </div>
        </div>
        <svg width={width} height={height}>
          <polyline
            points={points}
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      
      <div className="space-y-2.5 mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total Shares</p>
          <p className="text-base font-bold text-gray-900">{totalShares}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total Return</p>
          <p className="text-base font-bold text-gray-900">{totalReturn}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 text-xs">
        <span className={`font-semibold ${isPositive ? "text-red-500" : "text-red-500"}`}>
          {returnPercentage > 0 ? "+" : ""}{returnPercentage}%
        </span>
        <span className="text-red-500">▼</span>
      </div>
    </div>
  );
}
