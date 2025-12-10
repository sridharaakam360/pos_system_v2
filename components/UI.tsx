import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' }> = ({
  children, variant = 'primary', className = '', ...props
}) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-green-600 text-white hover:bg-green-700"
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; icon?: React.ReactNode }> = ({ label, icon, className = '', ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
          {icon}
        </div>
      )}
      <input
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${icon ? 'pl-10' : ''} ${className}`}
        {...props}
      />
    </div>
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
    <select
      className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  </div>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode, title?: string, className?: string }> = ({ children, title, className = '', ...props }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 ${className}`} {...props}>
    {title && <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>}
    {children}
  </div>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">&times;</button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: 'green' | 'blue' | 'yellow' | 'red' }> = ({ children, color = 'blue' }) => {
  const colors = {
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

// ---------------- Tabs Component ----------------

// UI.tsx — Replace your entire Tabs component with this fixed version:
export const Tabs: React.FC<{
  tabs: { id: string; label: string; icon?: React.ComponentType<any> }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  return (
    <div className={`flex gap-1 border-b border-slate-200 overflow-x-auto ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px- px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px
            ${activeTab === tab.id
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-500 hover:text-slate-700 border-transparent'
            }`}
        >
          {tab.icon && <tab.icon size={19} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
};
