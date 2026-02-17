import React from 'react';
import useStore from '../store/useStore';

const CategoryRail = () => {
    const { categories, selectedCategory, setCategory, categoryImages } = useStore();

    return (
        <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 px-1 text-slate-800">Browse Categories</h2>
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4 snap-x">
                {categories.map((category) => (
                    <button
                        key={category}
                        onClick={() => setCategory(category)}
                        className="flex flex-col items-center gap-2 group min-w-[80px] snap-start"
                    >
                        <div className={`
                            w-20 h-20 rounded-full overflow-hidden ring-2 transition-all duration-300 flex items-center justify-center relative
                            ${selectedCategory === category ? 'ring-primary scale-110' : 'ring-transparent bg-slate-200 group-hover:ring-primary'}
                        `}>
                            {categoryImages[category] ? (
                                <img
                                    src={categoryImages[category]}
                                    alt={category}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                /* Placeholder for category image - using a colored gradient based on name length for variety */
                                <div className={`w-full h-full bg-gradient-to-br from-slate-300 to-slate-400 opacity-80 group-hover:scale-110 transition-transform duration-500 flex items-center justify-center`}>
                                    <span className="text-xl font-bold text-slate-600">{category.charAt(0).toUpperCase()}</span>
                                </div>
                            )}
                        </div>
                        <span className={`text-sm font-medium transition-colors ${selectedCategory === category ? 'text-primary' : 'text-slate-600 group-hover:text-primary'}`}>
                            {category}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default CategoryRail;
