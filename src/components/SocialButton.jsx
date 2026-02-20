import React from 'react';
import './SocialButton.css';

/* ── Official SVG logos ────────────────────── */

const WaLogo = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path
            d="M16 1C7.714 1 1 7.716 1 16c0 2.626.677 5.094 1.862 7.243L1 31l8.01-1.837A14.93 14.93 0 0016 31c8.284 0 15-6.716 15-15S24.284 1 16 1z"
            fill="#fff"
        />
        <path
            d="M16 2.8C8.71 2.8 2.8 8.71 2.8 16c0 2.444.651 4.74 1.79 6.72L3.1 28.9l6.373-1.47A13.14 13.14 0 0016 29.2c7.29 0 13.2-5.91 13.2-13.2S23.29 2.8 16 2.8zm7.12 18.2c-.3.84-1.76 1.6-2.44 1.68-.64.08-1.44.12-2.32-.44-.54-.34-1.22-.8-2.08-1.54-2.44-2.1-3.96-4.98-4.08-5.2-.12-.22-.94-1.26-.94-2.4 0-1.14.58-1.7.8-1.94.22-.24.48-.3.64-.3h.46c.15 0 .36-.06.56.42.2.5.7 1.7.76 1.82.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.25-.1.49.14.24.62.98 1.34 1.58.92.8 1.7 1.05 1.94 1.17.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.24 1.42z"
            fill="#25D366"
        />
    </svg>
);

const TgLogo = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="15" fill="#fff" />
        <path
            d="M22.82 9.62 6.6 15.94c-1.12.43-.98 1.05-.18 1.32l4.1 1.28 9.52-5.98c.45-.28.86-.13.52.18L12.6 20.1l-.28 4.28c.4 0 .58-.18.78-.38l1.88-1.8 3.9 2.86c.72.4 1.24.2 1.42-.66l2.56-12.06c.26-1.04-.4-1.52-1.04-1.72z"
            fill="#229ED9"
        />
    </svg>
);

/* ── Component ──────────────────────────────── */

/**
 * SocialButton
 * @param {'whatsapp'|'telegram'} type
 * @param {'sm'|'md'|'lg'|'icon'} size
 * @param {string} href  - if provided renders as <a>
 * @param {function} onClick
 * @param {string} label - text next to icon (optional for icon-only)
 * @param {boolean} iconOnly
 */
const SocialButton = ({
    type = 'whatsapp',
    size = 'md',
    href,
    onClick,
    label,
    iconOnly = false,
    className = '',
}) => {
    const isWa = type === 'whatsapp';
    const colorClass = isWa ? 'social-btn-wa' : 'social-btn-tg';
    const sizeClass = iconOnly ? 'social-btn-icon' : `social-btn-${size}`;
    const Logo = isWa ? WaLogo : TgLogo;
    const logoSize = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;

    const classes = `social-btn ${colorClass} ${sizeClass} ${className}`;
    const content = (
        <>
            <Logo size={logoSize} />
            {!iconOnly && label && <span>{label}</span>}
        </>
    );

    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
                {content}
            </a>
        );
    }

    return (
        <button onClick={onClick} className={classes}>
            {content}
        </button>
    );
};

export default SocialButton;
