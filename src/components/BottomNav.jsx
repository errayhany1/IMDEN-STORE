import React from 'react';
import { Home, Menu, ShoppingCart, User } from 'lucide-react';
import useStore from '../store/useStore';

const BottomNav = ({ setSidebarOpen }) => {
    const { cart, darkMode, user, setAuthModalOpen } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    const handleAccountClick = () => {
        if (user) {
            window.location.href = '/account';
        } else {
            setAuthModalOpen(true);
        }
    };

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe glass-header`}>
            <div className="flex justify-around items-center h-16 px-2">
                <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-primary'}`}
                >
                    <Home size={22} />
                    <span className="text-[10px] font-medium">الرئيسية</span>
                </button>

                <button 
                    onClick={() => setSidebarOpen(true)}
                    className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-primary'}`}
                >
                    <Menu size={22} />
                    <span className="text-[10px] font-medium">القائمة</span>
                </button>

                <button 
                    onClick={() => useStore.getState().toggleCart()}
                    className={`relative flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-primary'}`}
                >
                    <div className="relative">
                        <ShoppingCart size={22} />
                        {cartCount > 0 && (
                            <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                                {cartCount > 99 ? '99+' : cartCount}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-medium">السلة</span>
                </button>

                <button 
                    onClick={handleAccountClick}
                    className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-primary'}`}
                >
                    <User size={22} />
                    <span className="text-[10px] font-medium">حسابي</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
