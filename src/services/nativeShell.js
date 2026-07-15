import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';

let initialized = false;

export const isNativeApp = () => (
  typeof window !== 'undefined' && Capacitor.isNativePlatform()
);

export async function initNativeShell() {
  if (!isNativeApp() || initialized) return;
  initialized = true;

  document.documentElement.classList.add('native-app');

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#142038' });
  } catch (error) {
    console.warn('StatusBar unavailable:', error);
  }

  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
      return;
    }
    CapApp.exitApp();
  });

  CapApp.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url);
      const next = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (next && next !== window.location.pathname + window.location.search + window.location.hash) {
        window.location.assign(next);
      }
    } catch (error) {
      console.warn('Invalid app deep link:', url, error);
    }
  });

  Network.addListener('networkStatusChange', status => {
    window.dispatchEvent(new CustomEvent('native-network', {
      detail: { connected: status.connected },
    }));
  });

  requestAnimationFrame(() => {
    SplashScreen.hide().catch(() => {});
  });
}
