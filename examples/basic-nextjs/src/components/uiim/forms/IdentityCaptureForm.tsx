'use client';

import React, { JSX, useState, FormEvent } from 'react';
import {
  Field,
  RichText as ContentSdkRichText,
  Text,
  useSitecore,
} from '@sitecore-content-sdk/nextjs';
import { identity, type IdentityData } from '@sitecore-content-sdk/events';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

interface IdentityCaptureFormFields {
  FormTitle: Field<string>;
  FormDescription: Field<string>;
  EmailLabel: Field<string>;
  FirstNameLabel: Field<string>;
  LastNameLabel: Field<string>;
  SubmitButtonLabel: Field<string>;
  SuccessMessage: Field<string>;
  ExtensionDataJson: Field<string>;
  IdentityProvider: Field<string>;
}

type IdentityCaptureFormProps = ComponentProps & {
  fields: IdentityCaptureFormFields;
};

const IdentityCaptureFormDefaultComponent = (): JSX.Element => (
  <div className="component identity-capture-form">
    <div className="component-content">
      <span className="is-empty-hint">IdentityCaptureForm</span>
    </div>
  </div>
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildPayload(
  email: string,
  firstName: string,
  lastName: string,
  fields: IdentityCaptureFormFields,
  ctx: { language: string; page?: string }
): IdentityData {
  const provider = fields?.IdentityProvider?.value || 'email';
  const payload: IdentityData = {
    channel: 'WEB',
    currency: 'USD',
    language: ctx.language,
    page: ctx.page,
    identifiers: [{ id: email.toLowerCase(), provider }],
    email: email.toLowerCase(),
    firstName,
    lastName,
  };
  try {
    const ext = JSON.parse(fields?.ExtensionDataJson?.value || '{}');
    if (ext && typeof ext === 'object' && Object.keys(ext).length) {
      payload.extensionData = ext;
    }
  } catch {
    // Invalid JSON in ExtensionDataJson is silently dropped.
  }
  return payload;
}

function useIdentityForm(
  fields: IdentityCaptureFormFields,
  isEditing: boolean,
  ctx: { language: string; page?: string }
) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }

    const payload = buildPayload(email.trim(), firstName.trim(), lastName.trim(), fields, ctx);
    const disabled = isEditing || process.env.NODE_ENV === 'development';

    if (disabled) {
      // eslint-disable-next-line no-console
      console.log('[IdentityCaptureForm] would fire identity event (skipped in editing/dev)', payload);
    } else {
      await identity(payload).catch((err) => {
        // eslint-disable-next-line no-console
        console.debug('[IdentityCaptureForm] identity() error', err);
      });
    }

    setSubmittedName(firstName.trim());
    setSubmitted(true);

    if (!isEditing) {
      window.setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  return {
    email,
    setEmail,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    error,
    submitted,
    submittedName,
    handleSubmit,
  };
}

function renderSuccessMessage(template: string | undefined, firstName: string): string {
  if (!template) return `Thanks ${firstName}, you're now identified.`;
  return template.replace(/\{firstName\}/g, firstName);
}

/* ────────────────────────────────────────────
   Default — neutral centered card layout for the design library
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: IdentityCaptureFormProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const { page: sitecorePage } = useSitecore();
  const isEditing = !!(page?.mode?.isEditing ?? sitecorePage?.mode?.isEditing);
  const route = sitecorePage?.layout?.sitecore?.route;
  const ctx = {
    language: (route?.itemLanguage || 'EN').toUpperCase(),
    page: route?.name,
  };
  const form = useIdentityForm(fields, isEditing, ctx);

  if (!fields) return <IdentityCaptureFormDefaultComponent />;

  return (
    <div className={cn('component identity-capture-form', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-16">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {form.submitted ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">
                {renderSuccessMessage(fields.SuccessMessage?.value, form.submittedName)}
              </p>
            </div>
          ) : (
            <>
              {(fields.FormTitle?.value || isEditing) && (
                <Text
                  field={fields.FormTitle}
                  tag="h2"
                  className="text-2xl font-bold tracking-tight text-gray-900"
                />
              )}
              {(fields.FormDescription?.value || isEditing) && (
                <ContentSdkRichText
                  field={fields.FormDescription}
                  className="mt-2 text-sm text-gray-600"
                />
              )}
              <form onSubmit={form.handleSubmit} className="mt-6 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">
                      <Text field={fields.FirstNameLabel} />
                    </span>
                    <input
                      type="text"
                      autoComplete="given-name"
                      required
                      value={form.firstName}
                      onChange={(e) => form.setFirstName(e.target.value)}
                      className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">
                      <Text field={fields.LastNameLabel} />
                    </span>
                    <input
                      type="text"
                      autoComplete="family-name"
                      required
                      value={form.lastName}
                      onChange={(e) => form.setLastName(e.target.value)}
                      className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700">
                    <Text field={fields.EmailLabel} />
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => form.setEmail(e.target.value)}
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                  />
                </label>
                {form.error && (
                  <p className="text-sm text-red-600" role="alert">
                    {form.error}
                  </p>
                )}
                <button
                  type="submit"
                  className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Text field={fields.SubmitButtonLabel} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   HCA — cream card, navy headings/labels, mint focus ring,
   navy pill submit with white-hover inverse (HCA brand pattern)
   ──────────────────────────────────────────── */
