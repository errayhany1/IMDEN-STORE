import React from 'react';
import useStore from '../store/useStore';
import './DarkModeToggle.css';

const DarkModeToggle = () => {
    const { darkMode, toggleDarkMode } = useStore();

    return (
        <label className="dm-switch" title={darkMode ? 'وضع النهار' : 'وضع الليل'} aria-label="تبديل الوضع المظلم">
            <input
                id="dm-input"
                type="checkbox"
                checked={darkMode}
                onChange={toggleDarkMode}
            />
            <div className="dm-slider dm-round">
                <div className="dm-sun-moon">
                    {/* Moon dots */}
                    <svg id="dm-moon-dot-1" className="dm-moon-dot" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" /></svg>
                    <svg id="dm-moon-dot-2" className="dm-moon-dot" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" /></svg>
                    <svg id="dm-moon-dot-3" className="dm-moon-dot" viewBox="0 0 3 3"><circle cx="1.5" cy="1.5" r="1.5" /></svg>
                    {/* Light rays */}
                    <svg id="dm-light-ray-1" viewBox="0 0 43 43"><circle cx="21.5" cy="21.5" r="21.5" /></svg>
                    <svg id="dm-light-ray-2" viewBox="0 0 55 55"><circle cx="27.5" cy="27.5" r="27.5" /></svg>
                    <svg id="dm-light-ray-3" viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" /></svg>
                </div>
                {/* Clouds */}
                <svg id="dm-cloud-1" className="dm-cloud-light" viewBox="0 0 40 20"><ellipse cx="20" cy="14" rx="18" ry="8" /><ellipse cx="14" cy="12" rx="10" ry="8" /><ellipse cx="26" cy="11" rx="8" ry="7" /></svg>
                <svg id="dm-cloud-2" className="dm-cloud-light" viewBox="0 0 20 10"><ellipse cx="10" cy="7" rx="9" ry="4" /><ellipse cx="7" cy="6" rx="5" ry="4" /><ellipse cx="14" cy="5" rx="4" ry="3.5" /></svg>
                <svg id="dm-cloud-3" className="dm-cloud-dark" viewBox="0 0 30 15"><ellipse cx="15" cy="10" rx="13" ry="6" /><ellipse cx="10" cy="9" rx="8" ry="6" /><ellipse cx="21" cy="8" rx="6" ry="5" /></svg>
                <svg id="dm-cloud-4" className="dm-cloud-dark" viewBox="0 0 40 20"><ellipse cx="20" cy="14" rx="18" ry="8" /><ellipse cx="14" cy="12" rx="10" ry="8" /><ellipse cx="26" cy="11" rx="8" ry="7" /></svg>
                {/* Stars */}
                <div className="dm-stars">
                    <svg id="dm-star-1" className="dm-star" viewBox="0 0 20 20"><polygon points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7" /></svg>
                    <svg id="dm-star-2" className="dm-star" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" /></svg>
                    <svg id="dm-star-3" className="dm-star" viewBox="0 0 12 12"><polygon points="6,0.5 7.7,4.3 11.8,4.6 8.7,7.3 9.7,11.3 6,9 2.3,11.3 3.3,7.3 0.2,4.6 4.3,4.3" /></svg>
                    <svg id="dm-star-4" className="dm-star" viewBox="0 0 18 18"><polygon points="9,0.5 11.4,6.3 17.5,6.8 13,10.7 14.5,16.7 9,13.5 3.5,16.7 5,10.7 0.5,6.8 6.6,6.3" /></svg>
                </div>
            </div>
        </label>
    );
};

export default DarkModeToggle;
