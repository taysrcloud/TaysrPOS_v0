import React from 'react';

export const ResponsiveContainer: React.FC<{ width?: string | number; height?: string | number; children?: React.ReactNode }> = ({ children }) => (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>{children}</div>
);

export const AreaChart: React.FC<{ data?: any[]; children?: React.ReactNode; margin?: any }> = ({ data = [], children }) => {
  return (
    <svg width="100%" height="100%" viewBox="0 0 500 250" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      {children}
      {/* Simple SVG area render */}
      {data.length > 1 && (
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          points={data.map((d, i) => `${(i / (data.length - 1)) * 480 + 10},${220 - Math.min(200, (Number(d.ventes) || 0) / 100)}`).join(' ')}
        />
      )}
    </svg>
  );
};

export const BarChart: React.FC<any> = ({ children }) => <svg width="100%" height="100%">{children}</svg>;
export const Bar: React.FC<any> = () => null;
export const XAxis: React.FC<any> = () => null;
export const YAxis: React.FC<any> = () => null;
export const CartesianGrid: React.FC<any> = () => null;
export const Tooltip: React.FC<any> = () => null;
export const Legend: React.FC<any> = () => null;
export const Area: React.FC<any> = () => null;
export const ComposedChart: React.FC<any> = ({ children }) => <svg width="100%" height="100%">{children}</svg>;
export const LineChart: React.FC<any> = ({ children }) => <svg width="100%" height="100%">{children}</svg>;
export const Line: React.FC<any> = () => null;
export const PieChart: React.FC<any> = ({ children }) => <svg width="100%" height="100%">{children}</svg>;
export const Pie: React.FC<any> = () => null;
export const Cell: React.FC<any> = () => null;
