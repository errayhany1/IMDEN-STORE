import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to load image as base64
const getDataUrl = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = () => resolve(null); // Resolve null if image fails to load
    });
};

export const generatePDF = async (cartItems) => {
    const doc = new jsPDF();

    // Load images first
    const itemsWithImages = await Promise.all(cartItems.map(async (item) => {
        let maxResImage = item.image;
        if (item.originalData && item.originalData.Image1 && item.originalData.Image1.length > 0) {
            // Try to get original or medium thumbnail for better PDF quality if available
            const imgObj = item.originalData.Image1[0];
            maxResImage = imgObj.signedUrl || imgObj.url;
        }

        const base64Img = maxResImage ? await getDataUrl(maxResImage) : null;
        return { ...item, base64Img };
    }));

    // Header
    doc.setFontSize(22);
    doc.setTextColor(25, 127, 230); // Primary Blue
    doc.text("Wholesale Order", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}`, 14, 28);
    doc.text(`Items: ${cartItems.length}`, 14, 33);

    // Table Data
    const tableData = itemsWithImages.map(item => [
        '', // Image column
        item.ref || 'N/A',
        item.name,
        `${item.price} DH`,
        item.quantity,
        `${(item.price * item.quantity).toFixed(2)} DH`
    ]);

    // Calculate Total
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Add empty row for spacing
    tableData.push(['', '', '', '', '', '']);
    // Add Total row
    tableData.push(['', '', '', '', 'TOTAL', `${total.toFixed(2)} DH`]);

    autoTable(doc, {
        head: [['Image', 'Ref', 'Product', 'Price', 'Qty', 'Total']],
        body: tableData,
        startY: 40,
        theme: 'grid',
        headStyles: {
            fillColor: [25, 127, 230], // Primary Blue
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 20, minCellHeight: 20, valign: 'middle' }, // Image column
            1: { cellWidth: 25, valign: 'middle', halign: 'center' }, // Ref
            2: { valign: 'middle' }, // Product Name
            3: { cellWidth: 25, valign: 'middle', halign: 'right' }, // Price
            4: { cellWidth: 15, valign: 'middle', halign: 'center' }, // Qty
            5: { cellWidth: 30, valign: 'middle', halign: 'right', fontStyle: 'bold' } // Total
        },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const item = itemsWithImages[data.row.index];
                if (item && item.base64Img) {
                    try {
                        const dim = data.cell.height - 4; // Padding
                        const textPos = data.cell.getTextPos();
                        doc.addImage(item.base64Img, 'JPEG', data.cell.x + 2, data.cell.y + 2, dim, dim);
                    } catch (e) {
                        // Ignore image errors
                    }
                }
            }
            // Style Total Row
            if (data.row.index === tableData.length - 1) {
                doc.setFont(undefined, 'bold');
            }
        }
    });

    doc.save(`Order_${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
};

export const generateWhatsAppMessage = (cartItems) => {
    let message = " السلام عليكم، أريد طلب هذه المنتجات (الملف مرفق):\n\n";
    let total = 0;

    // Summary just in case PDF fails or for quick preview
    cartItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        // Optimization: Don't list everything if list is long, just summary
        if (cartItems.length <= 5) {
            message += `- ${item.name} (${item.quantity} x ${item.price} DH)\n`;
        }
    });

    if (cartItems.length > 5) {
        message += `- ... و ${cartItems.length - 5} منتجات أخرى.\n`;
    }

    message += `\n*المجموع: ${total} DH*`;
    message += `\n\n>> المرجو الاطلاع على ملف PDF المرفق للتفاصيل.`;

    return encodeURIComponent(message);
};
