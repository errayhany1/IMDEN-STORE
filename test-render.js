import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AuthModal from './src/components/AuthModal.jsx';

// Mock Zustand store
jest.mock('./src/store/useStore.js', () => {
  return () => ({
    isAuthModalOpen: true,
    setAuthModalOpen: () => {},
    darkMode: false
  });
});

try {
  const html = ReactDOMServer.renderToString(React.createElement(AuthModal));
  console.log("Render successful. HTML:", html);
} catch (e) {
  console.error("Render failed:", e);
}
