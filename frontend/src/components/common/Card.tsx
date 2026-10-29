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
      className={`bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-2xs ${className}`}
      {...props}
    >
      {(title || subtitle || badge || actions) && (
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F2F4F7]">
          <div>
            <div className="flex items-center space-x-2">
              {typeof title === 'string' ? (
                <h3 className="text-sm font-bold text-[#202631] tracking-tight">{title}</h3>
              ) : (
                title
              )}
              {badge}
            </div>
            {subtitle && <p className="text-xs text-[#667085] mt-1 max-w-[65ch]">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center space-x-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
