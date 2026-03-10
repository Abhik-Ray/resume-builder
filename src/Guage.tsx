import type { FC } from "react";

interface GaugePropsType {
    value?: number;
    size?: number;
}
export const Gauge: FC<GaugePropsType> = ({ value = 40, size = 250 }) => {
  // SVG Geometry Constants
  const radius = 40;
  const strokeWidth = 10;
  
  // The mathematical circumference of a semi-circle: π * r
  const circumference = Math.PI * radius;
  
  // Calculate the 'gap' (how much of the stroke is hidden)
  // At 0%, offset = circumference; At 100%, offset = 0
  const offset = circumference - (value / 100) * circumference;

  return (
    <div style={{ width: size }} className="relative flex flex-col items-center">
      <svg 
        viewBox="0 0 100 55" 
        className="w-full h-auto drop-shadow-sm"
      >
        {/* Background Track (The Gray/Light Blue Arc) */}
        <path
          d="M 10,50 A 40,40 0 0 1 90,50"
          fill="none"
          stroke="#e2e8f0" // slate-200
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Progress Fill (The Active Arc) */}
        <path
          d="M 10,50 A 40,40 0 0 1 90,50"
          fill="none"
          stroke="#3b82f6" // blue-500
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ 
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 0.8s ease-in-out' 
          }}
        />
      </svg>
      
      {/* Percentage Label */}
      <div className="absolute bottom-0 text-center">
        <span className="text-3xl font-bold text-slate-800">{value}%</span>
      </div>
    </div>
  );
};

export default Gauge;