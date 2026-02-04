
'use client';

import { useEffect } from 'react';
import type { AllSettings } from '@/lib/settings-types';
import { getSettingsForClient } from '@/lib/settings';

const SETTINGS_STORAGE_KEY = 'appGeneralSettings';

function hexToHsl(hex: string): string | null {
    if (!hex || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
        return null;
    }
    
    let r: number, g: number, b: number;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    return `${h} ${s}% ${l}%`;
}

function applyTheme(settings: AllSettings | null) {
    if (settings?.appTheme) {
        const theme = settings.appTheme;
        const root = document.documentElement;
        
        const primaryHsl = hexToHsl(theme.primary);
        const backgroundHsl = hexToHsl(theme.background);
        const foregroundHsl = hexToHsl(theme.foreground);
        const accentHsl = hexToHsl(theme.accent);
        
        if(primaryHsl) root.style.setProperty('--primary', primaryHsl);
        if(backgroundHsl) root.style.setProperty('--background', backgroundHsl);
        if(foregroundHsl) root.style.setProperty('--foreground', foregroundHsl);
        if(accentHsl) root.style.setProperty('--accent', accentHsl);
    }
}


export function AppThemeApplicator() {
    useEffect(() => {
        // Apply theme on initial load from localStorage for speed
        const cachedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (cachedSettings) {
            try {
                applyTheme(JSON.parse(cachedSettings));
            } catch (e) {
                console.error("Failed to apply theme from cached settings:", e);
            }
        }
        
        // This is a custom event fired from the admin settings page
        const handleSettingsUpdate = () => {
             console.log("Settings updated event received, refetching and applying theme.");
             getSettingsForClient().then(settings => {
                 localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
                 applyTheme(settings);
             });
        };

        window.addEventListener('settings_updated', handleSettingsUpdate);
        
        return () => {
             window.removeEventListener('settings_updated', handleSettingsUpdate);
        };
    }, []);

    return null;
}
