import React, { useState } from 'react';
import { TemporalCorrelation } from '../../services/apiClient';
import { cn } from '../../utils/cn';

interface CorrelationConnectorProps {
  correlation: TemporalCorrelation;
  x1: number; // px from canvas left
  y1: number; // px from canvas top
  x2: number;
  y2: number;
  isSelected?: boolean;
}

export const TimelineCorrelationConnector: React.FC<CorrelationConnectorProps> = ({
  correlation,
  x1,
  y1,
  x2,
  y2,
  isSelected = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Compute curved Bezier control points
  const dx = x2 - x1;
  const dy = y2 - y1;
  const curvature = Math.min(80, Math.max(30, Math.abs(dx) * 0.2));
  
  // Midpoint for badge
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - curvature * 0.5;

  const pathD = `M ${x1} ${y1} Q ${midX} ${midY - curvature * 0.5} ${x2} ${y2}`;

  return (
    <g className="cursor-pointer group" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {/* Invisible thick path for easy mouse hover hit detection */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
      />

      {/* Visible Dashed Arc */}
      <path
        d={pathD}
        fill="none"
        className={cn(
          "transition-all duration-200",
          isSelected || isHovered
            ? "stroke-primary stroke-[2.5px] opacity-100 filter drop-shadow-[0_0_6px_rgba(99,102,241,0.6)]"
            : "stroke-primary/50 stroke-[1.5px] opacity-70 hover:opacity-100"
        )}
        strokeDasharray="4 4"
      />

      {/* Midpoint Pill: Time Delta */}
      <foreignObject x={midX - 35} y={midY - 10} width={70} height={20} className="overflow-visible pointer-events-none">
        <div className={cn(
          "px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold text-center border shadow-xs transition-all whitespace-nowrap",
          isSelected || isHovered
            ? "bg-primary text-primary-foreground border-primary scale-110"
            : "bg-card text-foreground border-border"
        )}>
          {correlation.time_delta_formatted}
        </div>
      </foreignObject>
    </g>
  );
};
