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

        // Prioritize thumbnails for PDF (faster, lighter, avoids some CORS issues if main image is huge)
        if (item.originalData && item.originalData.Image1 && item.originalData.Image1.length > 0) {
            const imgObj = item.originalData.Image1[0];
            if (imgObj.thumbnails) {
                if (imgObj.thumbnails.card_cover?.signedUrl) {
                    maxResImage = imgObj.thumbnails.card_cover.signedUrl;
                } else if (imgObj.thumbnails.small?.signedUrl) {
                    maxResImage = imgObj.thumbnails.small.signedUrl;
                }
            } else {
                maxResImage = imgObj.signedUrl || imgObj.url;
            }
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

    doc.save(`IMDEN_TECHNOLOGY_0681652324_${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
};

export const generateWhatsAppMessage = (cartItems) => {
    let total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    let message = "السلام عليكم،\n";
    message += "المرجو الاطلاع على ملف الطلبية (PDF) المرفق أسفله للتفاصيل.\n\n";
    message += `*المجموع الكلي: ${total.toFixed(2)} DH*`;

    return encodeURIComponent(message);
};
