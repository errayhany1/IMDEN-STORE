import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, CheckCircle, XCircle, ArrowRight, Loader2, ShoppingBag, User, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import useStore from '../store/useStore';
import { auth } from '../services/firebase';
import PhoneVerificationCard from '../components/PhoneVerificationCard';
import BottomNavBar from '../components/BottomNavBar';
import CartSidebar from '../components/CartSidebar';
import WishlistSidebar from '../components/WishlistSidebar';
import AuthModal from '../components/AuthModal';
import {
    getOrdersForAccount,
    isCustomerAccountsConfigured,
    normalizeMoroccanPhone,
    syncCustomerAccount,
} from '../services/customerAccount';

const statusConfig = {
    'قيد المراجعة': { icon: Clock, color: 'yellow', bg: 'from-yellow-500/20 to-amber-500/20', border: 'border-yellow-500/30', text: 'text-yellow-500', label: 'قيد المراجعة', step: 1 },
    'تم الشحن': { icon: Truck, color: 'green', bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', text: 'text-green-500', label: 'تم الشحن', step: 2 },
    'تم التوصيل': { icon: CheckCircle, color: 'blue', bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-500', label: 'تم التوصيل', step: 3 },
    'ملغي': { icon: XCircle, color: 'red', bg: 'from-red-500/20 to-rose-500/20', border: 'border-red-500/30', text: 'text-red-500', label: 'ملغي', step: 0 },
};

const progressSteps = [
    { label: 'تم الاستلام', icon: ShoppingBag, step: 1 },
    { label: 'تم الشحن', icon: Truck, step: 2 },
    { label: 'تم التوصيل', icon: CheckCircle, step: 3 },
];

const AccountPage = () => {
    const {
        darkMode,
        user,
        setAuthModalOpen,
        customerInfo,
        setCustomerInfo,
        clearCustomerInfo,
    } = useStore();
    const dm = darkMode;

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [accountError, setAccountError] = useState('');

    const profileBelongsToUser = Boolean(
        user?.uid && customerInfo?.uid === user.uid
    );
    const userPhone = normalizeMoroccanPhone(user?.phoneNumber) || (
        profileBelongsToUser && customerInfo?.phoneVerified
            ? normalizeMoroccanPhone(
                customerInfo.normalizedPhone || customerInfo.phone
            )
            : ''
    );
    const userName = (
        profileBelongsToUser ? customerInfo?.name : ''
    ) || user?.displayName || '';

    useEffect(() => {
        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        loadAccount();
        // Account sync is intentionally keyed by Firebase identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]);

    const loadAccount = async () => {
        setLoading(true);
        setAccountError('');
        if (!isCustomerAccountsConfigured) {
            setOrders([]);
            setAccountError('خدمة الطلبات غير مكتملة الإعداد في Easypanel.');
            setLoading(false);
            return;
        }
        try {
            const account = await syncCustomerAccount(user);
            setCustomerInfo({
                ...account.customerInfo,
                ...(customerInfo?.uid === user.uid ? customerInfo : {}),
                uid: user.uid,
            });
            setOrders(account.orders);
        } catch (err) {
            console.error("Error fetching user orders:", err);
            setAccountError('تعذر تحميل ملف الحساب. تحقق من إعداد جدول Customers ثم حاول مجدداً.');
        } finally {
            setLoading(false);
        }
    };

    const fetchMyOrders = async () => {
        if (!user) return;
        setLoading(true);
        setAccountError('');
        try {
            const result = await getOrdersForAccount({
                uid: user.uid,
                phone: userPhone,
            });
            setOrders(result);
        } catch (err) {
            console.error('Error refreshing account orders:', err);
            setAccountError('تعذر تحديث الطلبات حالياً.');
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneVerified = async profile => {
        const verifiedInfo = {
            ...customerInfo,
            ...profile,
            uid: user.uid,
            phoneVerified: true,
        };
        setCustomerInfo(verifiedInfo);
        setLoading(true);
        setAccountError('');
        try {
            const result = await getOrdersForAccount({
                uid: user.uid,
                phone: profile.normalizedPhone || profile.phone,
            });
            setOrders(result);
        } catch (err) {
            console.error('Error linking verified phone orders:', err);
            setAccountError('تم توثيق الهاتف، لكن تعذر تحديث الطلبات حالياً.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatus = (order) => {
        const raw = order.Status || 'قيد المراجعة';
        const s = raw === 'Pending' ? 'قيد المراجعة' : raw;
        return statusConfig[s] || statusConfig['قيد المراجعة'];
    };

    const handleLogout = async () => {
        clearCustomerInfo();
        await auth.signOut();
        window.location.href = '/';
    };

    // Orders are private: a locally saved phone is never enough to display them.
    if (!user) {
        return (
            <div className={`min-h-screen ${dm ? 'bg-gray-950 text-white' : 'bg-gradient-to-br from-slate-50 to-blue-50 text-slate-900'}`}>
                <header className={`border-b backdrop-blur-xl sticky top-0 z-10 ${dm ? 'bg-gray-950/90 border-gray-800' : 'bg-white/80 border-slate-200'}`}>
                    <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <User size={18} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-sm font-extrabold tracking-tight">حسابي</h1>
                                <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>Errayhany Store</p>
                            </div>
                        </div>
                        <button onClick={() => window.location.href = '/'}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${dm ? 'text-gray-400 hover:bg-gray-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <ArrowRight size={14} />
                            العودة للمتجر
                        </button>
                    </div>
                </header>

                <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 ${dm ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                        <User size={40} className="text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold">سجل دخولك لعرض طلباتك</h2>
                    <p className={`text-sm max-w-sm mx-auto ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                        قم بتسجيل الدخول لتتمكن من متابعة جميع طلباتك السابقة وحالة كل طلب بالتفصيل.
                    </p>
                    <button 
                        onClick={() => setAuthModalOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 px-8 rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 text-sm"
                    >
                        تسجيل الدخول الآن
                    </button>
                    <button onClick={() => window.location.href = '/'}
                        className={`block mx-auto text-xs font-medium mt-2 ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}>
                        العودة للمتجر ←
                    </button>
                </main>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${dm ? 'bg-gray-950 text-white' : 'bg-gradient-to-br from-slate-50 to-blue-50 text-slate-900'}`}>
            {/* Header */}
            <header className={`border-b backdrop-blur-xl sticky top-0 z-10 ${dm ? 'bg-gray-950/90 border-gray-800' : 'bg-white/80 border-slate-200'}`}>
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <User size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold tracking-tight">حسابي</h1>
                            <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{userName || userPhone}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => window.location.href = '/'}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${dm ? 'text-gray-400 hover:bg-gray-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <ArrowRight size={14} />
                            المتجر
                        </button>
                        {user && (
                            <button onClick={handleLogout}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                                <LogOut size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
                {/* User Info Card */}
                <div className={`rounded-2xl border p-5 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'} shadow-sm`}>
                    <div className="flex items-center gap-4">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-14 h-14 rounded-2xl border shadow-sm" />
                        ) : (
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${dm ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                {(userName || '?')[0]}
                            </div>
                        )}
                        <div className="flex-1">
                            <h2 className="text-lg font-bold">{userName || 'مستخدم'}</h2>
                            <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                {user?.email || userPhone || ''}
                            </p>
                        </div>
                        <div className={`text-center px-4 py-2 rounded-xl ${dm ? 'bg-gray-800' : 'bg-blue-50'}`}>
                            <p className={`text-2xl font-extrabold ${dm ? 'text-blue-400' : 'text-blue-600'}`}>{orders.length}</p>
                            <p className={`text-[10px] font-medium ${dm ? 'text-gray-500' : 'text-slate-400'}`}>طلبات</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'قيد المراجعة', count: orders.filter(o => ['Pending', 'قيد المراجعة'].includes(o.Status || 'قيد المراجعة')).length, color: 'yellow' },
                        { label: 'تم الشحن', count: orders.filter(o => o.Status === 'تم الشحن').length, color: 'green' },
                        { label: 'تم التوصيل', count: orders.filter(o => o.Status === 'تم التوصيل').length, color: 'blue' },
                    ].map((stat, i) => (
                        <div key={i} className={`rounded-xl border p-3 text-center ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <p className={`text-xl font-extrabold text-${stat.color}-500`}>{stat.count}</p>
                            <p className={`text-[10px] font-medium mt-0.5 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Orders Title */}
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold flex items-center gap-2">
                        <Package size={18} className="text-blue-500" />
                        سجل الطلبات
                    </h3>
                    <button onClick={fetchMyOrders} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${dm ? 'text-gray-400 hover:bg-gray-800' : 'text-slate-400 hover:bg-slate-100'}`}>
                        تحديث
                    </button>
                </div>

                {accountError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs text-red-600">
                        {accountError}
                    </div>
                )}

                {!loading && isCustomerAccountsConfigured && user && !userPhone && (
                    <div className={`py-6 text-center rounded-2xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <PhoneVerificationCard
                            user={user}
                            darkMode={dm}
                            onVerified={handlePhoneVerified}
                        />
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="py-16 flex flex-col items-center justify-center text-blue-500">
                        <Loader2 size={40} className="animate-spin mb-4" />
                        <p className="text-sm font-medium">جاري تحميل طلباتك...</p>
                    </div>
                )}

                {/* Empty */}
                {!loading && orders.length === 0 && (
                    <div className={`py-16 text-center rounded-2xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${dm ? 'bg-gray-800' : 'bg-slate-100'}`}>
                            <ShoppingBag size={32} className={dm ? 'text-gray-600' : 'text-slate-300'} />
                        </div>
                        <p className={`text-sm font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>لا توجد طلبات بعد</p>
                        <p className={`text-xs ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
                            {userPhone
                                ? 'عندما تقوم بعملية شراء وأنت مسجّل الدخول، ستظهر طلباتك هنا.'
                                : 'وثّق هاتفك أعلاه لربط الطلبات القديمة، أو اطلب وأنت مسجّل الدخول لحفظ الطلبات الجديدة.'}
                        </p>
                        <a href="/" className="inline-block mt-4 text-xs font-bold text-blue-500 hover:underline">تصفح المنتجات ←</a>
                    </div>
                )}

                {/* Order Cards */}
                {!loading && orders.map(order => {
                    const status = getStatus(order);
                    const StatusIcon = status.icon;
                    const isCancelled = (order.Status || '') === 'ملغي';
                    const currentStep = status.step;
                    const isExpanded = expandedOrder === order.Id;

                    let items = [];
                    try {
                        items = JSON.parse(order['Order Metadata'] || '[]');
                    } catch {
                        items = [];
                    }

                    return (
                        <div key={order.Id} 
                            className={`rounded-2xl border overflow-hidden transition-all ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'} shadow-sm`}
                        >
                            {/* Order Header - Clickable */}
                            <div 
                                className={`p-4 cursor-pointer transition-colors ${dm ? 'hover:bg-gray-800/50' : 'hover:bg-slate-50'}`}
                                onClick={() => setExpandedOrder(isExpanded ? null : order.Id)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-mono font-bold ${dm ? 'text-gray-400' : 'text-slate-500'}`}>طلب #{order.Id}</span>
                                        <span className={`text-[10px] ${dm ? 'text-gray-600' : 'text-slate-400'}`}>• {formatDate(order.CreatedAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.border} bg-gradient-to-r ${status.bg} ${status.text}`}>
                                            <StatusIcon size={10} />
                                            {status.label}
                                        </div>
                                        {isExpanded ? <ChevronUp size={14} className={dm ? 'text-gray-500' : 'text-slate-400'} /> : <ChevronDown size={14} className={dm ? 'text-gray-500' : 'text-slate-400'} />}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                        {items.length > 0 ? `${items.length} منتج` : ''} 
                                    </span>
                                    <span className="text-sm font-extrabold text-green-500">{order['Sale Price'] || 0} DH</span>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                    {/* Progress Bar */}
                                    {!isCancelled && (
                                        <div className="px-6 py-5">
                                            <div className="flex items-center justify-between relative">
                                                <div className={`absolute top-5 right-5 left-5 h-0.5 ${dm ? 'bg-gray-800' : 'bg-slate-200'}`} />
                                                <div className="absolute top-5 right-5 h-0.5 bg-blue-500 transition-all duration-500"
                                                    style={{ width: currentStep >= 3 ? '100%' : currentStep >= 2 ? '50%' : '0%' }} />
                                                {progressSteps.map((step, idx) => {
                                                    const StepIcon = step.icon;
                                                    const isActive = currentStep >= step.step;
                                                    const isCurrent = currentStep === step.step;
                                                    return (
                                                        <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                                                ${isCurrent ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110' 
                                                                    : isActive ? 'bg-blue-500 border-blue-500 text-white' 
                                                                    : `${dm ? 'bg-gray-800 border-gray-700 text-gray-600' : 'bg-slate-100 border-slate-300 text-slate-400'}`}`}>
                                                                <StepIcon size={16} />
                                                            </div>
                                                            <span className={`text-[10px] font-bold ${isActive ? 'text-blue-500' : dm ? 'text-gray-600' : 'text-slate-400'}`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cancelled */}
                                    {isCancelled && (
                                        <div className="px-6 py-4 text-center">
                                            <p className="text-red-500 text-sm font-bold">تم إلغاء هذا الطلب</p>
                                        </div>
                                    )}

                                    {/* Items */}
                                    {items.length > 0 && (
                                        <div className={`px-4 py-3 border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            <p className={`text-[10px] font-bold mb-2 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المنتجات</p>
                                            <div className="space-y-2">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${dm ? 'bg-gray-800/50' : 'bg-slate-50'}`}>
                                                        <span className="text-xs font-medium truncate flex-1">{item.name || item.ref}</span>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            <span className={dm ? 'text-gray-500' : 'text-slate-400'}>×{item.qty}</span>
                                                            <span className="font-bold text-green-500">{(item.price || 0) * (item.qty || 1)} DH</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Delivery Address */}
                                    {order['Delivery Address'] && (
                                        <div className={`px-4 py-3 border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            <p className={`text-[10px] font-bold mb-1 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>عنوان التوصيل</p>
                                            <p className={`text-xs ${dm ? 'text-gray-300' : 'text-slate-600'}`}>{order['Delivery Address']}</p>
                                        </div>
                                    )}

                                    {/* Footer */}
                                    <div className={`px-4 py-3 border-t flex items-center justify-between ${dm ? 'border-gray-800 bg-gray-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
                                        <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المجموع الكلي</span>
                                        <span className="text-lg font-extrabold text-green-500">{order['Sale Price'] || 0} DH</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Footer */}
                <div className={`text-center text-xs py-6 pb-28 md:pb-6 ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
                    <p>هل لديك سؤال حول طلبك؟</p>
                    <a href="https://wa.me/212664630566" target="_blank" rel="noopener noreferrer"
                        className="text-green-500 font-bold hover:underline mt-1 inline-block">
                        تواصل معنا عبر واتساب
                    </a>
                </div>
            </main>

            <CartSidebar />
            <WishlistSidebar />
            <AuthModal />
            <BottomNavBar />
        </div>
    );
};

export default AccountPage;
