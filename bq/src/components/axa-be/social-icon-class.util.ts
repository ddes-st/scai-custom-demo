import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { getFieldValue } from 'lib/component-props';

/** Resolve authored Icon classname from Icon Link List GraphQL, with label fallback. */
export function resolveSocialIconClass(options: {
  iconField?: TextField | { jsonValue?: TextField } | null;
  linkField?: LinkField | null;
}): string {
  const iconField = getFieldValue(options.iconField);
  const authored =
    typeof iconField?.value === 'string' ? iconField.value.trim() : '';
  if (authored) return authored;

  const haystack =
    `${options.linkField?.value?.text ?? ''} ${options.linkField?.value?.href ?? ''}`.toLowerCase();
  if (haystack.includes('facebook')) return 'icon-facebook';
  if (haystack.includes('instagram')) return 'icon-instagram';
  if (haystack.includes('tiktok')) return 'icon-tiktok';
  if (haystack.includes('youtube') || haystack.includes('youtu'))
    return 'icon-youtube';
  return '';
}
