export const sendToTelegram = async (pdfFile, caption) => {
    const botToken = '8652359538:AAGqVf2MpKHGEAhYuZ1rD5ekk-J3XqBXfqk';
    const chatId = '-1003868832013';

    const formDataObject = new FormData();
    formDataObject.append('chat_id', chatId);
    formDataObject.append('document', pdfFile);
    formDataObject.append('caption', caption);
    formDataObject.append('parse_mode', 'Markdown');

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formDataObject
    });

    if (!response.ok) {
        throw new Error('فشل الإرسال إلى تلغرام.');
    }

    return await response.json();
};

export const sendTransferProofToTelegram = async (proofFile, caption) => {
    const botToken = '8652359538:AAGqVf2MpKHGEAhYuZ1rD5ekk-J3XqBXfqk';
    const chatId = '-1003868832013';

    const formDataObject = new FormData();
    formDataObject.append('chat_id', chatId);
    formDataObject.append('document', proofFile);
    formDataObject.append('caption', caption);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formDataObject
    });

    if (!response.ok) {
        throw new Error('فشل إرسال إثبات التحويل إلى تلغرام.');
    }

    return response.json();
};
