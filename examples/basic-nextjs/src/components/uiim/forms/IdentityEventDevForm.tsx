'use client';

import React, { JSX, useState } from 'react';
import { useSitecore } from '@sitecore-content-sdk/nextjs';
import { identity, type IdentityData } from '@sitecore-content-sdk/events';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

type IdentityEventDevFormProps = ComponentProps;

const DEFAULT_JSON_TEMPLATE = `{
  "channel": "WEB",
  "currency": "USD",
  "language": "EN",
  "page": "Home",
  "identifiers": [
    { "id": "demo.user@example.com", "provider": "email" }
  ],
  "email": "demo.user@example.com",
  "firstName": "Demo",
  "lastName": "User",
  "extensionData": {
    "persona": "cardiology-patient",
    "stage": "pre-appointment",
    "appointment": {
      "specialty": "cardiology",
      "date": "2026-07-10",
      "time": "09:00",
      "hospital": "London Bridge Hospital",
      "consultant": "Dr Konstantinos Savvatis"
    },
    "interests": ["cardiology", "heart-health"]
  }
}`;

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success'; response: unknown }
  | { kind: 'error'; message: string };

function useDevForm(isEditing: boolean, routeLanguage: string, routeName?: string) {
  const [json, setJson] = useState<string>(DEFAULT_JSON_TEMPLATE);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const send = async () => {
    setStatus({ kind: 'sending' });
    let parsed: IdentityData;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }

    // Auto-fill required CDP attributes if the dev forgot them.
    if (!parsed.channel) parsed.channel = 'WEB';
    if (!parsed.currency) parsed.currency = 'USD';
    if (!parsed.language) parsed.language = routeLanguage;
    if (!parsed.page) parsed.page = routeName;

    if (isEditing) {
      // eslint-disable-next-line no-console
      console.log('[IdentityEventDevForm] would fire identity event (skipped in editing mode)', parsed);
      setStatus({ kind: 'success', response: { skipped: 'editing-mode', payload: parsed } });
      return;
    }

    try {
      const response = await identity(parsed);
      setStatus({ kind: 'success', response });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const reset = () => {
    setJson(DEFAULT_JSON_TEMPLATE);
    setStatus({ kind: 'idle' });
  };

  return { json, setJson, status, send, reset };
}

const ResultPanel = ({ status }: { status: Status }) => {
  if (status.kind === 'idle') return null;
  if (status.kind === 'sending') {
    return <p className="mt-3 text-sm text-gray-600">Sending…</p>;
  }
  if (status.kind === 'error') {
    return (
      <pre className="mt-3 overflow-x-auto rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
        {status.message}
      </pre>
    );
  }
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-green-300 bg-green-50 p-3 text-xs text-green-800">
      {JSON.stringify(status.response, null, 2)}
    </pre>
  );
};

/* ────────────────────────────────────────────
   Default — neutral dev panel
   ──────────────────────────────────────────── */
export const Default = ({ params }: IdentityEventDevFormProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const { page } = useSitecore();
  const isEditing = !!page?.mode?.isEditing;
  const route = page?.layout?.sitecore?.route;
  const form = useDevForm(
    isEditing,
    (route?.itemLanguage || 'EN').toUpperCase(),
    route?.name
  );

  return (
    <div className={cn('component identity-event-dev-form', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Dev: Send raw identity event</h2>
            {isEditing && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                editing mode — fire is skipped
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Paste the full payload for the SDK <code className="rounded bg-gray-100 px-1">identity()</code> call. Missing
            <code className="mx-1 rounded bg-gray-100 px-1">channel</code>/
            <code className="rounded bg-gray-100 px-1">currency</code>/
            <code className="mx-1 rounded bg-gray-100 px-1">language</code>/
            <code className="rounded bg-gray-100 px-1">page</code> are auto-filled.
          </p>
          <textarea
            value={form.json}
            onChange={(e) => form.setJson(e.target.value)}
            spellCheck={false}
            rows={20}
            className="mt-4 w-full rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs text-gray-900 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={form.send}
              disabled={form.status.kind === 'sending'}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Send identity event
            </button>
            <button
              type="button"
              onClick={form.reset}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Reset template
            </button>
          </div>
          <ResultPanel status={form.status} />
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   HCA — cream panel, navy chrome (matches the rest of the demo)
   ──────────────────────────────────────────── */
export const HCA = ({ params }: IdentityEventDevFormProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const { page } = useSitecore();
  const isEditing = !!page?.mode?.isEditing;
  const route = page?.layout?.sitecore?.route;
  const form = useDevForm(
    isEditing,
    (route?.itemLanguage || 'EN').toUpperCase(),
    route?.name
  );

  const navy = 'var(--brand-primary, #0C2141)';

  return (
    <div className={cn('component identity-event-dev-form', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-12 md:py-16">
        <div
          className="mx-auto max-w-3xl rounded-2xl p-8"
          style={{ backgroundColor: '#F5F1E8' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: navy }}>
              Dev: Send raw identity event
            </h2>
            {isEditing && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: '#A6E5DE', color: navy }}
              >
                editing mode — fire is skipped
              </span>
            )}
          </div>
          <p className="mt-2 text-sm opacity-80" style={{ color: navy }}>
            Paste the full payload for the SDK <code className="rounded bg-white/60 px-1">identity()</code> call. Missing
            <code className="mx-1 rounded bg-white/60 px-1">channel</code>/
            <code className="rounded bg-white/60 px-1">currency</code>/
            <code className="mx-1 rounded bg-white/60 px-1">language</code>/
            <code className="rounded bg-white/60 px-1">page</code> are auto-filled.
          </p>
          <textarea
            value={form.json}
            onChange={(e) => form.setJson(e.target.value)}
            spellCheck={false}
            rows={20}
            className="mt-4 w-full rounded-md border bg-white p-3 font-mono text-xs outline-none transition-shadow focus:ring-2 focus:ring-[#A6E5DE]"
            style={{ borderColor: 'var(--brand-border, #E2E0D7)', color: navy }}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={form.send}
              disabled={form.status.kind === 'sending'}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white hover:text-[var(--brand-primary,#0C2141)] disabled:opacity-50"
              style={{ backgroundColor: navy, border: `1px solid ${navy}` }}
            >
              Send identity event
            </button>
            <button
              type="button"
              onClick={form.reset}
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-[var(--brand-primary,#0C2141)] hover:text-white"
              style={{ color: navy, border: `1px solid ${navy}` }}
            >
              Reset template
            </button>
          </div>
          <ResultPanel status={form.status} />
        </div>
      </section>
    </div>
  );
};
