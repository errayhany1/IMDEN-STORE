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

export const generatePDF = async (cartItems, saveToDisk = true) => {
    const doc = new jsPDF();

    // Load images first
    const itemsWithImages = await Promise.all(cartItems.map(async (item) => {
        // Try to fetch the image as base64 to embed in PDF
        const base64Img = item.image ? await getDataUrl(item.image) : null;
        return { ...item, base64Img };
    }));

    // Header
    doc.setFontSize(22);
    doc.setTextColor(25, 127, 230); // Primary Blue
    doc.text("IMDEN TECHNOLOGY", 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Premier Magasin de Vente en Gros d'Electronique au Maroc", 14, 24);
    doc.text("Website: https://imden-technology.com | WhatsApp: +212 664 630 566", 14, 29);
    doc.text(`Date de commande: ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}`, 14, 34);
    doc.text(`Total des articles: ${cartItems.length}`, 14, 39);

    // Table Data
    const tableData = itemsWithImages.map(item => [
        '', // Image column
        item.ref || 'N/A',
        item.name || 'Produit sans nom',
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
        startY: 44,
        theme: 'grid',
        headStyles: {
            fillColor: [25, 127, 230], // Primary Blue
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 9
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 1 // Tighten internal cell padding
        },
        columnStyles: {
            0: { cellWidth: 14, minCellHeight: 10, valign: 'middle', halign: 'center' }, // Compressed Image column
            1: { cellWidth: 22, valign: 'middle', halign: 'center' }, // Ref
            2: { valign: 'middle' }, // Product Name
            3: { cellWidth: 20, valign: 'middle', halign: 'right' }, // Price
            4: { cellWidth: 12, valign: 'middle', halign: 'center' }, // Qty
            5: { cellWidth: 25, valign: 'middle', halign: 'right', fontStyle: 'bold' } // Total
        },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const item = itemsWithImages[data.row.index];
                if (item && item.base64Img) {
                    try {
                        const dim = 8; // Compressed image dimension
                        doc.addImage(item.base64Img, 'JPEG', data.cell.x + 3, data.cell.y + 1, dim, dim);
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

    const fileName = `IMDEN_TECHNOLOGY_0664630566_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    if (saveToDisk) {
        doc.save(fileName);
    }

    // Return the File object for Web Share API or Telegram Bot
    const pdfBlob = doc.output('blob');
    return new File([pdfBlob], fileName, { type: 'application/pdf' });
};

export const generateWhatsAppMessage = (cartItems) => {
    let total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    let message = "السلام عليكم،\n";
    message += "المرجو الاطلاع على ملف الطلبية (PDF) المرفق أسفله للتفاصيل.\n\n";
    message += `*المجموع الكلي: ${total.toFixed(2)} DH*`;

    return encodeURIComponent(message);
};
