import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Phone, MapPin, Edit2, Trash2, X, Save, Package } from 'lucide-react';

const STORAGE_KEY = 'imden_suppliers';

const SuppliersTab = ({ dm }) => {
    const [suppliers, setSuppliers] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch { return []; }
    });
    const [search, setSearch] = useState('');
    const [editModal, setEditModal] = useState(null); // null = closed, {} = new, {id:..} = editing
    const [form, setForm] = useState({ name: '', phone: '', city: '', specialty: '', notes: '' });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
    }, [suppliers]);

    const openNew = () => {
        setForm({ name: '', phone: '', city: '', specialty: '', notes: '' });
        setEditModal({});
    };

    const openEdit = (s) => {
        setForm({ name: s.name, phone: s.phone, city: s.city, specialty: s.specialty, notes: s.notes || '' });
        setEditModal(s);
    };

    const handleSave = () => {
        if (!form.name.trim()) return;
        if (editModal.id) {
            setSuppliers(suppliers.map(s => s.id === editModal.id ? { ...s, ...form } : s));
        } else {
            setSuppliers([...suppliers, { id: Date.now(), ...form, createdAt: new Date().toISOString() }]);
        }
        setEditModal(null);
    };

    const handleDelete = (id) => {
        if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
            setSuppliers(suppliers.filter(s => s.id !== id));
        }
    };

    const filtered = suppliers.filter(s => {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.city.toLowerCase().includes(q) || s.specialty.toLowerCase().includes(q);
    });

    const specialties = [...new Set(suppliers.map(s => s.specialty).filter(Boolean))];

    return (
        <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <UserCheck size={16} className="text-blue-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي الموردين</span>
                    </div>
                    <p className="text-2xl font-bold">{suppliers.length}</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className="text-green-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>المدن</span>
                    </div>
                    <p className="text-2xl font-bold">{new Set(suppliers.map(s => s.city).filter(Boolean)).size}</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Package size={16} className="text-purple-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>التخصصات</span>
                    </div>
                    <p className="text-2xl font-bold">{specialties.length}</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className={`absolute top-3 right-3 ${dm ? 'text-gray-500' : 'text-slate-400'}`} />
                    <input type="text" placeholder="ابحث عن مورد..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={`w-full pr-10 pl-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-purple-500 ${dm ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-200'}`} />
                </div>
                <button onClick={openNew}
                    className="px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 flex items-center gap-2 text-sm shadow-lg shadow-purple-500/20 shrink-0">
                    <Plus size={16} /> إضافة مورد
                </button>
            </div>

            {/* Suppliers Grid */}
            {filtered.length === 0 ? (
                <div className={`p-12 rounded-xl border text-center ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <UserCheck size={48} className={`mx-auto mb-4 ${dm ? 'text-gray-700' : 'text-slate-300'}`} />
                    <p className={`text-sm ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                        {suppliers.length === 0 ? 'لم يتم إضافة أي مورد بعد' : 'لا توجد نتائج'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(s => (
                        <div key={s.id} className={`p-4 rounded-xl border space-y-3 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                        {s.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{s.name}</p>
                                        {s.specialty && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-0.5 ${dm ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                                                {s.specialty}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(s)} className={`p-1.5 rounded-lg transition ${dm ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-slate-100 text-slate-400'}`}>
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className={`space-y-1 text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                {s.phone && <div className="flex items-center gap-2"><Phone size={12} /> <span dir="ltr">{s.phone}</span></div>}
                                {s.city && <div className="flex items-center gap-2"><MapPin size={12} /> {s.city}</div>}
                            </div>
                            {s.notes && <p className={`text-xs border-t pt-2 ${dm ? 'border-gray-800 text-gray-500' : 'border-slate-100 text-slate-400'}`}>{s.notes}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* Edit/Create Modal */}
            {editModal !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditModal(null)} />
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">{editModal.id ? 'تعديل المورد' : 'إضافة مورد جديد'}</h3>
                            <button onClick={() => setEditModal(null)} className={`p-1 rounded-lg ${dm ? 'hover:bg-gray-700' : 'hover:bg-slate-100'}`}><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <input type="text" placeholder="اسم المورد *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${dm ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-50 border-slate-200'}`} />
                            <input type="tel" placeholder="رقم الهاتف" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr"
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${dm ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-50 border-slate-200'}`} />
                            <input type="text" placeholder="المدينة" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${dm ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-50 border-slate-200'}`} />
                            <input type="text" placeholder="التخصص (مثال: شواحن، كاميرات)" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${dm ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-50 border-slate-200'}`} />
                            <textarea placeholder="ملاحظات..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none ${dm ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-50 border-slate-200'}`} />
                        </div>
                        <button onClick={handleSave} disabled={!form.name.trim()}
                            className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 ${!form.name.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'}`}>
                            <Save size={16} /> {editModal.id ? 'حفظ التعديلات' : 'إضافة المورد'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuppliersTab;
