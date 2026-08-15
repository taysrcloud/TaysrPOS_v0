import React from 'react';

export const PageHeader = ({ title, subtitle, action, icon: Icon }: { title: string; subtitle?: string; action?: React.ReactNode; icon?: any }) => (
  <div className="modern-page-header">
    <div className="header-content">
      {Icon && <div className="header-icon-container"><Icon size={24} strokeWidth={2.5} /></div>}
      <div>
        <h1 className="modern-page-title">{title}</h1>
        {subtitle && <p className="modern-page-subtitle">{subtitle}</p>}
      </div>
    </div>
    {action && <div className="modern-page-actions">{action}</div>}
  </div>
);
