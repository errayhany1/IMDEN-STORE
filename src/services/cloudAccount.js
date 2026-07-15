import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const MAX_CART_ITEMS = 100;
const MAX_SAVED_ITEMS = 200;

const productKey = item => String(
    item?.id ?? item?.Id ?? item?.ref ?? item?.SKU ?? ''
);

const sanitizeText = (value, maxLength = 500) => (
    typeof value === 'string' ? value.slice(0, maxLength) : ''
);

const sanitizeProduct = (item, withQuantity = false) => {
    const clean = {
        id: sanitizeText(String(item?.id ?? item?.Id ?? ''), 100),
        ref: sanitizeText(String(item?.ref ?? item?.SKU ?? ''), 100),
        name: sanitizeText(item?.name ?? item?.Title ?? '', 200),
        image: sanitizeText(item?.image ?? '', 2000),
        price: Number(item?.price ?? item?.Price ?? 0) || 0,
        category: sanitizeText(item?.category ?? '', 100),
    };
    if (withQuantity) {
        clean.quantity = Math.min(9999, Math.max(1, Number(item?.quantity) || 1));
    }
    return clean;
};

const serializeItems = (items, limit, withQuantity = false) => JSON.stringify(
    (Array.isArray(items) ? items : [])
        .filter(productKey)
        .slice(0, limit)
        .map(item => sanitizeProduct(item, withQuantity))
);

const parseItems = value => {
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const mergeItems = (localItems, cloudItems, withQuantity = false) => {
    const merged = new Map();
    [...(cloudItems || []), ...(localItems || [])].forEach(item => {
        const key = productKey(item);
        if (!key) return;
        const existing = merged.get(key);
        merged.set(key, {
            ...(existing || {}),
            ...item,
            ...(withQuantity ? {
                quantity: Math.max(
                    Number(existing?.quantity) || 0,
                    Number(item?.quantity) || 1
                ),
            } : {}),
        });
    });
    return [...merged.values()];
};

export const loadCloudAccount = async user => {
    if (!user?.uid) return null;
    const snapshot = await getDoc(doc(db, 'customerAccounts', user.uid));
    if (!snapshot.exists()) {
        return {
            exists: false,
            customerInfo: null,
            cart: [],
            wishlist: [],
            restockSubscriptions: [],
        };
    }

    const data = snapshot.data();
    return {
        exists: true,
        customerInfo: {
            uid: user.uid,
            name: data.name || user.displayName || '',
            phone: data.phone || user.phoneNumber || '',
            address: data.address || '',
            normalizedPhone: data.normalizedPhone || '',
            phoneVerified: Boolean(data.phoneVerified || user.phoneNumber),
        },
        cart: parseItems(data.cartJson),
        wishlist: parseItems(data.wishlistJson),
        restockSubscriptions: parseItems(data.restockJson),
    };
};

export const mergeAccountState = (localState, cloudState) => ({
    cart: mergeItems(localState.cart, cloudState?.cart, true).slice(0, MAX_CART_ITEMS),
    wishlist: mergeItems(localState.wishlist, cloudState?.wishlist).slice(0, MAX_SAVED_ITEMS),
    restockSubscriptions: mergeItems(
        localState.restockSubscriptions,
        cloudState?.restockSubscriptions
    ).slice(0, MAX_SAVED_ITEMS),
    customerInfo: {
        ...(localState.customerInfo || {}),
        ...(cloudState?.customerInfo || {}),
    },
});

export const saveCloudAccount = async (user, state, { create = false } = {}) => {
    if (!user?.uid) return;
    const info = state.customerInfo?.uid === user.uid ? state.customerInfo : {};
    const payload = {
        uid: user.uid,
        email: sanitizeText(user.email || '', 320),
        displayName: sanitizeText(user.displayName || '', 100),
        name: sanitizeText(info.name || user.displayName || '', 100),
        phone: sanitizeText(info.phone || user.phoneNumber || '', 30),
        normalizedPhone: sanitizeText(info.normalizedPhone || '', 30),
        address: sanitizeText(info.address || '', 500),
        phoneVerified: Boolean(info.phoneVerified || user.phoneNumber),
        cartJson: serializeItems(state.cart, MAX_CART_ITEMS, true),
        wishlistJson: serializeItems(state.wishlist, MAX_SAVED_ITEMS),
        restockJson: serializeItems(
            state.restockSubscriptions,
            MAX_SAVED_ITEMS
        ),
        updatedAt: serverTimestamp(),
        ...(create ? { createdAt: serverTimestamp() } : {}),
    };

    await setDoc(doc(db, 'customerAccounts', user.uid), payload, { merge: true });
};
