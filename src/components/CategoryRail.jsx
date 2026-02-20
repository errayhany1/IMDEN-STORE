import React from 'react';
import useStore from '../store/useStore';

// ✏️ ضع هنا رابط الصورة التي تريدها لفئة "All"
const ALL_CATEGORY_IMAGE = 'https://cdn-icons-png.flaticon.com/512/1170/1170678.png';

const CategoryRail = () => {
    const { categories, selectedCategory, setCategory, categoryImages, darkMode } = useStore();

    // Merge static 'All' image with NocoDB images
    const images = { All: ALL_CATEGORY_IMAGE, ...categoryImages };

    return (
        <section className="mb-6 mt-4">
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4 snap-x px-2" dir="rtl">
                {categories.map((category) => (
                    <button
                        key={category}
                        onClick={() => setCategory(category)}
                        className="flex flex-col items-center gap-2 group min-w-[70px] snap-start"
                    >
                        <div className={`
                            w-16 h-16 rounded-full overflow-hidden ring-2 transition-all duration-300 flex items-center justify-center relative
                            ${selectedCategory === category
                                ? 'ring-primary scale-110'
                                : `ring-transparent ${darkMode ? 'bg-gray-700' : 'bg-slate-200'} group-hover:ring-primary`}
                        `}>
                            {images[category] ? (
                                <img
                                    src={images[category]}
                                    alt={category}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-br from-slate-300 to-slate-400'}`}>
                                    <span className={`text-xl font-bold ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                                        {category.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>
                        <span className={`text-xs font-medium transition-colors whitespace-nowrap
                            ${selectedCategory === category
                                ? 'text-primary'
                                : darkMode
                                    ? 'text-gray-400 group-hover:text-primary'
                                    : 'text-slate-600 group-hover:text-primary'}`}>
                            {category}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default CategoryRail;
