import React from 'react';
import './PillNav.css';

const PillNav = ({
  items = [],
  activeHref,
  className = ''
}) => {
  return (
    <nav className={`pill-nav-container ${className}`} aria-label="Citadel Navigation">
      <div className="pill-nav-track">
        {items.map((item, index) => {
          const isActive = activeHref === item.href;
          return (
            <button
              key={index}
              type="button"
              className={`pill-nav-item ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                item.onClick?.();
              }}
            >
              {item.icon && <span className="pill-nav-icon">{item.icon}</span>}
              <span className="pill-nav-label">{item.label}</span>
              {isActive && <span className="pill-nav-active-dot" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default PillNav;
