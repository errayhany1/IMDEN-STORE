import { create } from 'zustand';

const translations = {
  ar: {
    // Header
    searchPlaceholder: "ابحث بالمرجع أو الاسم...",
    myAccountAndOrders: "حسابي وطلباتي",
    deliveryInfo: "معلومات التوصيل",
    lightMode: "الوضع الفاتح",
    darkMode: "الوضع الداكن",
    trackOrder: "تتبع طلبك",
    aboutUs: "حول المتجر",
    logout: "تسجيل الخروج",
    login: "تسجيل الدخول",
    cart: "السلة",
    
    // Cart
    cartTitle: "سلة المشتريات",
    emptyCart: "السلة فارغة",
    emptyCartDesc: "قم بإضافة بعض المنتجات للسلة لتظهر هنا",
    subtotal: "المجموع الكلي",
    checkout: "إتمام الطلب",
    
    // Product
    addToCart: "إضافة للسلة",
    added: "تمت الإضافة ✓",
    outOfStock: "نفد من المخزون",
    viewDetails: "التفاصيل",
    price: "درهم",
    categories: "الفئات",
    allProducts: "كل المنتجات",
    
    // Checkout Modal
    completeOrder: "إتمام الطلب",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    address: "عنوان التوصيل (المدينة، الحي...)",
    notes: "ملاحظات إضافية (اختياري)",
    confirmOrder: "تأكيد الطلب",
    submitting: "جاري الإرسال...",
    back: "رجوع",
    continueAsGuest: "المتابعة كزائر",
    loginToSave: "سجل الدخول لحفظ طلباتك",
    
    // Account Page
    myOrders: "سجل الطلبات",
    pending: "قيد المراجعة",
    shipped: "تم الشحن",
    delivered: "تم التوصيل",
    cancelled: "ملغي",
    noOrders: "لا توجد طلبات بعد",
    noOrdersDesc: "عندما تقوم بعملية شراء، ستظهر طلباتك هنا.",
    browseProducts: "تصفح المنتجات ←",
    orderNum: "طلب #",
    productsCount: "منتج",
    deliveryAddress: "عنوان التوصيل",
    
    // Misc
    contactUs: "تواصل معنا عبر واتساب",
    loading: "جاري التحميل...",
    refresh: "تحديث"
  },
  fr: {
    // Header
    searchPlaceholder: "Rechercher par référence ou nom...",
    myAccountAndOrders: "Mon Compte & Commandes",
    deliveryInfo: "Infos de Livraison",
    lightMode: "Mode Clair",
    darkMode: "Mode Sombre",
    trackOrder: "Suivre la commande",
    aboutUs: "À Propos",
    logout: "Se déconnecter",
    login: "Se connecter",
    cart: "Panier",
    
    // Cart
    cartTitle: "Panier d'achats",
    emptyCart: "Le panier est vide",
    emptyCartDesc: "Ajoutez quelques produits au panier pour qu'ils s'affichent ici",
    subtotal: "Sous-total",
    checkout: "Passer la commande",
    
    // Product
    addToCart: "Ajouter au panier",
    added: "Ajouté ✓",
    outOfStock: "Rupture de stock",
    viewDetails: "Détails",
    price: "DH",
    categories: "Catégories",
    allProducts: "Tous les produits",
    
    // Checkout Modal
    completeOrder: "Passer la commande",
    fullName: "Nom complet",
    phone: "Numéro de téléphone",
    address: "Adresse de livraison (Ville, Quartier...)",
    notes: "Notes supplémentaires (Optionnel)",
    confirmOrder: "Confirmer la commande",
    submitting: "Envoi en cours...",
    back: "Retour",
    continueAsGuest: "Continuer comme invité",
    loginToSave: "Connectez-vous pour sauvegarder",
    
    // Account Page
    myOrders: "Historique des commandes",
    pending: "En attente",
    shipped: "Expédié",
    delivered: "Livré",
    cancelled: "Annulé",
    noOrders: "Aucune commande pour le moment",
    noOrdersDesc: "Lorsque vous effectuez un achat, vos commandes apparaîtront ici.",
    browseProducts: "Parcourir les produits ←",
    orderNum: "Commande #",
    productsCount: "produit",
    deliveryAddress: "Adresse de livraison",
    
    // Misc
    contactUs: "Contactez-nous sur WhatsApp",
    loading: "Chargement...",
    refresh: "Actualiser"
  }
};

export const useTranslation = create((set, get) => ({
  language: localStorage.getItem('site_lang') || 'ar',
  setLanguage: (lang) => {
    localStorage.setItem('site_lang', lang);
    set({ language: lang });
    // Update document direction
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  },
  t: (key) => {
    const { language } = get();
    return translations[language][key] || translations['ar'][key] || key;
  }
}));

// Initialize document direction
document.documentElement.dir = (localStorage.getItem('site_lang') || 'ar') === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = localStorage.getItem('site_lang') || 'ar';
