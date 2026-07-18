import axios from 'axios';

const NOCODB_URL = import.meta.env.VITE_NOCODB_URL;
const NOCODB_TOKEN = import.meta.env.VITE_NOCODB_ORDERS_TOKEN
    || import.meta.env.VITE_NOCODB_API_TOKEN;
const ORDERS_TABLE = import.meta.env.VITE_NOCODB_TABLE_ORDERS;
const CUSTOMERS_TABLE = import.meta.env.VITE_NOCODB_TABLE_CUSTOMERS;
const accountSyncs = new Map();

const headers = {
    'xc-token': NOCODB_TOKEN,
    'Content-Type': 'application/json',
};

export const isCustomerAccountsConfigured = Boolean(
    NOCODB_URL && NOCODB_TOKEN && ORDERS_TABLE
);
export const isCustomerProfilesConfigured = Boolean(
    isCustomerAccountsConfigured && CUSTOMERS_TABLE
);

export const normalizeMoroccanPhone = (value = '') => {
    let digits = String(value).replace(/\D/g, '');
    if (digits.startsWith('00212')) digits = digits.slice(5);
    else if (digits.startsWith('212')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);

    if (!/^[67]\d{8}$/.test(digits)) return '';
    return `+212${digits}`;
};

export const formatMoroccanPhone = (value = '') => {
    const normalized = normalizeMoroccanPhone(value);
    return normalized ? `0${normalized.slice(4)}` : '';
};

const safeWhereValue = (value = '') => (
    String(value).replace(/[(),]/g, '').trim()
);

const getRecordId = record => record?.Id || record?.id;
const toBoolean = value => (
    value === true || value === 1 || value === '1' || value === 'true'
);

const mapProfile = record => {
    if (!record) return null;
    return {
        id: getRecordId(record),
        uid: record['Firebase UID'] || '',
        email: record.Email || '',
        name: record.Name || '',
        phone: record.Phone || formatMoroccanPhone(record['Phone Normalized']) || '',
        normalizedPhone: normalizeMoroccanPhone(
            record['Phone Normalized'] || record.Phone
        ),
        address: record.Address || '',
        phoneVerified: toBoolean(record['Phone Verified']),
        authProvider: record['Auth Provider'] || '',
    };
};

export const getCustomerProfile = async uid => {
    if (!isCustomerProfilesConfigured || !uid) return null;

    const response = await axios.get(
        `${NOCODB_URL}/api/v2/tables/${CUSTOMERS_TABLE}/records`,
        {
            headers,
            params: {
                where: `(Firebase UID,eq,${safeWhereValue(uid)})`,
                limit: 1,
            },
        }
    );
    return mapProfile(response.data.list?.[0]);
};

export const upsertCustomerProfile = async (user, details = {}) => {
    if (!isCustomerProfilesConfigured || !user?.uid) return null;

    const existing = await getCustomerProfile(user.uid);
    const normalizedPhone = normalizeMoroccanPhone(
        details.normalizedPhone
        || details.phone
        || user.phoneNumber
        || existing?.normalizedPhone
    );
    const provider = user.providerData?.[0]?.providerId || 'firebase';

    const payload = {
        'Firebase UID': user.uid,
        Email: details.email ?? user.email ?? existing?.email ?? '',
        Name: details.name ?? existing?.name ?? user.displayName ?? '',
        Phone: details.phone
            ?? existing?.phone
            ?? formatMoroccanPhone(normalizedPhone),
        'Phone Normalized': normalizedPhone,
        Address: details.address ?? existing?.address ?? '',
        'Phone Verified': details.phoneVerified
            ?? existing?.phoneVerified
            ?? Boolean(user.phoneNumber),
        'Auth Provider': provider,
    };

    if (existing?.id) {
        await axios.patch(
            `${NOCODB_URL}/api/v2/tables/${CUSTOMERS_TABLE}/records`,
            { Id: existing.id, ...payload },
            { headers }
        );
    } else {
        await axios.post(
            `${NOCODB_URL}/api/v2/tables/${CUSTOMERS_TABLE}/records`,
            payload,
            { headers }
        );
    }

    return getCustomerProfile(user.uid);
};

