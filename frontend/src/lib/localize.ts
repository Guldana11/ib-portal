import i18n from '@/i18n';

/**
 * Returns localized field value. Falls back to Russian if Kazakh is not available.
 * Usage: localized(doc, 'title') → doc.titleKk || doc.title (when language is kk)
 */
export function localized(obj: any, field: string): string {
  if (!obj) return '';
  if (i18n.language === 'kk') {
    const kkField = `${field}Kk`;
    return obj[kkField] || obj[field] || '';
  }
  return obj[field] || '';
}
