import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  RefreshCw,
  Users,
  Package,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

const ORDER_STATUSES = ['pending', 'shipped', 'delivered', 'returned'];

const STATUS_LABELS = {
  pending: 'قيد الانتظار',
  shipped: 'تم الشحن',
  delivered: 'تم التوصيل',
  returned: 'مرتجع',
  active: 'نشط',
  inactive: 'موقوف',
};

function formatMad(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} د.م`;
}

function DropshipAdmin({ dm = false }) {
  const [tab, setTab] = useState('dropshippers');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [dropshippers, setDropshippers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [dsForm, setDsForm] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
  });

  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    image_url: '',
    wholesale_price: '',
    dropship_price: '',
    shipping_cost: '',
  });

  const card = dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200';
  const muted = dm ? 'text-gray-400' : 'text-slate-500';
  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 ${
    dm ? 'bg-gray-950 border-gray-700 text-gray-100' : 'bg-slate-50 border-slate-200'
  }`;
  const thCls = `p-3 text-right text-xs font-bold ${muted}`;
  const tdCls = 'p-3 text-sm';

  const flashOk = (msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(''), 2500);
  };

  const loadDropshippers = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('dropshippers')
      .select('id, username, full_name, phone, status')
      .order('full_name', { ascending: true });
    if (err) throw err;
    setDropshippers(data || []);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('dropship_products')
      .select('sku, name, image_url, wholesale_price, dropship_price, shipping_cost, is_active')
      .order('name', { ascending: true });
    if (err) throw err;
    setProducts(data || []);
  }, []);

  const loadOrders = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('dropship_orders')
      .select('id, order_id, dropshipper_id, customer_name, customer_phone, customer_city, product_sku, quantity, sale_price, shipping_cost, wholesale_price, profit, status')
      .order('id', { ascending: false });
    if (err) throw err;
    setOrders(data || []);
  }, []);

  const refreshAll = useCallback(async () => {
    setError('');
    setBusy('load');
    try {
      await Promise.all([loadDropshippers(), loadProducts(), loadOrders()]);
    } catch (err) {
      console.error('[dropship-admin]', err);
      setError(err?.message || 'تعذر تحميل بيانات الدروبشيبينغ');
    } finally {
      setBusy('');
    }
  }, [loadDropshippers, loadProducts, loadOrders]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const createDropshipper = async (event) => {
    event.preventDefault();
    setError('');
    setBusy('ds-create');
    try {
      const payload = {
        username: dsForm.username.trim(),
        password: dsForm.password,
        full_name: dsForm.full_name.trim(),
        phone: dsForm.phone.trim(),
        status: 'active',
      };
      if (!payload.username || !payload.password || !payload.full_name) {
        throw new Error('أكمل اسم المستخدم وكلمة المرور والاسم الكامل');
      }
      const { error: err } = await supabase.from('dropshippers').insert(payload);
      if (err) throw err;
      setDsForm({ username: '', password: '', full_name: '', phone: '' });
      await loadDropshippers();
      flashOk('تمت إضافة الدروبشيبر');
    } catch (err) {
      setError(err?.message || 'تعذر إنشاء الدروبشيبر');
    } finally {
      setBusy('');
    }
  };

  const createProduct = async (event) => {
    event.preventDefault();
    setError('');
    setBusy('product-create');
    try {
      const payload = {
        sku: productForm.sku.trim(),
        name: productForm.name.trim(),
        image_url: productForm.image_url.trim() || null,
        wholesale_price: Number(productForm.wholesale_price),
        dropship_price: Number(productForm.dropship_price),
        shipping_cost: Number(productForm.shipping_cost || 0),
        is_active: true,
      };
      if (!payload.sku || !payload.name) throw new Error('SKU والاسم مطلوبان');
      if (!Number.isFinite(payload.wholesale_price) || !Number.isFinite(payload.dropship_price)) {
        throw new Error('أدخل أسعار صحيحة');
      }
      const { error: err } = await supabase.from('dropship_products').insert(payload);
      if (err) throw err;
      setProductForm({
        sku: '',
        name: '',
        image_url: '',
        wholesale_price: '',
        dropship_price: '',
        shipping_cost: '',
      });
      await loadProducts();
      flashOk('تمت إضافة المنتج');
    } catch (err) {
      setError(err?.message || 'تعذر إضافة المنتج');
    } finally {
      setBusy('');
    }
  };

  const toggleProductActive = async (product) => {
    const next = !product.is_active;
    setBusy(`toggle-${product.sku}`);
    setError('');
    try {
      const { error: err } = await supabase
        .from('dropship_products')
        .update({ is_active: next })
        .eq('sku', product.sku);
      if (err) throw err;
      setProducts((prev) => prev.map((p) => (
        p.sku === product.sku ? { ...p, is_active: next } : p
      )));
    } catch (err) {
      setError(err?.message || 'تعذر تحديث حالة المنتج');
    } finally {
      setBusy('');
    }
  };

  const updateOrderStatus = async (order, status) => {
    if (order.status === status) return;
    setBusy(`order-${order.id}`);
    setError('');
    try {
      const { error: err } = await supabase
        .from('dropship_orders')
        .update({ status })
        .eq('id', order.id);
      if (err) throw err;
      setOrders((prev) => prev.map((o) => (
        o.id === order.id ? { ...o, status } : o
      )));
    } catch (err) {
      setError(err?.message || 'تعذر تحديث حالة الطلب');
    } finally {
      setBusy('');
    }
  };

  const tabs = [
    { id: 'dropshippers', label: 'الدروبشيبرز', icon: Users },
    { id: 'products', label: 'المنتجات', icon: Package },
    { id: 'orders', label: 'الطلبات', icon: ShoppingCart },
  ];

  return (
    <div className="space-y-4" style={{ direction: 'rtl' }}>
      <div className={`rounded-2xl border p-4 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">إدارة الدروبشيبينغ</h3>
            <p className={`mt-1 text-sm ${muted}`}>
              حسابات الموزعين، المنتجات، ومتابعة الطلبات
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={busy === 'load'}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 ${
              dm ? 'border-gray-700' : 'border-slate-200'
            }`}
          >
            <RefreshCw size={14} className={busy === 'load' ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                tab === id
                  ? 'bg-primary text-white'
                  : dm ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {okMsg && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
          {okMsg}
        </div>
      )}

      {tab === 'dropshippers' && (
        <div className="space-y-4">
          <form onSubmit={createDropshipper} className={`rounded-2xl border p-4 space-y-3 ${card}`}>
            <h4 className="font-bold">إضافة دروبشيبر</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>اسم المستخدم</span>
                <input
                  className={inputCls}
                  value={dsForm.username}
                  onChange={(e) => setDsForm((f) => ({ ...f, username: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>كلمة المرور</span>
                <input
                  type="text"
                  className={inputCls}
                  value={dsForm.password}
                  onChange={(e) => setDsForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>الاسم الكامل</span>
                <input
                  className={inputCls}
                  value={dsForm.full_name}
                  onChange={(e) => setDsForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>الهاتف</span>
                <input
                  className={inputCls}
                  value={dsForm.phone}
                  onChange={(e) => setDsForm((f) => ({ ...f, phone: e.target.value }))}
                  inputMode="tel"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy === 'ds-create'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'ds-create' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              حفظ
            </button>
          </form>

          <div className={`overflow-hidden rounded-2xl border ${card}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className={dm ? 'bg-gray-950' : 'bg-slate-50'}>
                  <tr>
                    <th className={thCls}>الاسم</th>
                    <th className={thCls}>المستخدم</th>
                    <th className={thCls}>الهاتف</th>
                    <th className={thCls}>الحالة</th>
                    <th className={thCls}>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {dropshippers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`p-8 text-center text-sm ${muted}`}>لا يوجد دروبشيبرز بعد</td>
                    </tr>
                  ) : dropshippers.map((row) => (
                    <tr key={row.id} className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                      <td className={`${tdCls} font-bold`}>{row.full_name}</td>
                      <td className={`${tdCls} font-mono text-xs`}>{row.username}</td>
                      <td className={tdCls}>{row.phone || '—'}</td>
                      <td className={tdCls}>
                        <span className={row.status === 'active' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                          {STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                      <td className={`${tdCls} font-mono text-xs ${muted}`}>{row.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <form onSubmit={createProduct} className={`rounded-2xl border p-4 space-y-3 ${card}`}>
            <h4 className="font-bold">إضافة منتج دروبشيب</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>SKU</span>
                <input
                  className={inputCls}
                  value={productForm.sku}
                  onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs font-bold sm:col-span-2">
                <span className={`mb-1 block ${muted}`}>الاسم</span>
                <input
                  className={inputCls}
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs font-bold sm:col-span-2 lg:col-span-3">
                <span className={`mb-1 block ${muted}`}>رابط الصورة</span>
                <input
                  className={inputCls}
                  value={productForm.image_url}
                  onChange={(e) => setProductForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                />
              </label>
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>سعر الجملة</span>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  value={productForm.wholesale_price}
                  onChange={(e) => setProductForm((f) => ({ ...f, wholesale_price: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>سعر الدروبشيب</span>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  value={productForm.dropship_price}
                  onChange={(e) => setProductForm((f) => ({ ...f, dropship_price: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-xs font-bold">
                <span className={`mb-1 block ${muted}`}>تكلفة الشحن</span>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  value={productForm.shipping_cost}
                  onChange={(e) => setProductForm((f) => ({ ...f, shipping_cost: e.target.value }))}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy === 'product-create'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'product-create' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              حفظ المنتج
            </button>
          </form>

          <div className={`overflow-hidden rounded-2xl border ${card}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className={dm ? 'bg-gray-950' : 'bg-slate-50'}>
                  <tr>
                    <th className={thCls}>صورة</th>
                    <th className={thCls}>SKU</th>
                    <th className={thCls}>الاسم</th>
                    <th className={thCls}>جملة</th>
                    <th className={thCls}>دروبشيب</th>
                    <th className={thCls}>شحن</th>
                    <th className={thCls}>نشط</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`p-8 text-center text-sm ${muted}`}>لا توجد منتجات بعد</td>
                    </tr>
                  ) : products.map((row) => (
                    <tr key={row.sku} className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                      <td className={tdCls}>
                        {row.image_url ? (
                          <img src={row.image_url} alt="" className="h-10 w-10 rounded-lg object-cover border" />
                        ) : (
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${dm ? 'border-gray-700' : 'border-slate-200'}`}>
                            <Package size={14} className={muted} />
                          </div>
                        )}
                      </td>
                      <td className={`${tdCls} font-mono text-xs`}>{row.sku}</td>
                      <td className={`${tdCls} max-w-[220px] truncate`} title={row.name}>{row.name}</td>
                      <td className={tdCls}>{formatMad(row.wholesale_price)}</td>
                      <td className={`${tdCls} font-bold text-emerald-600`}>{formatMad(row.dropship_price)}</td>
                      <td className={tdCls}>{formatMad(row.shipping_cost)}</td>
                      <td className={tdCls}>
                        <button
                          type="button"
                          disabled={busy === `toggle-${row.sku}`}
                          onClick={() => toggleProductActive(row)}
                          className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
                            row.is_active ? 'bg-emerald-500' : dm ? 'bg-gray-700' : 'bg-slate-300'
                          }`}
                          aria-label="تبديل الحالة"
                        >
                          <span
                            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                              row.is_active ? 'right-0.5' : 'right-5'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className={`overflow-hidden rounded-2xl border ${card}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className={dm ? 'bg-gray-950' : 'bg-slate-50'}>
                <tr>
                  <th className={thCls}>الزبون</th>
                  <th className={thCls}>الهاتف</th>
                  <th className={thCls}>SKU</th>
                  <th className={thCls}>سعر البيع</th>
                  <th className={thCls}>الربح</th>
                  <th className={thCls}>Dropshipper</th>
                  <th className={thCls}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`p-8 text-center text-sm ${muted}`}>لا توجد طلبات بعد</td>
                  </tr>
                ) : orders.map((row) => (
                  <tr key={row.id} className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <td className={`${tdCls} font-bold`}>
                      <div>{row.customer_name}</div>
                      <div className={`text-[11px] font-mono ${muted}`}>{row.order_id}</div>
                    </td>
                    <td className={tdCls}>{row.customer_phone}</td>
                    <td className={`${tdCls} font-mono text-xs`}>
                      {row.product_sku}
                      {row.quantity > 1 ? ` ×${row.quantity}` : ''}
                    </td>
                    <td className={tdCls}>{formatMad(row.sale_price)}</td>
                    <td className={`${tdCls} font-bold text-emerald-600`}>{formatMad(row.profit)}</td>
                    <td className={`${tdCls} font-mono text-xs`}>{row.dropshipper_id}</td>
                    <td className={tdCls}>
                      <select
                        value={row.status || 'pending'}
                        disabled={busy === `order-${row.id}`}
                        onChange={(e) => updateOrderStatus(row, e.target.value)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${
                          dm ? 'bg-gray-950 border-gray-700' : 'bg-white border-slate-200'
                        }`}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DropshipAdmin;
