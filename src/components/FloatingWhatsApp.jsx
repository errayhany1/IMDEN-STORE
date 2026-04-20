import React from 'react';
import SocialButton from './SocialButton';

const TELEGRAM_URL = 'https://t.me/Imden_technology';
const WA_NUMBER = '212664630566';

const FloatingWhatsApp = () => (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
        {/* Telegram */}
        <SocialButton
            type="telegram"
            href={TELEGRAM_URL}
            iconOnly
            className="w-14 h-14 shadow-lg"
        />
        {/* WhatsApp */}
        <SocialButton
            type="whatsapp"
            href={`https://wa.me/${WA_NUMBER}`}
            iconOnly
            className="w-14 h-14 shadow-lg"
        />
    </div>
);

export default FloatingWhatsApp;
