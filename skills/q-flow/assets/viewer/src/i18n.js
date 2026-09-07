import messages from './i18n-messages.json' with { type: 'json' };

// Existing graphs keep Chinese by default. Authored text and code identifiers are untouched.
export const SUPPORTED_LOCALES = ['zh-CN', ...Object.keys(messages)];

export function translate(locale, message, values = {}) {
  const catalog = Object.hasOwn(messages, locale) ? messages[locale] : undefined;
  const template = catalog && Object.hasOwn(catalog, message) ? catalog[message] : message;
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
