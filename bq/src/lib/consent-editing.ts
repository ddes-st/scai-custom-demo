/**
 * Consent / cookie overlays should not block page editing in Pages.
 * Show on the live site, and when editing a Partial Design (cookie partial).
 */
export function shouldShowConsentOverlay(
  page:
    | {
        mode?: { isEditing?: boolean };
        layout?: { sitecore?: { route?: { templateName?: string } | null } | null } | null;
      }
    | null
    | undefined,
): boolean {
  if (!page?.mode?.isEditing) return true;
  return page.layout?.sitecore?.route?.templateName === 'Partial Design';
}
