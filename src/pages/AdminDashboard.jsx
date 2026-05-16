import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Lock, Package, Loader2, Search, ArrowRight, RefreshCw, LogOut, Trash2, Phone, Eye, X, Clock, Truck, XCircle, ShoppingBag, TrendingUp, ChevronDown, ChevronUp, Users, Download, Plus, CreditCard } from 'lucide-react';
import useStore from '../store/useStore';
import AdminSidebar from './AdminSidebar';

const NOCODB_URL = import.meta.env.VITE_NOCODB_URL;
const ORDERS_TOKEN = import.meta.env.VITE_NOCODB_ORDERS_TOKEN || import.meta.env.VITE_NOCODB_API_TOKEN;
const ORDERS_TABLE = import.meta.env.VITE_NOCODB_TABLE_ORDERS;
const PRODUCTS_TOKEN = import.meta.env.VITE_NOCODB_API_TOKEN;
const PRODUCTS_TABLE = import.meta.env.VITE_NOCODB_TABLE_PRODUCTS;
const EXPENSES_TABLE = import.meta.env.VITE_NOCODB_TABLE_EXPENSES;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'imden2026';
const CAT_MAP = {1:'Chargers',2:'Audio',3:'Smart Watches',4:'Gaming',5:'Mouse & Keyboard',6:'Storage',7:'Laptop Chargers',8:'Stands',9:'Lighting',10:'Cameras',11:'Network',12:'General',13:'Microphones',14:'Batteries',15:'Out of Stock'};

