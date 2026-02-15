import React from 'react';
import { MessageCircle } from 'lucide-react';

const FloatingWhatsApp = () => {
    const phoneNumber = "212681652324"; // Replace with actual number if provided
    const whatsappUrl = `https://wa.me/${phoneNumber}`;

    return (
        <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 z-50 flex items-center justify-center"
            aria-label="Chat on WhatsApp"
        >
            <MessageCircle size={32} />
        </a>
    );
};

export default FloatingWhatsApp;
