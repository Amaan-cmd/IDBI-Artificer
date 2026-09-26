import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import './SkiperLink.css';

/**
 * SkiperLink (Skiper UI skiper40 inspired)
 * Stylized interactive action/link with animated underline expansion, icon translation, and color shift.
 */
export default function SkiperLink({
  children,
  href,
  onClick,
  icon,
  variant = 'default', // 'default' | 'pill'
  className = '',
  target,
  rel,
  ...props
}) {
  const isLink = Boolean(href);
  const Component = isLink ? 'a' : 'button';
  const IconComponent = icon || <ArrowUpRight size={16} />;

  return (
    <Component
      href={href}
      onClick={onClick}
      target={target}
      rel={target === '_blank' ? (rel || 'noopener noreferrer') : rel}
      className={`skiper-link ${variant === 'pill' ? 'skiper-link-pill' : ''} ${className}`}
      {...props}
    >
      <span className="skiper-link-text">{children}</span>
      <span className="skiper-link-icon">{IconComponent}</span>
      {variant !== 'pill' && <span className="skiper-link-underline" />}
    </Component>
  );
}
