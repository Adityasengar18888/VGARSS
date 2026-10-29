import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Card({ title, subtitle, badge, actions, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-[#111111] border border-[#292929] rounded-[4px] p-4 text-[#F2F2F2] shadow-xs ${className}`}
      {...props}
    >
      {(title || subtitle || badge || actions) && (
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222222]">
          <div>
            <div className="flex items-center space-x-2">
              {typeof title === 'string' ? (
                <h3 className="text-sm font-bold text-[#F2F2F2] font-mono tracking-tight">{title}</h3>
              ) : (
                title
              )}
              {badge}
            </div>
            {subtitle && <p className="text-xs text-[#A1A1A1] mt-1 max-w-[65ch] font-mono">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center space-x-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
