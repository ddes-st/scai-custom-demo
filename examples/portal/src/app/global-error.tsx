'use client';
import Link from 'next/link';

/**
 * The last-resort error boundary (root layout failures). It must stay a plain client
 * component: the starter's version rendered the Sitecore layout here, which would pull the
 * server-only Content Hub components into the browser bundle.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1>500 Internal Server Error</h1>
        <p>There is a problem with the resource you are looking for, and it cannot be displayed.</p>
        <p>
          <button type="button" onClick={() => reset()}>Try again</button> · <Link href="/">Go to the Home page</Link>
        </p>
      </body>
    </html>
  );
}
