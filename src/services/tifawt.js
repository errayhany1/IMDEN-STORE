export const createStoreOrderId = () => {
    return 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
};

export const syncOrderSideEffects = async (orderData) => {
    console.log('Dummy syncOrderSideEffects called', orderData);
    return true;
};
