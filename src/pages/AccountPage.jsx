import React, { useState, useEffect } from 'react';
import {
    Package, Clock, Truck, CheckCircle, XCircle, ArrowRight, Loader2,
    ShoppingBag, User, LogOut, ChevronDown, ChevronUp, ShieldCheck,
    RotateCcw, MapPin,
} from 'lucide-react';
import useStore from '../store/useStore';
import { auth } from '../services/firebase';
import PhoneVerificationCard from '../components/PhoneVerificationCard';
import BottomNavBar from '../components/BottomNavBar';
import CartSidebar from '../components/CartSidebar';
import WishlistSidebar from '../components/WishlistSidebar';
import AuthModal from '../components/AuthModal';
import {
    formatMoroccanPhone,
    isCustomerAccountsConfigured,
    normalizeMoroccanPhone,
    syncCustomerAccount,
} from '../services/customerAccount';
import { saveCloudAccount } from '../services/cloudAccount';
import { fetchAccountOrders } from '../services/orderTracking';

const statusStyles = {
    pending: { icon: Clock, border: 'border-yellow-500/30', bg: 'from-yellow-500/20 to-amber-500/20', text: 'text-yellow-500', label: 'قيد المراجعة', step: 1 },
    confirmed: { icon: ShieldCheck, border: 'border-indigo-500/30', bg: 'from-indigo-500/20 to-violet-500/20', text: 'text-indigo-500', label: 'تم التأكيد', step: 2 },
    shipped: { icon: Truck, border: 'border-green-500/30', bg: 'from-green-500/20 to-emerald-500/20', text: 'text-green-500', label: 'تم الشحن', step: 3 },
    delivered: { icon: CheckCircle, border: 'border-blue-500/30', bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-500', label: 'تم التوصيل', step: 4 },
    cancelled: { icon: XCircle, border: 'border-red-500/30', bg: 'from-red-500/20 to-rose-500/20', text: 'text-red-500', label: 'ملغي', step: 0 },
    returned: { icon: RotateCcw, border: 'border-orange-500/30', bg: 'from-orange-500/20 to-amber-500/20', text: 'text-orange-500', label: 'مرتجع', step: 0 },
};

const progressSteps = [
    { label: 'تم الاستلام', icon: ShoppingBag, step: 1 },
    { label: 'تم التأكيد', icon: ShieldCheck, step: 2 },
    { label: 'تم الشحن', icon: Truck, step: 3 },
    { label: 'تم التوصيل', icon: CheckCircle, step: 4 },
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
    const [needsPhone, setNeedsPhone] = useState(false);

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
            setNeedsPhone(false);
            return undefined;
        }
        loadAccount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]);

    const loadTifawtOrders = async () => {
        const idToken = await user.getIdToken();
        const result = await fetchAccountOrders(idToken);
        setOrders(result.orders);
        setNeedsPhone(false);
        if (result.phone) {
            setCustomerInfo({
                ...customerInfo,
                uid: user.uid,
                phone: formatMoroccanPhone(result.phone) || customerInfo?.phone || '',
                normalizedPhone: normalizeMoroccanPhone(result.phone),
                phoneVerified: true,
            });
        }
        return result;
    };

    const loadAccount = async () => {
        setLoading(true);
        setAccountError('');
        setNeedsPhone(false);

        try {
            if (isCustomerAccountsConfigured) {
                const account = await syncCustomerAccount(user);
                setCustomerInfo({
                    ...account.customerInfo,
                    ...(customerInfo?.uid === user.uid ? customerInfo : {}),
                    uid: user.uid,
                });
                if (account.requiresPhoneVerification) {
                    setNeedsPhone(true);
                    setOrders([]);
                    setLoading(false);
                    return;
                }
            } else if (!userPhone) {
                setNeedsPhone(true);
                setOrders([]);
                setLoading(false);
                return;
            }

            await loadTifawtOrders();
        } catch (err) {
            console.error('Error loading account orders:', err);
            if (err?.requiresPhoneVerification || err?.code === 'phone_not_linked') {
                setNeedsPhone(true);
                setOrders([]);
                setAccountError('');
            } else {
                setAccountError(err?.message || 'تعذر تحميل الطلبات من تيفاوت.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchMyOrders = async () => {
        if (!user) return;
        setLoading(true);
        setAccountError('');
        try {
            await loadTifawtOrders();
        } catch (err) {
            console.error('Error refreshing account orders:', err);
            if (err?.requiresPhoneVerification || err?.code === 'phone_not_linked') {
                setNeedsPhone(true);
                setOrders([]);
            } else {
                setAccountError(err?.message || 'تعذر تحديث الطلبات حالياً.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneVerified = async (profile) => {
        const verifiedInfo = {
            ...customerInfo,
            ...profile,
            uid: user.uid,
            phoneVerified: true,
        };
        setCustomerInfo(verifiedInfo);
        setNeedsPhone(false);
        setLoading(true);
        setAccountError('');
        try {
            // Persist email↔phone link in Firestore so the bot can resolve it
            // on later visits (even without NocoDB Customers table).
            await saveCloudAccount(user, {
                ...useStore.getState(),
                customerInfo: verifiedInfo,
            });
            await new Promise((r) => setTimeout(r, 300));
            await loadTifawtOrders();
        } catch (err) {
            console.error('Error linking verified phone orders:', err);
            setAccountError(err?.message || 'تم توثيق الهاتف، لكن تعذر تحديث الطلبات حالياً.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ar-MA', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const getStatus = (order) => {
        const style = statusStyles[order.status] || statusStyles.pending;
        return {
            ...style,
            label: order.statusLabel || style.label,
            step: Number(order.step) || style.step,
        };
    };

    const handleLogout = async () => {
        clearCustomerInfo();
        await auth.signOut();
        window.location.href = '/';
    };

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
                        <button onClick={() => { window.location.href = '/'; }}
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
                        سجّل الدخول ثم وثّق رقم هاتفك عبر SMS لعرض طلباتك من تيفاوت — طلباتك أنت فقط.
                    </p>
                    <button
                        onClick={() => setAuthModalOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 px-8 rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 text-sm"
                    >
                        تسجيل الدخول الآن
                    </button>
                    <button onClick={() => { window.location.href = '/'; }}
                        className={`block mx-auto text-xs font-medium mt-2 ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}>
                        العودة للمتجر ←
                    </button>
                </main>
                <AuthModal />
            </div>
        );
    }

    const pendingCount = orders.filter((o) => ['pending', 'confirmed'].includes(o.status)).length;
    const shippedCount = orders.filter((o) => o.status === 'shipped').length;
    const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

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
                            <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                {userName || formatMoroccanPhone(userPhone) || user?.email}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { window.location.href = '/'; }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${dm ? 'text-gray-400 hover:bg-gray-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <ArrowRight size={14} />
                            المتجر
                        </button>
                        <button onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
                <div className={`rounded-2xl border p-5 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'} shadow-sm`}>
                    <div className="flex items-center gap-4">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-14 h-14 rounded-2xl border shadow-sm" />
                        ) : (
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${dm ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                {(userName || '?')[0]}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold truncate">{userName || 'مستخدم'}</h2>
                            <p className={`text-xs truncate ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                {user?.email || ''}
                            </p>
                            {(userPhone || customerInfo?.phone) && (
                                <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                    <ShieldCheck size={12} className="text-green-500" />
                                    {formatMoroccanPhone(userPhone) || customerInfo.phone}
                                    <span>· مربوط بالحساب</span>
                                </p>
                            )}
                        </div>
                        <div className={`text-center px-4 py-2 rounded-xl ${dm ? 'bg-gray-800' : 'bg-blue-50'}`}>
                            <p className={`text-2xl font-extrabold ${dm ? 'text-blue-400' : 'text-blue-600'}`}>{orders.length}</p>
                            <p className={`text-[10px] font-medium ${dm ? 'text-gray-500' : 'text-slate-400'}`}>طلبات</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'قيد المعالجة', count: pendingCount, color: 'text-yellow-500' },
                        { label: 'تم الشحن', count: shippedCount, color: 'text-green-500' },
                        { label: 'تم التوصيل', count: deliveredCount, color: 'text-blue-500' },
                    ].map((stat) => (
                        <div key={stat.label} className={`rounded-xl border p-3 text-center ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <p className={`text-xl font-extrabold ${stat.color}`}>{stat.count}</p>
                            <p className={`text-[10px] font-medium mt-0.5 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{stat.label}</p>
                        </div>
                    ))}
                </div>

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

                {!loading && needsPhone && (
                    <div className={`py-6 text-center rounded-2xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <PhoneVerificationCard
                            user={user}
                            darkMode={dm}
                            onVerified={handlePhoneVerified}
                        />
                        <p className={`text-[11px] mt-3 px-4 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                            نربط رقم الهاتف ببريدك بعد رمز SMS، حتى لا يرى أحد طلبات غيرك.
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="py-16 flex flex-col items-center justify-center text-blue-500">
                        <Loader2 size={40} className="animate-spin mb-4" />
                        <p className="text-sm font-medium">جاري تحميل طلباتك من تيفاوت...</p>
                    </div>
                )}

                {!loading && !needsPhone && orders.length === 0 && (
                    <div className={`py-16 text-center rounded-2xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${dm ? 'bg-gray-800' : 'bg-slate-100'}`}>
                            <ShoppingBag size={32} className={dm ? 'text-gray-600' : 'text-slate-300'} />
                        </div>
                        <p className={`text-sm font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>لا توجد طلبات بعد</p>
                        <p className={`text-xs ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
                            عندما تطلب بهذا الرقم ستظهر طلباتك هنا من تيفاوت.
                        </p>
                        <a href="/" className="inline-block mt-4 text-xs font-bold text-blue-500 hover:underline">تصفح المنتجات ←</a>
                    </div>
                )}

                {!loading && orders.map((order) => {
                    const status = getStatus(order);
                    const StatusIcon = status.icon;
                    const isStopped = status.step === 0;
                    const isExpanded = expandedOrder === order.id;
                    const items = order.products || [];

                    return (
                        <div key={order.id}
                            className={`rounded-2xl border overflow-hidden transition-all ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'} shadow-sm`}
                        >
                            <div
                                className={`p-4 cursor-pointer transition-colors ${dm ? 'hover:bg-gray-800/50' : 'hover:bg-slate-50'}`}
                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                            >
                                <div className="flex items-center justify-between mb-2 gap-2">
                                    <div className="min-w-0">
                                        <p className={`text-xs font-bold truncate ${dm ? 'text-gray-300' : 'text-slate-700'}`}>
                                            {order.reference || order.id}
                                        </p>
                                        <p className={`text-[10px] mt-0.5 ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
                                            {formatDate(order.createdAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.border} bg-gradient-to-r ${status.bg} ${status.text}`}>
                                            <StatusIcon size={10} />
                                            {status.label}
                                        </div>
                                        {isExpanded
                                            ? <ChevronUp size={14} className={dm ? 'text-gray-500' : 'text-slate-400'} />
                                            : <ChevronDown size={14} className={dm ? 'text-gray-500' : 'text-slate-400'} />}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                        {items.length > 0 ? `${items.length} منتج` : ''}
                                    </span>
                                    <span className="text-sm font-extrabold text-green-500">{order.total || 0} DH</span>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                    {!isStopped ? (
                                        <div className="px-6 py-5">
                                            <div className="flex items-center justify-between relative">
                                                <div className={`absolute top-5 right-5 left-5 h-0.5 ${dm ? 'bg-gray-800' : 'bg-slate-200'}`} />
                                                <div className="absolute top-5 right-5 h-0.5 bg-blue-500 transition-all duration-500"
                                                    style={{ width: `${Math.max(0, Math.min(3, status.step - 1)) * 33.33}%` }} />
                                                {progressSteps.map((step) => {
                                                    const StepIcon = step.icon;
                                                    const isActive = status.step >= step.step;
                                                    const isCurrent = status.step === step.step;
                                                    return (
                                                        <div key={step.step} className="relative z-10 flex flex-col items-center gap-2">
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
                                    ) : (
                                        <div className="px-6 py-4 text-center">
                                            <p className={`text-sm font-bold ${status.text}`}>{status.label}</p>
                                        </div>
                                    )}

                                    {(order.trackingNumber || order.shippingCompany || order.city) && (
                                        <div className={`px-4 py-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] ${dm ? 'border-gray-800 text-gray-400' : 'border-slate-100 text-slate-500'}`}>
                                            {order.shippingCompany && (
                                                <span className="flex items-center gap-1"><Truck size={12} /> {order.shippingCompany}</span>
                                            )}
                                            {order.city && (
                                                <span className="flex items-center gap-1"><MapPin size={12} /> {order.city}</span>
                                            )}
                                            {order.trackingNumber && (
                                                <span className="font-mono" dir="ltr">{order.trackingNumber}</span>
                                            )}
                                        </div>
                                    )}

                                    {items.length > 0 && (
                                        <div className={`px-4 py-3 border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            <p className={`text-[10px] font-bold mb-2 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المنتجات</p>
                                            <div className="space-y-2">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${dm ? 'bg-gray-800/50' : 'bg-slate-50'}`}>
                                                        <span className="text-xs font-medium truncate flex-1">{item.name || item.sku}</span>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            <span className={dm ? 'text-gray-500' : 'text-slate-400'}>×{item.quantity}</span>
                                                            <span className="font-bold text-green-500">
                                                                {item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1)} DH
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {order.address && (
                                        <div className={`px-4 py-3 border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            <p className={`text-[10px] font-bold mb-1 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>عنوان التوصيل</p>
                                            <p className={`text-xs ${dm ? 'text-gray-300' : 'text-slate-600'}`}>{order.address}</p>
                                        </div>
                                    )}

                                    <div className={`px-4 py-3 border-t flex items-center justify-between ${dm ? 'border-gray-800 bg-gray-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
                                        <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المجموع الكلي</span>
                                        <span className="text-lg font-extrabold text-green-500">{order.total || 0} DH</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

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
