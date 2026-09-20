import messages from './i18n-messages.json' with { type: 'json' };

// Interface strings are authored in English; every other language, including the default zh-CN, is a catalog.
// Graphs without meta.locale keep rendering in Chinese, so existing pages do not change. Authored text and code
// identifiers are never translated.
export const DEFAULT_LOCALE = 'zh-CN';
export const SUPPORTED_LOCALES = ['en', ...Object.keys(messages)];

export function translate(locale, message, values = {}) {
  const effective = locale ?? DEFAULT_LOCALE;
  const catalog = Object.hasOwn(messages, effective) ? messages[effective] : undefined;
  const template = catalog && Object.hasOwn(catalog, message) ? catalog[message] : message;
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
