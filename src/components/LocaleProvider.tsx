'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_LOCALE,
  isLocale,
  Locale,
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  translateText,
} from '@/lib/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);
const originalText = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const renderedAttributes = new WeakMap<Element, Map<string, string>>();
const TRANSLATED_ATTRIBUTES = [
  'alt',
  'aria-label',
  'placeholder',
  'title',
  'content',
] as const;

function ignored(element: Element | null): boolean {
  return Boolean(
    element?.closest(
      'script, style, [data-i18n-ignore], [contenteditable="true"]',
    ),
  );
}

function translateTextNode(node: Text, locale: Locale) {
  if (ignored(node.parentElement)) return;
  const previousRender = renderedText.get(node);
  if (!originalText.has(node) || (previousRender !== undefined && node.data !== previousRender)) {
    originalText.set(node, node.data);
  }
  const source = originalText.get(node) || node.data;
  const translated = translateText(source, locale);
  if (node.data !== translated) node.data = translated;
  renderedText.set(node, translated);
}

function translateElementAttributes(element: Element, locale: Locale) {
  if (ignored(element)) return;
  let attributes = originalAttributes.get(element);
  let rendered = renderedAttributes.get(element);
  if (!attributes) {
    attributes = new Map<string, string>();
    originalAttributes.set(element, attributes);
  }
  if (!rendered) {
    rendered = new Map<string, string>();
    renderedAttributes.set(element, rendered);
  }

  for (const name of TRANSLATED_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value === null) continue;
    const previousRender = rendered.get(name);
    if (!attributes.has(name) || (previousRender !== undefined && value !== previousRender)) {
      attributes.set(name, value);
    }
    const source = attributes.get(name) || value;
    const translated = translateText(source, locale);
    if (value !== translated) element.setAttribute(name, translated);
    rendered.set(name, translated);
  }
}

function translateSubtree(root: Node, locale: Locale) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }
  if (!(root instanceof Element) && !(root instanceof Document)) return;
  if (root instanceof Element) translateElementAttributes(root, locale);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, locale);
    } else {
      translateElementAttributes(current as Element, locale);
    }
    current = walker.nextNode();
  }
}

function preferredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : DEFAULT_LOCALE;
}

export default function LocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, updateLocale] = useState<Locale>(DEFAULT_LOCALE);

  const setLocale = useCallback((nextLocale: Locale) => {
    updateLocale(nextLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The active tab still switches even if persistence is unavailable.
    }
    document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'zh-CN' : 'en');
  }, [locale, setLocale]);

  useLayoutEffect(() => {
    const nextLocale = preferredLocale();
    if (nextLocale !== locale) updateLocale(nextLocale);
    // The first pass below uses nextLocale so Chinese browsers do not wait for
    // a second render before receiving translated copy.
    document.documentElement.lang = nextLocale;
    document.documentElement.dataset.locale = nextLocale;
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    translateSubtree(document.body, locale);
    if (locale === 'en') return;

    const pending = new Set<Node>();
    let frame: number | null = null;
    const flush = () => {
      frame = null;
      const roots = [...pending].filter(
        (node) =>
          ![...pending].some(
            (candidate) =>
              candidate !== node
              && candidate instanceof Element
              && candidate.contains(node),
          ),
      );
      pending.clear();
      for (const root of roots) translateSubtree(root, locale);
    };
    const schedule = (node: Node) => {
      pending.add(node);
      if (frame === null) frame = window.requestAnimationFrame(flush);
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'attributes') {
          schedule(mutation.target);
        } else {
          for (const node of mutation.addedNodes) schedule(node);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATED_ATTRIBUTES],
    });
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      pending.clear();
    };
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used within LocaleProvider');
  return value;
}
