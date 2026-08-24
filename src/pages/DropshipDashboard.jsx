import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LogOut,
  Package,
  ShoppingCart,
  Truck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const SESSION_KEY = 'dropshipper_session';

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || parsed?.status !== 'active') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function makeOrderId() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DRP-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function formatMad(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} د.م`;
}

function DropshipDashboard() {
  const [user, setUser] = useState(() => loadSession());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  const [orderProduct, setOrderProduct] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');

  const estimatedProfit = useMemo(() => {
    if (!orderProduct) return 0;
    const qty = Math.max(1, Number(quantity) || 1);
    const unit = Number(orderProduct.dropship_price) - Number(orderProduct.wholesale_price);
    return unit * qty - Number(orderProduct.shipping_cost || 0);
  }, [orderProduct, quantity]);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError('');
    try {
      const { data, error } = await supabase
        .from('dropship_products')
        .select('sku, name, image_url, wholesale_price, dropship_price, shipping_cost, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('[dropship] products:', err);
      setProductsError(err?.message || 'تعذر تحميل المنتجات');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user, fetchProducts]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const { data, error } = await supabase
        .from('dropshippers')
        .select('id, username, full_name, phone, status')
        .eq('username', username.trim())
        .eq('password', password)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة.');
        return;
      }
      if (String(data.status || '').toLowerCase() !== 'active') {
        setLoginError('الحساب غير مفعّل. تواصل مع الإدارة.');
        return;
      }

      saveSession(data);
      setUser(data);
      setPassword('');
    } catch (err) {
      console.error('[dropship] login:', err);
      setLoginError(err?.message || 'تعذر تسجيل الدخول');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setProducts([]);
    setOrderProduct(null);
    setOrderSuccess('');
  };

  const openOrderModal = (product) => {
    setOrderProduct(product);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerCity('');
    setQuantity(1);
    setOrderError('');
    setOrderSuccess('');
  };

  const closeOrderModal = () => {
    if (orderBusy) return;
    setOrderProduct(null);
    setOrderError('');
  };

  const handlePlaceOrder = async (event) => {
    event.preventDefault();
    if (!orderProduct || !user) return;

    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const city = customerCity.trim();

    if (!name || !phone || !city) {
      setOrderError('أكمل اسم الزبون والهاتف والمدينة.');
      return;
    }

    setOrderBusy(true);
    setOrderError('');
    setOrderSuccess('');

    try {
      const wholesale = Number(orderProduct.wholesale_price) || 0;
      const sale = Number(orderProduct.dropship_price) || 0;
      const shipping = Number(orderProduct.shipping_cost) || 0;
      const profit = (sale - wholesale) * qty - shipping;
      const orderId = makeOrderId();

      const { error } = await supabase.from('dropship_orders').insert({
        order_id: orderId,
        dropshipper_id: user.id,
        customer_name: name,
        customer_phone: phone,
        customer_city: city,
        product_sku: orderProduct.sku,
        quantity: qty,
        sale_price: sale,
        shipping_cost: shipping,
        wholesale_price: wholesale,
        profit,
        status: 'pending',
      });

      if (error) throw error;

      setOrderSuccess(`تم إرسال الطلب ${orderId}`);
      setTimeout(() => {
        setOrderProduct(null);
        setOrderSuccess('');
      }, 1600);
    } catch (err) {
      console.error('[dropship] order:', err);
      setOrderError(err?.message || 'تعذر إنشاء الطلب');
    } finally {
      setOrderBusy(false);
    }
  };

  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        style={{
          direction: 'rtl',
          background:
            'radial-gradient(1200px 600px at 10% -10%, #dbeafe 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #e0f2fe 0%, transparent 50%), #f6f7f8',
        }}
      >
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/60 p-7 sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package size={28} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">لوحة الدروبشيبينغ</h1>
            <p className="mt-2 text-sm text-slate-500">سجّل الدخول لإدارة منتجاتك وطلباتك</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">اسم المستخدم</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                placeholder="username"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">كلمة المرور</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                placeholder="••••••••"
              />
            </label>

            {loginError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
            >
              {loginBusy ? <Loader2 size={16} className="animate-spin" /> : null}
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light text-slate-800" style={{ direction: 'rtl' }}>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div>
            <p className="text-xs font-bold text-primary">Errayhany Dropship</p>
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">
              مرحباً، {user.full_name || user.username}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={14} />
            خروج
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">المنتجات النشطة</h2>
            <p className="mt-1 text-sm text-slate-500">اختر منتجاً وأرسل طلب زبون مباشرة</p>
          </div>
          <button
            type="button"
            onClick={fetchProducts}
            disabled={productsLoading}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            تحديث
          </button>
        </div>

        {productsError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{productsError}</span>
          </div>
        )}

        {productsLoading && !products.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-primary">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-sm text-slate-500">جاري تحميل المنتجات...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            لا توجد منتجات نشطة حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.sku}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100"
              >
                <div className="aspect-[4/3] bg-slate-50">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-contain p-3"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <Package size={40} />
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="font-mono text-[11px] font-bold text-slate-400">{product.sku}</p>
                    <h3 className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">{product.name}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-emerald-50 px-2.5 py-2">
                      <div className="text-emerald-700/70">سعر الدروبشيب</div>
                      <div className="mt-0.5 font-black text-emerald-700">{formatMad(product.dropship_price)}</div>
                    </div>
                    <div className="rounded-xl bg-sky-50 px-2.5 py-2">
                      <div className="flex items-center gap-1 text-sky-700/70">
                        <Truck size={12} />
                        الشحن
                      </div>
                      <div className="mt-0.5 font-black text-sky-700">{formatMad(product.shipping_cost)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openOrderModal(product)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
                  >
                    <ShoppingCart size={15} />
                    إنشاء طلب
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {orderProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="إغلاق"
            onClick={closeOrderModal}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">إنشاء طلب</h3>
                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{orderProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={closeOrderModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-3.5">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">اسم الزبون</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">هاتف الزبون</span>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  inputMode="tel"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="06xxxxxxxx"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">المدينة</span>
                <input
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">الكمية</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <span>سعر البيع للوحدة</span>
                  <strong>{formatMad(orderProduct.dropship_price)}</strong>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span>الشحن</span>
                  <strong>{formatMad(orderProduct.shipping_cost)}</strong>
                </div>
                <div className="mt-1 flex justify-between gap-2 text-emerald-700">
                  <span>الربح المتوقع</span>
                  <strong>{formatMad(estimatedProfit)}</strong>
                </div>
              </div>

              {orderError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}
              {orderSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{orderSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={orderBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {orderBusy ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                تأكيد الطلب
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DropshipDashboard;
