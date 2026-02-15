import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDF = (cartItems) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text("Order Summary", 14, 22);
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

    // Table Data
    const tableData = cartItems.map(item => [
        '', // Placeholder for image
        item.ref || 'N/A',
        item.name,
        `${item.price} DH`,
        item.quantity,
        `${(item.price * item.quantity).toFixed(2)} DH`
    ]);

    // Calculate Total
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    tableData.push(['', '', '', 'Total', `${total.toFixed(2)} DH`]);

    autoTable(doc, {
        head: [['Image', 'Reference', 'Product', 'Price', 'Qty', 'Total']],
        body: tableData,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
        footStyles: { fillColor: [22, 163, 74] },
        bodyStyles: { minCellHeight: 15, valign: 'middle' },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const item = cartItems[data.row.index];
                if (item && item.image) {
                    try {
                        doc.addImage(item.image, 'JPEG', data.cell.x + 2, data.cell.y + 2, 10, 10);
                    } catch (e) {
                        // Image loading failed or invalid format
                    }
                }
            }
        }
    });

    // Footer for WhatsApp
    const finalY = doc.lastAutoTable.finalY || 150;
    doc.text("Sent via Wholesale Catalog", 14, finalY + 10);

    doc.save(`Order_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const generateWhatsAppMessage = (cartItems) => {
    let message = "Hello, I would like to order:\n\n";
    let total = 0;

    cartItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        message += `- ${item.name} (Ref: ${item.ref}): ${item.quantity} x ${item.price} DH = ${itemTotal} DH\n`;
    });

    message += `\n*Total: ${total} DH*`;
    return encodeURIComponent(message);
};
