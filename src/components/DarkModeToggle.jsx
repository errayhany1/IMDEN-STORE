import React from 'react';
import useStore from '../store/useStore';
import './DarkModeToggle.css';

/**
 * All SVGs have explicit width/height so they stay small even if CSS fails to load.
 */
const DarkModeToggle = () => {
    const { darkMode, toggleDarkMode } = useStore();

    return (
        <label
            className="dm-switch"
            title={darkMode ? 'وضع النهار' : 'وضع الليل'}
            aria-label="تبديل الوضع المظلم"
            style={{ position: 'relative', display: 'inline-block', width: 60, height: 34, cursor: 'pointer', flexShrink: 0 }}
        >
            <input
                id="dm-input"
                type="checkbox"
                checked={darkMode}
                onChange={toggleDarkMode}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
            />
            <div
                className="dm-slider dm-round"
                style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    borderRadius: 34, overflow: 'hidden', cursor: 'pointer',
                    backgroundColor: darkMode ? '#0f172a' : '#2196f3',
                    transition: 'background-color 0.4s',
                }}
            >
                {/* Sun / Moon ball */}
                <div
                    className="dm-sun-moon"
                    style={{
                        position: 'absolute',
                        width: 26, height: 26,
                        left: 4, bottom: 4,
                        borderRadius: '50%',
                        backgroundColor: darkMode ? 'white' : 'yellow',
                        transform: darkMode ? 'translateX(26px)' : 'translateX(0)',
                        transition: 'transform 0.4s, background-color 0.4s',
                        overflow: 'visible',
                    }}
                >
                    {/* Moon dots — visible only in dark mode */}
                    {[
                        { id: 'md1', style: { left: 10, top: 3, width: 6, height: 6 } },
                        { id: 'md2', style: { left: 2, top: 10, width: 10, height: 10 } },
                        { id: 'md3', style: { left: 16, top: 18, width: 3, height: 3 } },
                    ].map(({ id, style }) => (
                        <svg
                            key={id}
                            viewBox="0 0 10 10"
                            width={style.width}
                            height={style.height}
                            style={{
                                position: 'absolute',
                                left: style.left, top: style.top,
                                fill: 'gray',
                                opacity: darkMode ? 1 : 0,
                                transition: 'opacity 0.4s',
                                zIndex: 4,
                                overflow: 'visible',
                            }}
                        >
                            <circle cx="5" cy="5" r="5" />
                        </svg>
                    ))}

                    {/* Light rays — visible only in day mode */}
                    {[
                        { id: 'lr1', size: 43, offset: -8 },
                        { id: 'lr2', size: 55, offset: -14 },
                        { id: 'lr3', size: 60, offset: -17 },
                    ].map(({ id, size, offset }) => (
                        <svg
                            key={id}
                            viewBox="0 0 100 100"
                            width={size}
                            height={size}
                            style={{
                                position: 'absolute',
                                left: offset, top: offset,
                                fill: 'white',
                                opacity: darkMode ? 0 : 0.1,
                                transition: 'opacity 0.4s',
                                zIndex: -1,
                                pointerEvents: 'none',
                            }}
                        >
                            <circle cx="50" cy="50" r="50" />
                        </svg>
                    ))}
                </div>

                {/* Clouds — visible only in day mode */}
                {!darkMode && [
                    { id: 'c1', left: 30, top: 15, width: 40 },
                    { id: 'c2', left: 44, top: 10, width: 20 },
                    { id: 'c3', left: 18, top: 24, width: 30 },
                ].map(({ id, left, top, width }) => (
                    <svg
                        key={id}
                        viewBox="0 0 40 20"
                        width={width}
                        height={width / 2}
                        style={{ position: 'absolute', left, top, fill: '#eee', pointerEvents: 'none' }}
                    >
                        <ellipse cx="20" cy="14" rx="18" ry="7" />
                        <ellipse cx="13" cy="11" rx="10" ry="8" />
                        <ellipse cx="27" cy="10" rx="8" ry="7" />
                    </svg>
                ))}

                {/* Stars — visible only in dark mode */}
                {darkMode && [
                    { id: 's1', w: 14, left: 3, top: 2 },
                    { id: 's2', w: 5, left: 3, top: 18 },
                    { id: 's3', w: 9, left: 10, top: 20 },
                    { id: 's4', w: 13, left: 18, top: 1 },
                ].map(({ id, w, left, top }) => (
                    <svg
                        key={id}
                        viewBox="0 0 20 20"
                        width={w}
                        height={w}
                        style={{ position: 'absolute', left, top, fill: 'white', pointerEvents: 'none' }}
                    >
                        <polygon points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7" />
                    </svg>
                ))}
            </div>
        </label>
    );
};

export default DarkModeToggle;
