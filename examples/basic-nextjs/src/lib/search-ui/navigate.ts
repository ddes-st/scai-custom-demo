'use client';

/**
 * Full-page navigation to another route (results page, article page). A thin
 * seam over window.location.assign so components stay testable — jsdom does
 * not allow redefining window.location, a module mock does the job instead.
 */
export const navigateTo = (href: string): void => {
  window.location.assign(href);
};
