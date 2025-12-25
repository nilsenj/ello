import { loadTranslations } from '@angular/localize';
import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import localeUk from '@angular/common/locales/uk';
import localeFr from '@angular/common/locales/fr';
import localeDe from '@angular/common/locales/de';
import localeEs from '@angular/common/locales/es';
import localeIt from '@angular/common/locales/it';
import localePl from '@angular/common/locales/pl';
import { TRANSLATIONS } from './translations';

export const SUPPORTED_LOCALES = ['en', 'uk', 'fr', 'de', 'es', 'it', 'pl'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = 'ello_locale';
const DEFAULT_LOCALE: SupportedLocale = 'en';

const LOCALE_DATA: Record<SupportedLocale, any> = {
    en: localeEn,
    uk: localeUk,
    fr: localeFr,
    de: localeDe,
    es: localeEs,
    it: localeIt,
    pl: localePl,
};

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
    en: 'English',
    uk: 'Українська',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    it: 'Italiano',
    pl: 'Polski',
};

export function normalizeLocale(input?: string | null): SupportedLocale {
    if (!input) return DEFAULT_LOCALE;
    const base = input.toLowerCase().split('-')[0] as SupportedLocale;
    return SUPPORTED_LOCALES.includes(base) ? base : DEFAULT_LOCALE;
}

export function getStoredLocale(): SupportedLocale {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
    return normalizeLocale(navigator.language);
}

export function setStoredLocale(locale: SupportedLocale) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, locale);
}

export function applyLocale(locale: SupportedLocale): SupportedLocale {
    const normalized = normalizeLocale(locale);
    const translations = TRANSLATIONS[normalized] ?? {};
    if (normalized !== 'en' && Object.keys(translations).length) {
        loadTranslations(translations);
    }
    registerLocaleData(LOCALE_DATA[normalized]);
    if (typeof document !== 'undefined') {
        document.documentElement.lang = normalized;
    }
    return normalized;
}
