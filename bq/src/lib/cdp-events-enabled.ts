/**
 * Whether browser CDP / Events SDK should run (pageView, identity, custom events).
 *
 * Default: on (needed for SitecoreAI Profiles demos, including local `npm run dev`).
 * Always off in preview/editing. Opt out with:
 *   NEXT_PUBLIC_CDP_EVENTS_ENABLED=false
 */
export function areBrowserCdpEventsEnabled(isPreviewMode = false): boolean {
  if (isPreviewMode) return false;
  if (process.env.NEXT_PUBLIC_CDP_EVENTS_ENABLED === 'false') return false;
  return true;
}