const fetchOrdersByWhere = async where => {
    if (!NOCODB_URL || !NOCODB_TOKEN || !ORDERS_TABLE || !where) return [];
    const response = await axios.get(
        `${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`,
        {
            headers,
            params: { where, limit: 100, sort: '-Id' },
        }
    );
    return response.data.list || [];
};

export const getOrdersForAccount = async ({ uid, phone }) => {
    const normalizedPhone = normalizeMoroccanPhone(phone);
    const requests = [];

    if (uid) {
        requests.push(
            fetchOrdersByWhere(`(Customer UID,eq,${safeWhereValue(uid)})`)
                .catch(() => [])
        );
    }

    if (normalizedPhone) {
        requests.push(
            fetchOrdersByWhere(
                `(Customer Phone Normalized,eq,${safeWhereValue(normalizedPhone)})`
            ).catch(() => [])
        );
        // Historical orders have only Customer Phone with inconsistent spacing.
        requests.push(
            fetchOrdersByWhere(
                `(Customer Phone,like,%${normalizedPhone.slice(-9)}%)`
            ).catch(() => [])
        );
    }

    const groups = await Promise.all(requests);
    const byId = new Map();
    groups.flat().forEach(order => {
        const id = getRecordId(order);
        if (id != null) byId.set(String(id), order);
    });

    return [...byId.values()].sort(
        (a, b) => Number(getRecordId(b) || 0) - Number(getRecordId(a) || 0)
    );
};

const infoFromLatestOrder = orders => {
    const latest = orders?.[0];
    if (!latest) return {};
    return {
        name: latest['Customer Name'] || '',
        phone: latest['Customer Phone'] || '',
        address: latest['Delivery Address'] || '',
    };
};

const performCustomerAccountSync = async user => {
    if (!user) {
        return {
            profile: null,
            customerInfo: { name: '', phone: '', address: '' },
            orders: [],
            requiresPhoneVerification: false,
        };
    }

    let profile = await getCustomerProfile(user.uid);
    const authPhone = normalizeMoroccanPhone(user.phoneNumber);

    if (authPhone && (!profile?.phoneVerified || profile.normalizedPhone !== authPhone)) {
        profile = await upsertCustomerProfile(user, {
            phone: formatMoroccanPhone(authPhone),
            normalizedPhone: authPhone,
            phoneVerified: true,
        });
    }

    const verifiedPhone = authPhone || (
        profile?.phoneVerified ? profile.normalizedPhone : ''
    );
    const orders = await getOrdersForAccount({
        uid: user.uid,
        phone: verifiedPhone,
    });
    const historicalInfo = infoFromLatestOrder(orders);

    const customerInfo = {
        name: profile?.name || historicalInfo.name || user.displayName || '',
        phone: profile?.phone
            || historicalInfo.phone
            || formatMoroccanPhone(verifiedPhone),
        address: profile?.address || historicalInfo.address || '',
        normalizedPhone: verifiedPhone,
        phoneVerified: Boolean(verifiedPhone),
        uid: user.uid,
    };

    // Save profile when we have a verified phone OR an email (for offers list).
    if (verifiedPhone || user.email) {
        profile = await upsertCustomerProfile(user, {
            ...customerInfo,
            email: user.email || profile?.email || '',
        });
    }

    return {
        profile,
        customerInfo,
        orders,
        requiresPhoneVerification: !verifiedPhone,
    };
};

export const syncCustomerAccount = user => {
    if (!user?.uid) return performCustomerAccountSync(user);
    if (accountSyncs.has(user.uid)) return accountSyncs.get(user.uid);

    const promise = performCustomerAccountSync(user)
        .finally(() => accountSyncs.delete(user.uid));
    accountSyncs.set(user.uid, promise);
    return promise;
};