const AdminDashboard = () => {
    const { darkMode } = useStore();
    const dm = darkMode;
    
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('الكل');
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [productCatFilter, setProductCatFilter] = useState('all');
    const [editingProduct, setEditingProduct] = useState(null);
    const [editFiles, setEditFiles] = useState([]);
    const [editProductLoading, setEditProductLoading] = useState(false);
    const [createOrderModal, setCreateOrderModal] = useState(false);
    const [newOrderData, setNewOrderData] = useState({
        name: '', phone: '', address: '', notes: '', items: []
    });
    const [manualOrderSearch, setManualOrderSearch] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [expensesLoading, setExpensesLoading] = useState(false);
    const [createExpenseModal, setCreateExpenseModal] = useState(false);
    const [newExpenseData, setNewExpenseData] = useState({ Description: '', Amount: '', 'Paid By': '', Date: new Date().toISOString().split('T')[0] });

    // Ozon Express State
    const [ozonModalOpen, setOzonModalOpen] = useState(false);
    const [ozonOrder, setOzonOrder] = useState(null);
    const [ozonCities, setOzonCities] = useState([]);
    const [ozonFormData, setOzonFormData] = useState({ city: '', address: '', name: '', phone: '', price: '', note: '' });
    const [ozonLoading, setOzonLoading] = useState(false);

    useEffect(() => {
        const savedAuth = sessionStorage.getItem('admin_auth');
        if (savedAuth === 'true') {
            setIsAuthenticated(true);
            fetchOrders();
            fetchProducts();
            fetchExpenses();
            
            // Auto refresh every 30 seconds
            const interval = setInterval(() => {
                fetchOrders(true);
                fetchProducts(true);
                fetchExpenses(true);
            }, 30000);
            return () => clearInterval(interval);
        }
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            sessionStorage.setItem('admin_auth', 'true');
            fetchOrders();
            fetchProducts();
            fetchExpenses();
        } else {
            setError('كلمة السر غير صحيحة');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_auth');
        setIsAuthenticated(false);
        setOrders([]);
        setProducts([]);
    };

    const fetchProducts = useCallback(async (silent = false) => {
        if (!silent) setProductsLoading(true);
        try {
            let allProducts = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const response = await axios.get(`${NOCODB_URL}/api/v2/tables/${PRODUCTS_TABLE}/records`, {
                    headers: { 'xc-token': PRODUCTS_TOKEN },
                    params: { limit: 100, offset, t: Date.now() }
                });
                const list = response.data.list || [];
                allProducts = [...allProducts, ...list];
                if (list.length < 100) hasMore = false;
                else offset += 100;
            }
            setProducts(allProducts);
        } catch (err) {
            console.error("Error fetching products:", err);
        } finally {
            setProductsLoading(false);
        }
    }, []);

    const toggleProductStock = async (id, currentCat, currentPostebl) => {
        const isOutOfStock = currentCat === 15 || currentPostebl === 'NO POSTEBL';
        const newCatId = isOutOfStock ? 12 : 15; 
        const newPostebl = isOutOfStock ? 'POSTEBL' : 'NO POSTEBL';
        
        setProducts(prev => prev.map(p => p.Id === id ? { ...p, category_id: newCatId, Category_ID: newCatId, POSTEBL: newPostebl } : p));
        
        try {
            await axios.patch(`${NOCODB_URL}/api/v2/tables/${PRODUCTS_TABLE}/records`, 
                { Id: id, category_id: newCatId, Category_ID: newCatId, POSTEBL: newPostebl },
                { headers: { 'xc-token': PRODUCTS_TOKEN, 'Content-Type': 'application/json' } }
            );
        } catch (err) {
            console.error("Error toggling stock:", err);
            setProducts(prev => prev.map(p => p.Id === id ? { ...p, category_id: currentCat, Category_ID: currentCat, POSTEBL: currentPostebl } : p));
            alert("حدث خطأ أثناء تعديل حالة المخزون");
        }
    };

    const toggleProductPublish = async (id, currentPostebl) => {
        const isPaused = currentPostebl === 'PAUSED';
        const newPostebl = isPaused ? 'POSTEBL' : 'PAUSED';
        
        setProducts(prev => prev.map(p => p.Id === id ? { ...p, POSTEBL: newPostebl } : p));
        
        try {
            await axios.patch(`${NOCODB_URL}/api/v2/tables/${PRODUCTS_TABLE}/records`, 
                { Id: id, POSTEBL: newPostebl },
                { headers: { 'xc-token': PRODUCTS_TOKEN, 'Content-Type': 'application/json' } }
            );
        } catch (err) {
            console.error("Error toggling publish:", err);
            setProducts(prev => prev.map(p => p.Id === id ? { ...p, POSTEBL: currentPostebl } : p));
            alert("حدث خطأ أثناء تعديل حالة النشر");
        }
    };

    const saveProductDetails = async (updatedProduct, filesToUpload) => {
        setEditProductLoading(true);
        try {
            let uploadedFiles = [];
            if (filesToUpload && filesToUpload.length > 0) {
                // Upload files to NocoDB first
                for (let i = 0; i < filesToUpload.length; i++) {
                    const formData = new FormData();
                    formData.append('file', filesToUpload[i]);
                    const uploadRes = await axios.post(`${NOCODB_URL}/api/v2/storage/upload`, formData, {
                        headers: { 'xc-token': PRODUCTS_TOKEN, 'Content-Type': 'multipart/form-data' }
                    });
                    if (uploadRes.data && uploadRes.data.length > 0) {
                        uploadedFiles.push(uploadRes.data[0]);
                    }
                }
            }

            const payload = {
                Id: updatedProduct.Id,
                Title: updatedProduct.Title,
                SKU: updatedProduct.SKU,
                price: updatedProduct.price,
                Category_ID: updatedProduct.Category_ID,
                category_id: updatedProduct.Category_ID
            };

            // Map uploaded files to Image columns
            if (uploadedFiles.length > 0) {
                payload.Image1 = [uploadedFiles[0]];
                payload.image1 = [uploadedFiles[0]];
            }
            if (uploadedFiles.length > 1) {
                payload.Image2 = [uploadedFiles[1]];
                payload.image2 = [uploadedFiles[1]];
            }
            if (uploadedFiles.length > 2) {
                payload.Image3 = [uploadedFiles[2]];
                payload.image3 = [uploadedFiles[2]];
            }

            await axios.patch(`${NOCODB_URL}/api/v2/tables/${PRODUCTS_TABLE}/records`, payload, {
                headers: { 'xc-token': PRODUCTS_TOKEN, 'Content-Type': 'application/json' }
            });

            // Optimistic update
            setProducts(prev => prev.map(p => p.Id === updatedProduct.Id ? { ...p, ...updatedProduct, ...payload } : p));
            setEditingProduct(null);
            setEditFiles([]);
        } catch (err) {
            console.error("Error saving product:", err);
            alert("حدث خطأ أثناء حفظ المنتج");
            fetchProducts(); // Refresh to get original state
        } finally {
            setEditProductLoading(false);
        }
    };

    const fetchExpenses = useCallback(async (silent = false) => {
        if (!silent) setExpensesLoading(true);
        try {
            let allExpenses = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const response = await axios.get(`${NOCODB_URL}/api/v2/tables/${EXPENSES_TABLE}/records`, {
                    headers: { 'xc-token': PRODUCTS_TOKEN }, // Using global API token
                    params: { limit: 100, offset, sort: '-Id', t: Date.now() }
                });
                const list = response.data.list || [];
                allExpenses = [...allExpenses, ...list];
                if (list.length < 100) hasMore = false;
                else offset += 100;
            }
            setExpenses(allExpenses);
        } catch (err) {
            console.error("Error fetching expenses:", err);
        } finally {
            setExpensesLoading(false);
        }
    }, []);

    const submitExpense = async () => {
        if (!newExpenseData.Description || !newExpenseData.Amount) return alert("يرجى إدخال الوصف والمبلغ");
        
        setExpensesLoading(true);
        try {
            const payload = {
                Description: newExpenseData.Description,
                Amount: parseFloat(newExpenseData.Amount) || 0,
                "Paid By": newExpenseData['Paid By'],
                Date: newExpenseData.Date
            };
            
            const res = await axios.post(`${NOCODB_URL}/api/v2/tables/${EXPENSES_TABLE}/records`, [payload], {
                headers: { 'xc-token': PRODUCTS_TOKEN, 'Content-Type': 'application/json' }
            });
            
            if (res.data && res.data[0]) {
                setExpenses(prev => [res.data[0], ...prev]);
            } else {
                fetchExpenses(true);
            }
            
            setCreateExpenseModal(false);
            setNewExpenseData({ Description: '', Amount: '', 'Paid By': '', Date: new Date().toISOString().split('T')[0] });
        } catch (err) {
            console.error("Error adding expense:", err);
            alert("حدث خطأ أثناء إضافة المصروف");
        } finally {
            setExpensesLoading(false);
        }
    };

    const deleteExpense = async (id) => {
        if(!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
        try {
            await axios.delete(`${NOCODB_URL}/api/v2/tables/${EXPENSES_TABLE}/records`, {
                headers: { 'xc-token': PRODUCTS_TOKEN, 'Content-Type': 'application/json' },
                data: [{ Id: id }]
            });
            setExpenses(prev => prev.filter(e => e.Id !== id));
        } catch (err) {
            console.error("Error deleting expense:", err);
            alert("حدث خطأ أثناء حذف المصروف");
        }
    };

    const fetchOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            let allOrders = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const response = await axios.get(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, {
                    headers: { 'xc-token': ORDERS_TOKEN },
                    params: { limit: 100, offset, sort: '-Id', t: Date.now() }
                });
                const list = response.data.list || [];
                allOrders = [...allOrders, ...list];
                if (list.length < 100) hasMore = false;
                else offset += 100;
            }

            setOrders(allOrders);
        } catch (err) {
            console.error("Error fetching orders:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const updateOrderStatus = async (id, newStatus) => {
        try {
            // Map Arabic UI status to NocoDB Enum values
            let dbStatus = newStatus;
            if (newStatus === 'قيد المراجعة') dbStatus = 'Pending';
            else if (newStatus === 'تم الشحن') dbStatus = 'Shipped';
            else if (newStatus === 'ملغي') dbStatus = 'Cancelled';

            await axios.patch(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, 
                { Id: id, Status: dbStatus },
                { headers: { 'xc-token': ORDERS_TOKEN, 'Content-Type': 'application/json' } }
            );
            // We update the local state with the DB status so that getNormalizedStatus can handle it
            setOrders(prev => prev.map(o => o.Id === id ? { ...o, Status: dbStatus } : o));
        } catch (err) {
            console.error("Error updating status:", err);
            alert("حدث خطأ أثناء تحديث الحالة");
        }
    };

    const deleteOrder = async (id) => {
        try {
            await axios.delete(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, {
                headers: { 'xc-token': ORDERS_TOKEN, 'Content-Type': 'application/json' },
                data: [{ Id: id }]
            });
            setOrders(prev => prev.filter(o => o.Id !== id));
            setDeleteConfirm(null);
        } catch (err) {
            console.error("Error deleting order:", err);
            alert("حدث خطأ أثناء حذف الطلب");
        }
    };

    const submitManualOrder = async () => {
        if (!newOrderData.name || !newOrderData.phone) return alert("يرجى إدخال اسم ورقم هاتف الزبون");
        if (newOrderData.items.length === 0) return alert("يرجى إضافة منتج واحد على الأقل");

        setLoading(true);
        try {
            const salePrice = newOrderData.items.reduce((sum, item) => sum + ((item.price || item.Price || 0) * item.quantity), 0);
            const orderMetaData = newOrderData.items.map(i => ({
                id: i.Id,
                name: i.Title || i.title,
                ref: i.SKU || i.Ref,
                price: i.price || i.Price,
                qty: i.quantity
            }));

            const orderPayload = {
                "Customer Name": newOrderData.name,
                "Customer Phone": newOrderData.phone,
                "Delivery Address": newOrderData.address,
                "Sale Price": salePrice,
                "Status": "Pending",
                "Notes": newOrderData.notes ? `طلب يدوي: ${newOrderData.notes}` : 'طلب يدوي',
                "Order Metadata": JSON.stringify(orderMetaData)
            };

            const res = await axios.post(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, [orderPayload], {
                headers: { 'xc-token': ORDERS_TOKEN, 'Content-Type': 'application/json' }
            });
            
            if (res.data && res.data[0]) {
                setOrders(prev => [res.data[0], ...prev]);
            } else {
                fetchOrders(true);
            }
            
            setCreateOrderModal(false);
            setNewOrderData({ name: '', phone: '', address: '', notes: '', items: [] });
            setActiveTab('orders');
        } catch (err) {
            console.error("Error submitting manual order", err);
            alert("حدث خطأ أثناء إنشاء الطلب");
        } finally {
            setLoading(false);
        }
    };

    const openOzonModal = async (order) => {
        setOzonOrder(order);
        setOzonFormData({
            name: order['Customer Name'] || '',
            phone: order['Customer Phone'] || '',
            address: order['Delivery Address'] || '',
            price: order['Sale Price'] || '',
            note: order.Notes || '',
            city: ''
        });
        setOzonModalOpen(true);
        if (ozonCities.length === 0) {
            try {
                const res = await axios.get('https://api.ozonexpress.ma/cities');
                if (res.data && res.data.CITIES) {
                    const citiesArray = Object.values(res.data.CITIES).sort((a, b) => a.NAME.localeCompare(b.NAME));
                    setOzonCities(citiesArray);
                }
            } catch (err) {
                console.error("Error fetching Ozon cities:", err);
            }
        }
    };

    const submitToOzon = async () => {
        if (!ozonFormData.city) return alert("يرجى اختيار المدينة");
        setOzonLoading(true);
        try {
            const formData = new FormData();
            formData.append('parcel-receiver', ozonFormData.name);
            formData.append('parcel-phone', ozonFormData.phone);
            formData.append('parcel-city', ozonFormData.city);
            formData.append('parcel-address', ozonFormData.address);
            formData.append('parcel-price', ozonFormData.price);
            formData.append('parcel-note', ozonFormData.note);
            formData.append('parcel-replace', '0');
            formData.append('is_stock', '0');

            const API_URL = 'https://api.ozonexpress.ma/customers/57958/109726-7860c1-78d151-580acb-4a5c74/add-parcel';
            
            const response = await axios.post(API_URL, formData);
            if (response.data && response.data.status !== 'error') {
                alert("تم الإرسال إلى شركة التوصيل بنجاح!");
                setOzonModalOpen(false);
                // Optionally update status in NocoDB to 'Shipped'
                updateOrderStatus(ozonOrder.Id, 'تم الشحن');
            } else {
                alert("حدث خطأ من شركة التوصيل: " + (response.data?.message || 'Unknown error'));
            }
        } catch (err) {
            console.error("Ozon API Error:", err);
            alert("حدث خطأ أثناء التواصل مع شركة التوصيل. تحقق من اتصالك أو من إعدادات CORS.");
        } finally {
            setOzonLoading(false);
        }
    };

    const printInvoice = (order) => {
        let itemsHtml = '';
        let total = 0;
        try {
            const meta = JSON.parse(order['Order Metadata']);
            itemsHtml = meta.map(i => {
                total += (i.price * i.qty);
                return `<tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${i.name || i.ref}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${i.price} DH</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${i.qty}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${i.price * i.qty} DH</td>
                </tr>`;
            }).join('');
        } catch(e) {}

        const invoiceContent = `
            <html>
            <head>
                <title>فاتورة الطلب #${order.Id}</title>
                <style>
                    body { font-family: sans-serif; direction: rtl; padding: 40px; color: #333; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #222; padding-bottom: 20px; margin-bottom: 30px; }
                    .title { font-size: 28px; font-weight: bold; }
                    .info { margin-bottom: 30px; line-height: 1.6; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; text-align: right; }
                    th { background: #f8f9fa; padding: 12px; border-bottom: 2px solid #ddd; }
                    .total { text-align: left; font-size: 20px; font-weight: bold; margin-top: 20px; border-top: 2px solid #222; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">IMDEN STORE</div>
                    <div>
                        <strong>فاتورة طلب #${order.Id}</strong><br/>
                        التاريخ: ${new Date(order.CreatedAt).toLocaleDateString('ar-MA')}
                    </div>
                </div>
                <div class="info">
                    <strong>إلى:</strong> ${order['Customer Name'] || 'زبون'}<br/>
                    <strong>الهاتف:</strong> <span dir="ltr">${order['Customer Phone'] || ''}</span><br/>
                    <strong>العنوان:</strong> ${order['Delivery Address'] || ''}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>المنتج</th>
                            <th>السعر</th>
                            <th>الكمية</th>
                            <th>المجموع</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="total">
                    المبلغ الإجمالي: ${order['Sale Price'] || total} درهم
                </div>
                <div style="text-align:center; margin-top: 50px; font-size: 14px; color: #666;">
                    شكراً لثقتكم بنا!
                </div>
                <script>window.print(); setTimeout(() => window.close(), 500);</script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(invoiceContent);
        win.document.close();
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHrs < 24) return `منذ ${diffHrs} ساعة`;
        if (diffDays < 7) return `منذ ${diffDays} يوم`;
        return d.toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Normalize status helper
    const getNormalizedStatus = (statusStr) => {
        if (!statusStr || statusStr === 'Pending') return 'قيد المراجعة';
        if (statusStr === 'Shipped' || statusStr === 'Delivered') return 'تم الشحن';
        if (statusStr === 'Returned' || statusStr === 'Cancelled') return 'ملغي';
        return statusStr;
    };

    // Stats
    const pendingCount = orders.filter(o => getNormalizedStatus(o.Status) === 'قيد المراجعة').length;
    const shippedCount = orders.filter(o => getNormalizedStatus(o.Status) === 'تم الشحن').length;
    const cancelledCount = orders.filter(o => getNormalizedStatus(o.Status) === 'ملغي').length;
    const totalRevenue = orders.filter(o => o.Status !== 'ملغي').reduce((sum, o) => sum + (Number(o['Sale Price']) || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.Amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    // Today's orders
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => o.CreatedAt && new Date(o.CreatedAt).toDateString() === today);

    // Filtered orders
    const filteredOrders = orders.filter(o => {
        const matchSearch = (o['Customer Name'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (o['Customer Phone'] || '').includes(searchTerm) ||
            String(o.Id).includes(searchTerm);
        
        const status = getNormalizedStatus(o.Status);
        const matchStatus = statusFilter === 'الكل' || status === statusFilter;

        return matchSearch && matchStatus;
    });

    // ── Customers extracted from orders ──
    const customers = useMemo(() => {
        const map = {};
        orders.forEach(o => {
            const phone = (o['Customer Phone'] || '').trim();
            if (!phone) return;
            if (!map[phone]) {
                map[phone] = { name: o['Customer Name'] || 'بدون اسم', phone, totalSpent: 0, orderCount: 0 };
            }
            map[phone].totalSpent += Number(o['Sale Price']) || 0;
            map[phone].orderCount += 1;
        });
        return Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
    }, [orders]);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
    );

    // ── CSV Export ──
    const exportCSV = () => {
        const headers = ['رقم الطلب', 'الاسم', 'الهاتف', 'المبلغ', 'الحالة', 'التاريخ', 'الملاحظات'];
        const rows = orders.map(o => [
            o.Id, o['Customer Name'] || '', o['Customer Phone'] || '',
            o['Sale Price'] || 0, getNormalizedStatus(o.Status),
            o.CreatedAt ? new Date(o.CreatedAt).toLocaleDateString('ar-MA') : '',
            (o.Notes || '').replace(/\n/g, ' | ')
        ]);
        const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IMDEN_Orders_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── LOGIN PAGE ──
    if (!isAuthenticated) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${dm ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-slate-100'}`}>
                <div className={`max-w-md w-full p-8 rounded-2xl shadow-2xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                            <Lock size={36} className="text-white" />
                        </div>
                        <h2 className={`text-2xl font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>IMDEN Admin</h2>
                        <p className={`text-sm mt-2 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>لوحة إدارة الطلبات والمخازن</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            placeholder="كلمة السر..."
                            autoFocus
                            className={`w-full px-4 py-3.5 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg ${dm ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        />
                        {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                        <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                            تسجيل الدخول
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── DASHBOARD ──
    const statusTabs = [
        { label: 'الكل', count: orders.length, icon: ShoppingBag, color: 'blue' },
        { label: 'قيد المراجعة', count: pendingCount, icon: Clock, color: 'yellow' },
        { label: 'تم الشحن', count: shippedCount, icon: Truck, color: 'green' },
        { label: 'ملغي', count: cancelledCount, icon: XCircle, color: 'red' },
    ];

    const statusColors = {
        'قيد المراجعة': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
        'تم الشحن': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
        'ملغي': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
    };

    return (
        <div className={`min-h-screen flex ${dm ? 'bg-gray-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
            {/* ── Sidebar ── */}
            <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} dm={dm} onLogout={handleLogout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

            {/* ── Main Content ── */}
            <div className="flex-1 sm:mr-60 min-h-screen">
                {/* Top Bar */}
                <header className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl ${dm ? 'bg-gray-950/90 border-gray-800' : 'bg-slate-50/90 border-slate-200'}`}>
                    <h2 className="text-lg font-bold mr-10 sm:mr-0">
                        {{ dashboard: 'لوحة التحكم', orders: 'إدارة الطلبات', customers: 'الزبائن', products: 'المنتجات', expenses: 'المصاريف', settings: 'الإعدادات', 'direct-sales': 'المبيعات المباشرة', returns: 'المرتجعات', suppliers: 'الموردين', wallets: 'المحافظ', 'profit-dashboard': 'لوحة الأرباح', reports: 'التقارير' }[activeTab] || 'لوحة التحكم'}
                    </h2>
                    <button onClick={() => { fetchOrders(true); fetchProducts(true); fetchExpenses(true); }}
                        className={`p-2 rounded-lg transition-colors ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-200 text-slate-500'}`}
                        title="تحديث">
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </header>

            <main className="p-4 sm:p-6 space-y-5">

                {/* ══════ DASHBOARD TAB ══════ */}
                {activeTab === 'dashboard' && (<>
                {/* ── Stats Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingBag size={16} className="text-blue-500" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي الطلبات</span>
                        </div>
                        <p className="text-2xl font-bold">{orders.length}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={16} className="text-green-500" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المبيعات</span>
                        </div>
                        <p className="text-2xl font-bold text-green-500">{totalRevenue.toFixed(0)} DH</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard size={16} className="text-red-500" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المصاريف</span>
                        </div>
                        <p className="text-2xl font-bold text-red-500">{totalExpenses.toFixed(0)} DH</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Package size={16} className="text-blue-400" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الربح الصافي</span>
                        </div>
                        <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                            {netProfit > 0 ? '+' : ''}{netProfit.toFixed(0)} DH
                        </p>
                    </div>
                </div>

                {/* Recent Orders in Dashboard */}
                <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                        <h3 className="text-sm font-bold">آخر الطلبات</h3>
                        <button onClick={() => setActiveTab('orders')} className="text-xs text-blue-500 font-bold hover:underline">عرض الكل</button>
                    </div>
                    {orders.slice(0, 5).map(o => (
                        <div key={o.Id} className={`px-4 py-3 flex items-center gap-3 border-b last:border-0 ${dm ? 'border-gray-800' : 'border-slate-50'}`}>
                            <div className={`w-2 h-2 rounded-full shrink-0 ${(o.Status === 'تم الشحن') ? 'bg-green-500' : o.Status === 'ملغي' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{o['Customer Name'] || 'بدون اسم'}</p>
                                <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{formatDate(o.CreatedAt)}</p>
                            </div>
                            <span className="text-sm font-bold text-green-500 shrink-0">{o['Sale Price'] || 0} DH</span>
                        </div>
                    ))}
                    {orders.length === 0 && <div className="p-8 text-center text-sm text-gray-500">لا توجد طلبات بعد.</div>}
                </div>
                </>)}

                {/* ══════ ORDERS TAB ══════ */}
                {activeTab === 'orders' && (<>
                {/* CSV Export & Create Order */}
                <div className="flex justify-end gap-2">
                    <button onClick={() => setCreateOrderModal(true)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors bg-blue-500 hover:bg-blue-600 text-white`}>
                        <Plus size={14} /> طلب يدوي
                    </button>
                    <button onClick={exportCSV}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                        <Download size={14} /> تصدير CSV
                    </button>
                </div>
                {/* ── Status Tabs + Search ── */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                    <div className="flex gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
                        {statusTabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = statusFilter === tab.label;
                            return (
                                <button key={tab.label}
                                    onClick={() => setStatusFilter(tab.label)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border
                                        ${isActive 
                                            ? `bg-${tab.color}-100 text-${tab.color}-700 border-${tab.color}-200 shadow-sm` 
                                            : `${dm ? 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`
                                        }`}
                                    style={isActive ? { backgroundColor: `var(--${tab.color}-bg, ${tab.color === 'blue' ? '#dbeafe' : tab.color === 'yellow' ? '#fef9c3' : tab.color === 'green' ? '#dcfce7' : '#fee2e2'})`, color: `${tab.color === 'blue' ? '#1d4ed8' : tab.color === 'yellow' ? '#a16207' : tab.color === 'green' ? '#15803d' : '#b91c1c'}` } : {}}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/50' : dm ? 'bg-gray-800' : 'bg-slate-100'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className={`relative w-full sm:w-64 ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="ابحث..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={`w-full pr-9 pl-4 py-2.5 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-900 border-gray-800 focus:border-blue-500 text-white' : 'bg-white border-slate-200 focus:border-blue-500'}`}
                        />
                    </div>
                </div>

                {/* ── Orders List ── */}
                <div className="space-y-3">
                    {loading ? (
                        <div className={`p-12 flex flex-col items-center justify-center rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
                            <p className={dm ? 'text-gray-400' : 'text-slate-500'}>جاري تحميل الطلبات...</p>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className={`p-12 text-center rounded-xl border ${dm ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                            لا توجد طلبات{searchTerm ? ' تطابق بحثك' : ''}.
                        </div>
                    ) : (
                        filteredOrders.map(order => {
                            const status = order.Status || 'قيد المراجعة';
                            const sc = statusColors[status] || statusColors['قيد المراجعة'];
                            const isExpanded = expandedOrder === order.Id;

                            return (
                                <div key={order.Id}
                                    className={`rounded-xl border overflow-hidden transition-all ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'} ${isExpanded ? 'shadow-lg' : ''}`}
                                >
                                    {/* Order Row */}
                                    <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${dm ? 'hover:bg-gray-800/50' : 'hover:bg-slate-50'}`}
                                        onClick={() => setExpandedOrder(isExpanded ? null : order.Id)}
                                    >
                                        {/* Status Dot */}
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`} />

                                        {/* Order Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`font-bold text-sm ${dm ? 'text-white' : 'text-slate-900'}`}>
                                                    {order['Customer Name'] || 'بدون اسم'}
                                                </span>
                                                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${dm ? 'bg-gray-800 text-gray-500' : 'bg-slate-100 text-slate-400'}`}>
                                                    #{order.Id}
                                                </span>
                                            </div>
                                            <div className={`flex items-center gap-3 mt-1 text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                                <span dir="ltr">{order['Customer Phone'] || '—'}</span>
                                                <span>•</span>
                                                <span>{formatDate(order.CreatedAt)}</span>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <span className="font-bold text-green-500 text-sm shrink-0">
                                            {order['Sale Price'] || 0} DH
                                        </span>

                                        {/* Status Badge */}
                                        <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold ${sc.bg} ${sc.text} ${sc.border} border shrink-0`}>
                                            {status}
                                        </span>

                                        {/* Expand Arrow */}
                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className={`px-4 pb-4 pt-1 border-t space-y-3 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            {/* Status Change + Actions */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`text-xs font-medium ${dm ? 'text-gray-400' : 'text-slate-500'}`}>تغيير الحالة:</span>
                                                {['قيد المراجعة', 'تم الشحن', 'ملغي'].map(s => {
                                                    const c = statusColors[s];
                                                    const isActive = status === s;
                                                    return (
                                                        <button key={s} onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.Id, s); }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isActive ? `${c.bg} ${c.text} ${c.border} ring-2 ring-offset-1 ring-${s === 'قيد المراجعة' ? 'yellow' : s === 'تم الشحن' ? 'green' : 'red'}-300` : `${dm ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}`}
                                                        >
                                                            {s === 'قيد المراجعة' ? '⏳' : s === 'تم الشحن' ? '🚚' : '❌'} {s}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Notes / Order Details */}
                                            {order.Notes && (
                                                <div className={`text-xs whitespace-pre-wrap p-3 rounded-xl border leading-relaxed ${dm ? 'bg-gray-950 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                                    {order.Notes}
                                                </div>
                                            )}

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-2 flex-wrap pt-1">
                                                {order['Customer Phone'] && (() => {
                                                    const ph = order['Customer Phone'].replace(/^0/, '');
                                                    const name = order['Customer Name'] || 'عميلنا الكريم';
                                                    const confirmMsg = encodeURIComponent(`مرحباً ${name} 👋\n\nشكراً لتعاملكم مع *IMDEN*.\nلقد تلقينا طلبكم رقم *#${order.Id}* بقيمة *${order['Sale Price'] || 0} درهم*.\n\nنحن بصدد تجهيزه وسيتم التواصل معكم عند الشحن ✅\n\nشكراً لثقتكم 🙏`);
                                                    const shippedMsg = encodeURIComponent(`مرحباً ${name} 👋\n\nنود إعلامكم أن طلبكم رقم *#${order.Id}* تم *شحنه بنجاح* 🚚📦\n\nسيصلكم في أقرب وقت إن شاء الله.\n\nشكراً لتعاملكم مع *IMDEN* 🙏`);
                                                    return (<>
                                                        <a href={`https://wa.me/212${ph}?text=${confirmMsg}`} target="_blank" rel="noreferrer"
                                                            className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-colors">
                                                            <Phone size={12} /> تأكيد الطلب
                                                        </a>
                                                        <a href={`https://wa.me/212${ph}?text=${shippedMsg}`} target="_blank" rel="noreferrer"
                                                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors">
                                                            <Truck size={12} /> إشعار الشحن
                                                        </a>
                                                        <a href={`tel:${order['Customer Phone']}`}
                                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                                                            <Phone size={12} /> اتصال
                                                        </a>
                                                    </>);
                                                })()}
                                                <div className="flex-1" />
                                                <button onClick={(e) => { e.stopPropagation(); openOzonModal(order); }}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors bg-purple-50 hover:bg-purple-100 text-purple-600">
                                                    <Truck size={12} /> Ozon Express
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); printInvoice(order); }}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-blue-400' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'}`}>
                                                    <Package size={12} /> طباعة الفاتورة
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(order.Id); }}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                    <Trash2 size={12} /> حذف
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
                </>)}

                {/* ── CUSTOMERS TAB ── */}
                {activeTab === 'customers' && (
                    <div className="space-y-3">
                        {/* Search */}
                        <div className={`relative w-full sm:w-72 ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />
                            <input type="text" placeholder="ابحث بالاسم أو الهاتف..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className={`w-full pr-9 pl-4 py-2.5 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-900 border-gray-800 focus:border-blue-500 text-white' : 'bg-white border-slate-200 focus:border-blue-500'}`}
                            />
                        </div>

                        {/* Customer Cards */}
                        {filteredCustomers.length === 0 ? (
                            <div className={`p-12 text-center rounded-xl border ${dm ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                                لا يوجد زبائن.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredCustomers.map(c => (
                                    <div key={c.phone} className={`p-4 rounded-xl border transition-all ${dm ? 'bg-gray-900 border-gray-800 hover:border-gray-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${dm ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                {(c.name || '?')[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{c.name}</p>
                                                <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`} dir="ltr">{c.phone}</p>
                                            </div>
                                        </div>
                                        <div className={`flex items-center justify-between mt-3 pt-3 border-t text-xs ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            <div>
                                                <span className={dm ? 'text-gray-500' : 'text-slate-400'}>الطلبات: </span>
                                                <span className="font-bold">{c.orderCount}</span>
                                            </div>
                                            <div>
                                                <span className={dm ? 'text-gray-500' : 'text-slate-400'}>المجموع: </span>
                                                <span className="font-bold text-green-500">{c.totalSpent.toFixed(0)} DH</span>
                                            </div>
                                            <a href={`https://wa.me/212${c.phone.replace(/^0/, '')}`} target="_blank" rel="noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors">
                                                <Phone size={10} /> واتساب
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════ PRODUCTS TAB ══════ */}
                {activeTab === 'products' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <h3 className="text-lg font-bold w-full sm:w-auto">المنتجات ({products.length})</h3>
                            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1">
                                <button onClick={() => setProductCatFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${productCatFilter === 'all' ? 'bg-blue-100 text-blue-700 border-blue-200' : (dm ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
                                    الكل
                                </button>
                                <button onClick={() => setProductCatFilter('instock')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${productCatFilter === 'instock' ? 'bg-green-100 text-green-700 border-green-200' : (dm ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
                                    متوفرة
                                </button>
                                <button onClick={() => setProductCatFilter('outofstock')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${productCatFilter === 'outofstock' ? 'bg-red-100 text-red-700 border-red-200' : (dm ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
                                    نفدت
                                </button>
                                <button onClick={() => setProductCatFilter('paused')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${productCatFilter === 'paused' ? 'bg-orange-100 text-orange-700 border-orange-200' : (dm ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
                                    موقوفة
                                </button>
                                <select 
                                    value={!['all', 'instock', 'outofstock', 'paused'].includes(productCatFilter) ? productCatFilter : ''}
                                    onChange={(e) => setProductCatFilter(e.target.value || 'all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border outline-none ${!['all', 'instock', 'outofstock', 'paused'].includes(productCatFilter) ? 'bg-blue-100 text-blue-700 border-blue-200' : (dm ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
                                    <option value="" disabled={!['all', 'instock', 'outofstock', 'paused'].includes(productCatFilter)}>حسب التصنيف...</option>
                                    {Object.entries(CAT_MAP).filter(([id]) => id !== '15').map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={`relative w-full sm:w-64 shrink-0 ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />
                                <input type="text" placeholder="ابحث عن منتج..." value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    className={`w-full pr-9 pl-4 py-2.5 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-900 border-gray-800 focus:border-blue-500 text-white' : 'bg-white border-slate-200 focus:border-blue-500'}`}
                                />
                            </div>
                        </div>

                        <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            {productsLoading ? (
                                <div className="p-12 flex flex-col items-center justify-center text-blue-500">
                                    <Loader2 size={40} className="animate-spin mb-4" />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className={`border-b ${dm ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            <tr>
                                                <th className="px-4 py-3 font-semibold w-16">صورة</th>
                                                <th className="px-4 py-3 font-semibold">الاسم (المرجع)</th>
                                                <th className="px-4 py-3 font-semibold">التصنيف</th>
                                                <th className="px-4 py-3 font-semibold">السعر</th>
                                                <th className="px-4 py-3 font-semibold text-center">إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/20">
                                            {products
                                                .filter(p => {
                                                    // Search Filter
                                                    const t = (p.Title || p.title || '').toLowerCase();
                                                    const r = (p.SKU || p.Ref || '').toLowerCase();
                                                    const q = productSearch.toLowerCase();
                                                    const matchesSearch = t.includes(q) || r.includes(q);
                                                    
                                                    // Category Filter
                                                    const catId = p.Category_ID || p.category_id || p.CategoryId || p.categoryId;
                                                    const isPaused = p.POSTEBL === 'PAUSED';
                                                    const isOutOfStock = !isPaused && (catId == 15 || p.POSTEBL === 'NO POSTEBL');
                                                    const isInstock = !isPaused && !isOutOfStock;
                                                    
                                                    let matchesCat = true;
                                                    if (productCatFilter === 'outofstock') matchesCat = isOutOfStock;
                                                    else if (productCatFilter === 'instock') matchesCat = isInstock;
                                                    else if (productCatFilter === 'paused') matchesCat = isPaused;
                                                    else if (productCatFilter !== 'all') matchesCat = catId == productCatFilter;
                                                    
                                                    return matchesSearch && matchesCat;
                                                })
                                                .map(p => {
                                                const categoryId = p.Category_ID || p.category_id || p.CategoryId || p.categoryId;
                                                const isPaused = p.POSTEBL === 'PAUSED';
                                                const isOutOfStock = categoryId === 15 || p.POSTEBL === 'NO POSTEBL';
                                                const catName = CAT_MAP[categoryId] || 'عام';
                                                
                                                let imgSrc = '';
                                                try {
                                                    const imgCol = p.Image1 || p.image;
                                                    if (imgCol) {
                                                        const imgData = typeof imgCol === 'string' ? JSON.parse(imgCol) : imgCol;
                                                        if (Array.isArray(imgData) && imgData.length > 0) {
                                                            const rawUrl = imgData[0].signedUrl || imgData[0].url;
                                                            if (rawUrl) {
                                                                imgSrc = rawUrl.startsWith('http') ? rawUrl : `${NOCODB_URL}/${rawUrl.replace(/^\//, '')}`;
                                                            }
                                                        }
                                                    }
                                                } catch {
                                                    // Ignore parsing error
                                                }

                                                return (
                                                <tr key={p.Id} className={`transition-colors ${dm ? 'hover:bg-gray-800/50' : 'hover:bg-slate-50'} ${isPaused ? 'opacity-40 grayscale' : (isOutOfStock ? 'opacity-60' : '')}`}>
                                                    <td className="px-4 py-3">
                                                        {imgSrc ? (
                                                            <div className={`w-12 h-12 rounded-lg border overflow-hidden flex items-center justify-center ${dm ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-slate-200'}`}>
                                                                <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${dm ? 'bg-gray-800 text-gray-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                <Package size={20} />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-bold line-clamp-1 flex items-center gap-2">
                                                            {p.Title || p.title || 'بدون اسم'}
                                                            {isPaused && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">موقوف</span>}
                                                        </p>
                                                        <p className={`text-[10px] font-mono mt-0.5 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{p.SKU || p.Ref || 'NO-REF'}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        <span className={`px-2 py-1 rounded-md ${dm ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>
                                                            {catName}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-green-500">
                                                        {p.price || p.Price || 0} DH
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                            <button 
                                                                onClick={() => toggleProductStock(p.Id, categoryId, p.POSTEBL)}
                                                                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border flex-1 text-center whitespace-nowrap
                                                                    ${isOutOfStock 
                                                                        ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' 
                                                                        : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'}`}
                                                            >
                                                                {isOutOfStock ? '🚫 نفد' : '✅ متوفر'}
                                                            </button>
                                                            <button 
                                                                onClick={() => toggleProductPublish(p.Id, p.POSTEBL)}
                                                                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border flex-1 text-center whitespace-nowrap
                                                                    ${isPaused 
                                                                        ? 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300' 
                                                                        : 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'}`}
                                                                title={isPaused ? "نشر المنتج ليظهر في الموقع" : "إيقاف المنتج لإخفائه من الموقع"}
                                                            >
                                                                {isPaused ? '👁️ نشر' : '⏸️ إيقاف'}
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingProduct({ ...p, Title: p.Title || p.title || '', SKU: p.SKU || p.Ref || '', price: p.price || p.Price || 0, Category_ID: categoryId });
                                                                    setEditFiles([]);
                                                                }}
                                                                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border
                                                                    ${dm ? 'bg-gray-800 text-blue-400 border-gray-700 hover:bg-gray-700' : 'bg-white text-blue-600 border-slate-200 hover:bg-slate-50'}`}
                                                            >
                                                                تعديل
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════ EXPENSES TAB ══════ */}
                {activeTab === 'expenses' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">المصاريف والأرباح</h3>
                            <button onClick={() => setCreateExpenseModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                                <Plus size={14} /> إضافة مصروف
                            </button>
                        </div>

                        {/* Profit Summary Mini Card */}
                        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <div>
                                <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المبيعات المكتملة</p>
                                <p className="text-xl font-bold text-green-500">{totalRevenue.toFixed(0)} DH</p>
                            </div>
                            <div className="hidden sm:block text-2xl text-gray-300 dark:text-gray-700">-</div>
                            <div>
                                <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المصاريف</p>
                                <p className="text-xl font-bold text-red-500">{totalExpenses.toFixed(0)} DH</p>
                            </div>
                            <div className="hidden sm:block text-2xl text-gray-300 dark:text-gray-700">=</div>
                            <div className={`px-4 py-2 rounded-lg ${netProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الربح الصافي</p>
                                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{netProfit > 0 ? '+' : ''}{netProfit.toFixed(0)} DH</p>
                            </div>
                        </div>

                        <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            {expensesLoading ? (
                                <div className="p-12 flex flex-col items-center justify-center text-blue-500">
                                    <Loader2 size={40} className="animate-spin mb-4" />
                                </div>
                            ) : expenses.length === 0 ? (
                                <div className={`p-12 text-center rounded-xl ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                    لا توجد مصاريف مسجلة حتى الآن.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className={`border-b ${dm ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            <tr>
                                                <th className="px-4 py-3 font-semibold">تاريخ</th>
                                                <th className="px-4 py-3 font-semibold">الوصف</th>
                                                <th className="px-4 py-3 font-semibold">المسؤول</th>
                                                <th className="px-4 py-3 font-semibold">المبلغ</th>
                                                <th className="px-4 py-3 font-semibold w-16">إجراء</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/20">
                                            {expenses.map(exp => (
                                                <tr key={exp.Id} className={`transition-colors ${dm ? 'hover:bg-gray-800/50' : 'hover:bg-slate-50'}`}>
                                                    <td className="px-4 py-3 text-xs font-mono">{formatDate(exp.Date || exp.CreatedAt)}</td>
                                                    <td className="px-4 py-3 font-medium">{exp.Description}</td>
                                                    <td className="px-4 py-3 text-xs">{exp['Paid By'] || '—'}</td>
                                                    <td className="px-4 py-3 font-bold text-red-500">{exp.Amount} DH</td>
                                                    <td className="px-4 py-3">
                                                        <button onClick={() => deleteExpense(exp.Id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════ SETTINGS TAB ══════ */}
                {activeTab === 'settings' && (
                    <div className={`p-6 rounded-xl border space-y-4 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <h3 className="text-lg font-bold">الإعدادات</h3>
                        <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-sm font-bold mb-1">معلومات النظام</p>
                            <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الإصدار: 1.0 | الطلبات: {orders.length} | الزبائن: {customers.length}</p>
                        </div>
                        <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-sm font-bold mb-1">كلمة السر</p>
                            <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>كلمة السر الحالية: imden2026</p>
                        </div>
                    </div>
                )}

                {/* ══════ PLACEHOLDER PAGES ══════ */}
                {['direct-sales', 'returns', 'suppliers', 'wallets', 'profit-dashboard', 'reports'].includes(activeTab) && (
                    <div className={`p-8 sm:p-12 rounded-2xl border text-center space-y-4 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                            <Package size={36} className="text-purple-500" />
                        </div>
                        <h3 className="text-xl font-bold">
                            {{ 'direct-sales': 'المبيعات المباشرة', returns: 'المرتجعات', suppliers: 'الموردين', wallets: 'المحافظ', 'profit-dashboard': 'لوحة الأرباح', reports: 'التقارير' }[activeTab]}
                        </h3>
                        <p className={`text-sm max-w-md mx-auto ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                            هذه الصفحة قيد التطوير وستكون متاحة قريباً. سنعمل على إضافة هذه الميزة في أقرب وقت.
                        </p>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${dm ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                            🚀 قريباً
                        </div>
                    </div>
                )}

            </main>
            </div>

            {/* ── Delete Confirmation Modal ── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4 ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`}>
                        <div className="text-4xl">🗑️</div>
                        <h3 className="text-lg font-bold">حذف الطلب #{deleteConfirm}؟</h3>
                        <p className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>لا يمكن التراجع عن هذا الإجراء.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)}
                                className={`flex-1 py-2.5 rounded-xl font-medium ${dm ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                                إلغاء
                            </button>
                            <button onClick={() => deleteOrder(deleteConfirm)}
                                className="flex-1 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white">
                                حذف
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Product Edit Modal ── */}
            {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`}>
                        <h3 className="text-lg font-bold border-b pb-3 mb-4" style={{borderColor: dm ? '#374151' : '#e2e8f0'}}>تعديل المنتج</h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الاسم / العنوان</label>
                                <input type="text" value={editingProduct.Title} onChange={e => setEditingProduct({...editingProduct, Title: e.target.value})}
                                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-slate-50 border-slate-200 focus:border-blue-500'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>المرجع (SKU/Ref)</label>
                                    <input type="text" value={editingProduct.SKU} onChange={e => setEditingProduct({...editingProduct, SKU: e.target.value})}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none font-mono transition-colors ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-slate-50 border-slate-200 focus:border-blue-500'}`} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>السعر (DH)</label>
                                    <input type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none font-bold text-green-500 transition-colors ${dm ? 'bg-gray-900 border-gray-700 focus:border-green-500' : 'bg-slate-50 border-slate-200 focus:border-green-500'}`} />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>التصنيف</label>
                                <select value={editingProduct.Category_ID} onChange={e => setEditingProduct({...editingProduct, Category_ID: parseInt(e.target.value)})}
                                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-slate-50 border-slate-200 focus:border-blue-500'}`}>
                                    {Object.entries(CAT_MAP).map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>صور جديدة (يستبدل الصور الحالية إن وجدت)</label>
                                <input type="file" multiple accept="image/*" onChange={e => setEditFiles(e.target.files)}
                                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${dm ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`} />
                                {editFiles.length > 0 && <p className="text-xs text-blue-500 mt-1">تم اختيار {editFiles.length} صورة.</p>}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 mt-2">
                            <button onClick={() => setEditingProduct(null)} disabled={editProductLoading}
                                className={`flex-1 py-2.5 rounded-xl font-medium ${dm ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                                إلغاء
                            </button>
                            <button onClick={() => saveProductDetails(editingProduct, editFiles)} disabled={editProductLoading}
                                className="flex-1 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                                {editProductLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                                {editProductLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Add Expense Modal ── */}
            {createExpenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCreateExpenseModal(false)} />
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 ${dm ? 'bg-gray-900 text-white' : 'bg-white text-slate-900'}`}>
                        <h3 className="text-lg font-bold border-b pb-3 mb-4" style={{borderColor: dm ? '#1f2937' : '#e2e8f0'}}>إضافة مصروف جديد</h3>
                        <div className="space-y-3">
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الوصف *</label>
                                <input type="text" value={newExpenseData.Description} onChange={e => setNewExpenseData({...newExpenseData, Description: e.target.value})}
                                    placeholder="مثال: فاتورة كهرباء، شراء أكياس..."
                                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${dm ? 'bg-gray-800 border-gray-700 focus:border-blue-500' : 'bg-slate-50 border-slate-300 focus:border-blue-500'}`} />
                            </div>
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>المبلغ (DH) *</label>
                                <input type="number" value={newExpenseData.Amount} onChange={e => setNewExpenseData({...newExpenseData, Amount: e.target.value})}
                                    className={`w-full px-3 py-2 rounded-lg border text-sm font-bold text-red-500 outline-none ${dm ? 'bg-gray-800 border-gray-700 focus:border-red-500' : 'bg-slate-50 border-slate-300 focus:border-red-500'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>المسؤول (اختياري)</label>
                                    <input type="text" value={newExpenseData['Paid By']} onChange={e => setNewExpenseData({...newExpenseData, 'Paid By': e.target.value})}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${dm ? 'bg-gray-800 border-gray-700 focus:border-blue-500' : 'bg-slate-50 border-slate-300 focus:border-blue-500'}`} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>التاريخ</label>
                                    <input type="date" value={newExpenseData.Date} onChange={e => setNewExpenseData({...newExpenseData, Date: e.target.value})}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${dm ? 'bg-gray-800 border-gray-700 focus:border-blue-500' : 'bg-slate-50 border-slate-300 focus:border-blue-500'}`} />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4 border-t mt-2" style={{borderColor: dm ? '#374151' : '#e2e8f0'}}>
                            <button onClick={() => setCreateExpenseModal(false)}
                                className={`flex-1 py-2 rounded-xl font-medium ${dm ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}>
                                إلغاء
                            </button>
                            <button onClick={submitExpense} disabled={expensesLoading}
                                className="flex-1 py-2 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                                {expensesLoading ? 'جاري الحفظ...' : 'إضافة المصروف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create Manual Order Modal ── */}
            {createOrderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCreateOrderModal(false)} />
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col space-y-4 ${dm ? 'bg-gray-900 text-white' : 'bg-white text-slate-900'}`}>
                        <h3 className="text-lg font-bold border-b pb-3" style={{borderColor: dm ? '#1f2937' : '#e2e8f0'}}>إنشاء طلب يدوي</h3>
                        
                        <div className="overflow-y-auto pr-2 space-y-4 flex-1">
                            {/* Customer Info */}
                            <div className={`p-4 rounded-xl border ${dm ? 'border-gray-800 bg-gray-800/50' : 'border-slate-200 bg-slate-50/50'}`}>
                                <h4 className="text-sm font-bold mb-3">معلومات الزبون</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الاسم الكامل *</label>
                                        <input type="text" value={newOrderData.name} onChange={e => setNewOrderData({...newOrderData, name: e.target.value})}
                                            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-white border-slate-300 focus:border-blue-500'}`} />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>رقم الهاتف *</label>
                                        <input type="tel" value={newOrderData.phone} onChange={e => setNewOrderData({...newOrderData, phone: e.target.value})}
                                            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none text-left font-mono ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-white border-slate-300 focus:border-blue-500'}`} />
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>العنوان</label>
                                    <input type="text" value={newOrderData.address} onChange={e => setNewOrderData({...newOrderData, address: e.target.value})}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-white border-slate-300 focus:border-blue-500'}`} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>ملاحظات</label>
                                    <input type="text" value={newOrderData.notes} onChange={e => setNewOrderData({...newOrderData, notes: e.target.value})}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-white border-slate-300 focus:border-blue-500'}`} />
                                </div>
                            </div>

                            {/* Products Selection */}
                            <div className={`p-4 rounded-xl border ${dm ? 'border-gray-800 bg-gray-800/50' : 'border-slate-200 bg-slate-50/50'}`}>
                                <h4 className="text-sm font-bold mb-3">المنتجات *</h4>
                                
                                {/* Product Search */}
                                <div className={`relative mb-3 ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />
                                    <input type="text" placeholder="ابحث لإضافة منتج..." value={manualOrderSearch}
                                        onChange={e => setManualOrderSearch(e.target.value)}
                                        className={`w-full pr-9 pl-4 py-2.5 rounded-xl border outline-none text-sm ${dm ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-white border-slate-300 focus:border-blue-500'}`} />
                                    
                                    {manualOrderSearch && (
                                        <div className={`absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border shadow-xl z-20 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
                                            {products.filter(p => (p.Title || p.title || '').toLowerCase().includes(manualOrderSearch.toLowerCase()) || (p.SKU || p.Ref || '').toLowerCase().includes(manualOrderSearch.toLowerCase())).slice(0, 10).map(p => (
                                                <div key={p.Id} 
                                                    className={`p-2 border-b last:border-0 cursor-pointer flex justify-between items-center ${dm ? 'border-gray-700 hover:bg-gray-700' : 'border-slate-100 hover:bg-slate-50'}`}
                                                    onClick={() => {
                                                        const exists = newOrderData.items.find(i => i.Id === p.Id);
                                                        if (exists) {
                                                            setNewOrderData({...newOrderData, items: newOrderData.items.map(i => i.Id === p.Id ? {...i, quantity: i.quantity + 1} : i)});
                                                        } else {
                                                            setNewOrderData({...newOrderData, items: [...newOrderData.items, { ...p, quantity: 1 }]});
                                                        }
                                                        setManualOrderSearch('');
                                                    }}
                                                >
                                                    <div>
                                                        <p className="font-bold text-sm">{p.Title || p.title}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono">{p.SKU || p.Ref}</p>
                                                    </div>
                                                    <span className="text-green-500 font-bold text-sm">{p.price || p.Price || 0} DH</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Items */}
                                <div className="space-y-2">
                                    {newOrderData.items.map((item, idx) => (
                                        <div key={item.Id} className={`flex items-center justify-between p-2 rounded-lg border ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}>
                                            <div className="flex-1 min-w-0 pr-2">
                                                <p className="font-bold text-sm truncate">{item.Title || item.title}</p>
                                                <p className="text-green-500 font-bold text-xs">{item.price || item.Price || 0} DH</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mr-2">
                                                <button onClick={() => {
                                                    if (item.quantity > 1) {
                                                        setNewOrderData({...newOrderData, items: newOrderData.items.map(i => i.Id === item.Id ? {...i, quantity: i.quantity - 1} : i)});
                                                    } else {
                                                        setNewOrderData({...newOrderData, items: newOrderData.items.filter(i => i.Id !== item.Id)});
                                                    }
                                                }} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded shadow-sm font-bold">-</button>
                                                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => setNewOrderData({...newOrderData, items: newOrderData.items.map(i => i.Id === item.Id ? {...i, quantity: i.quantity + 1} : i)})}
                                                    className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded shadow-sm font-bold">+</button>
                                            </div>
                                            <button onClick={() => setNewOrderData({...newOrderData, items: newOrderData.items.filter(i => i.Id !== item.Id)})}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mr-2 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-3 border-t font-bold flex justify-between" style={{borderColor: dm ? '#374151' : '#e2e8f0'}}>
                                    <span>المجموع الإجمالي:</span>
                                    <span className="text-green-500 text-lg">
                                        {newOrderData.items.reduce((sum, item) => sum + ((item.price || item.Price || 0) * item.quantity), 0)} DH
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setCreateOrderModal(false)}
                                className={`flex-1 py-2.5 rounded-xl font-medium ${dm ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}>
                                إلغاء
                            </button>
                            <button onClick={submitManualOrder} disabled={loading}
                                className="flex-1 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex justify-center items-center gap-2">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : 'إنشاء الطلب'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Ozon Express Modal ── */}
            {ozonModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={`w-full max-w-md rounded-2xl shadow-xl overflow-hidden ${dm ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
                        <div className={`px-5 py-4 border-b flex justify-between items-center ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Truck className="text-purple-500" />
                                إرسال إلى Ozon Express
                            </h3>
                            <button onClick={() => setOzonModalOpen(false)} className={`p-1.5 rounded-lg transition-colors ${dm ? 'hover:bg-gray-800' : 'hover:bg-slate-100'}`}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1.5 opacity-70">اسم المستلم</label>
                                <input type="text" value={ozonFormData.name} onChange={e => setOzonFormData({...ozonFormData, name: e.target.value})}
                                    className={`w-full px-3 py-2 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-purple-500' : 'bg-slate-50 border-slate-200 focus:border-purple-500'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 opacity-70">الهاتف</label>
                                    <input type="text" value={ozonFormData.phone} onChange={e => setOzonFormData({...ozonFormData, phone: e.target.value})}
                                        className={`w-full px-3 py-2 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-purple-500' : 'bg-slate-50 border-slate-200 focus:border-purple-500'}`} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 opacity-70">المبلغ (درهم)</label>
                                    <input type="number" value={ozonFormData.price} onChange={e => setOzonFormData({...ozonFormData, price: e.target.value})}
                                        className={`w-full px-3 py-2 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-purple-500' : 'bg-slate-50 border-slate-200 focus:border-purple-500'}`} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1.5 opacity-70">المدينة</label>
                                <select value={ozonFormData.city} onChange={e => setOzonFormData({...ozonFormData, city: e.target.value})}
                                    className={`w-full px-3 py-2 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-purple-500' : 'bg-slate-50 border-slate-200 focus:border-purple-500'}`}>
                                    <option value="">اختر المدينة...</option>
                                    {ozonCities.map(c => (
                                        <option key={c.ID} value={c.ID}>{c.NAME}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1.5 opacity-70">العنوان الكامل</label>
                                <textarea value={ozonFormData.address} onChange={e => setOzonFormData({...ozonFormData, address: e.target.value})} rows={2}
                                    className={`w-full px-3 py-2 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-purple-500' : 'bg-slate-50 border-slate-200 focus:border-purple-500'}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1.5 opacity-70">ملاحظات لشركة التوصيل</label>
                                <textarea value={ozonFormData.note} onChange={e => setOzonFormData({...ozonFormData, note: e.target.value})} rows={2}
                                    className={`w-full px-3 py-2 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-purple-500' : 'bg-slate-50 border-slate-200 focus:border-purple-500'}`} />
                            </div>
                            
                            <button onClick={submitToOzon} disabled={ozonLoading}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4">
                                {ozonLoading ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
                                {ozonLoading ? 'جاري الإرسال...' : 'تأكيد الإرسال'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