export const HCA = ({ fields, params, page }: IdentityCaptureFormProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const { page: sitecorePage } = useSitecore();
  const isEditing = !!(page?.mode?.isEditing ?? sitecorePage?.mode?.isEditing);
  const route = sitecorePage?.layout?.sitecore?.route;
  const ctx = {
    language: (route?.itemLanguage || 'EN').toUpperCase(),
    page: route?.name,
  };
  const form = useIdentityForm(fields, isEditing, ctx);

  if (!fields) return <IdentityCaptureFormDefaultComponent />;

  const inputClass =
    'h-11 rounded-md border bg-white px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-[#A6E5DE]';
  const inputStyle: React.CSSProperties = {
    borderColor: 'var(--brand-border, #E2E0D7)',
    color: 'var(--brand-primary, #0C2141)',
  };
  const labelStyle: React.CSSProperties = { color: 'var(--brand-primary, #0C2141)' };

  return (
    <div className={cn('component identity-capture-form', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-12 md:py-16">
        <div
          className="mx-auto max-w-md rounded-2xl p-8"
          style={{ backgroundColor: '#F5F1E8' }}
        >
          {form.submitted ? (
            <div className="text-center">
              <p
                className="text-lg font-semibold"
                style={{ color: 'var(--brand-primary, #0C2141)' }}
              >
                {renderSuccessMessage(fields.SuccessMessage?.value, form.submittedName)}
              </p>
            </div>
          ) : (
            <>
              {(fields.FormTitle?.value || isEditing) && (
                <Text
                  field={fields.FormTitle}
                  tag="h2"
                  className="text-2xl font-bold tracking-tight font-[var(--brand-heading-font,inherit)]"
                  style={{ color: 'var(--brand-primary, #0C2141)' }}
                />
              )}
              {(fields.FormDescription?.value || isEditing) && (
                <ContentSdkRichText
                  field={fields.FormDescription}
                  className="mt-2 text-sm opacity-80"
                  style={{ color: 'var(--brand-primary, #0C2141)' }}
                />
              )}
              <form onSubmit={form.handleSubmit} className="mt-6 space-y-4" noValidate>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold" style={labelStyle}>
                      <Text field={fields.FirstNameLabel} />
                    </span>
                    <input
                      type="text"
                      autoComplete="given-name"
                      required
                      value={form.firstName}
                      onChange={(e) => form.setFirstName(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold" style={labelStyle}>
                      <Text field={fields.LastNameLabel} />
                    </span>
                    <input
                      type="text"
                      autoComplete="family-name"
                      required
                      value={form.lastName}
                      onChange={(e) => form.setLastName(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold" style={labelStyle}>
                    <Text field={fields.EmailLabel} />
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => form.setEmail(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </label>
                {form.error && (
                  <p className="text-sm font-medium" role="alert" style={{ color: '#B91C1C' }}>
                    {form.error}
                  </p>
                )}
                <button
                  type="submit"
                  className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-[var(--brand-primary,#0C2141)] bg-[var(--brand-primary,#0C2141)] px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white hover:text-[var(--brand-primary,#0C2141)]"
                >
                  <Text field={fields.SubmitButtonLabel} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
