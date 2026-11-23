'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DEMO_PROFILE } from '../_demo/demo-account';
import { pushServiceRequest } from '../_demo/demo-cdp';
import {
  DEFAULT_PRODUCT_ID,
  DEFAULT_REQUEST_ID,
  DEMO_PRODUCTS,
  getProductById,
  getRequestsForProduct,
  PREFERRED_TIME_OPTIONS,
} from '../_demo/demo-service-catalog';
import { useDemoSession } from '../_demo/demo-session';

type ServiceRequestFormChromeProps = {
  endpoint: string;
};

export default function ServiceRequestFormChrome({
  endpoint,
}: ServiceRequestFormChromeProps) {
  const { isLoggedIn, profile } = useDemoSession();
  const [productId, setProductId] = useState(DEFAULT_PRODUCT_ID);
  const [requestId, setRequestId] = useState(DEFAULT_REQUEST_ID);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredTime, setPreferredTime] = useState<string>(
    PREFERRED_TIME_OPTIONS[0].id,
  );
  const [message, setMessage] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const requests = useMemo(() => getRequestsForProduct(productId), [productId]);
  const product = getProductById(productId);

  useEffect(() => {
    if (!requests.some((r) => r.id === requestId)) {
      setRequestId(requests[0]?.id || '');
    }
  }, [requests, requestId]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const p = profile || DEMO_PROFILE;
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setEmail(p.email);
    setPhone(p.phone);
  }, [isLoggedIn, profile]);

  const groupedProducts = useMemo(() => {
    const map = new Map<string, typeof DEMO_PRODUCTS>();
    for (const item of DEMO_PRODUCTS) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const requestLabel =
      requests.find((r) => r.id === requestId)?.label || requestId;
    const preferredTimeLabel =
      PREFERRED_TIME_OPTIONS.find((option) => option.id === preferredTime)
        ?.label || preferredTime;
    const payload = {
      productId,
      productName: product?.name || productId,
      requestType: requestLabel,
      firstName,
      lastName,
      email,
      phone,
      preferredTime,
      preferredTimeLabel,
      message,
      newsletter,
    };

    setSubmitError('');
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setSubmitError('We could not send your request. Please try again.');
        return;
      }
      pushServiceRequest({
        productId,
        productName: payload.productName,
        requestType: requestLabel,
        email,
        preferredTime,
        newsletter,
      });
      setSubmitted(true);
    } catch {
      setSubmitError('We could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="border border-[#e9e9e9] bg-white p-6 text-center lg:p-10">
        <h3 className="m-0 text-[1.5rem] font-light text-black">
          Thank you — we received your request
        </h3>
        <p className="mt-3 mb-0 text-[0.95rem] text-[#646363]">
          Our team will follow up about{' '}
          <strong className="font-semibold text-black">
            {product?.name}
          </strong>{' '}
          (
          {requests.find((r) => r.id === requestId)?.label || requestId}
          ).
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-10 items-center bg-[#00a0de] px-5 text-[0.9rem] text-white hover:bg-[#0086bb]"
          onClick={() => setSubmitted(false)}
        >
          Submit another request
        </button>
      </div>
    );
  }

  const contactLocked = isLoggedIn;

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-[#e9e9e9] bg-white p-5 text-[#333] lg:p-10"
    >
      {isLoggedIn ? (
        <p className="mb-5 rounded-[3px] bg-[#f3f9fc] px-3 py-2 text-[0.85rem] text-[#00a0de]">
          Signed in as {profile?.email || DEMO_PROFILE.email} — contact details
          are prefilled from your account.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <label className="block text-[0.8rem] font-semibold text-black lg:col-span-2">
          Product you own
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1 block h-11 w-full border border-[#cac9c9] bg-white px-3 text-[0.95rem] font-normal outline-none focus:border-[#00a0de]"
            required
          >
            {groupedProducts.map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block text-[0.8rem] font-semibold text-black lg:col-span-2">
          What do you need?
          <select
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            className="mt-1 block h-11 w-full border border-[#cac9c9] bg-white px-3 text-[0.95rem] font-normal outline-none focus:border-[#00a0de]"
            required
          >
            {requests.map((req) => (
              <option key={req.id} value={req.id}>
                {req.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[0.8rem] font-semibold text-black">
          First name
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            readOnly={contactLocked}
            required
            className="mt-1 block h-11 w-full border border-[#cac9c9] px-3 text-[0.95rem] font-normal outline-none focus:border-[#00a0de] read-only:bg-[#f7f7f7]"
          />
        </label>

        <label className="block text-[0.8rem] font-semibold text-black">
          Last name
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            readOnly={contactLocked}
            required
            className="mt-1 block h-11 w-full border border-[#cac9c9] px-3 text-[0.95rem] font-normal outline-none focus:border-[#00a0de] read-only:bg-[#f7f7f7]"
          />
        </label>

        <label className="block text-[0.8rem] font-semibold text-black">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={contactLocked}
            required
            className="mt-1 block h-11 w-full border border-[#cac9c9] px-3 text-[0.95rem] font-normal outline-none focus:border-[#00a0de] read-only:bg-[#f7f7f7]"
          />
        </label>

        <label className="block text-[0.8rem] font-semibold text-black">
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            readOnly={contactLocked}
            required
            className="mt-1 block h-11 w-full border border-[#cac9c9] px-3 text-[0.95rem] font-normal outline-none focus:border-[#00a0de] read-only:bg-[#f7f7f7]"
          />
        </label>

        <label className="block text-[0.8rem] font-semibold text-black lg:col-span-2">
          Preferred contact time
          <select
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="mt-1 block h-11 w-full border border-[#cac9c9] bg-white px-3 text-[0.95rem] font-normal outline-none focus:border-[#00a0de]"
          >
            {PREFERRED_TIME_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[0.8rem] font-semibold text-black lg:col-span-2">
          Your question or request
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-1 block w-full border border-[#cac9c9] px-3 py-2 text-[0.95rem] font-normal outline-none focus:border-[#00a0de]"
            placeholder="Optional details (key number, door location, serial, …)"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-[0.85rem] font-normal text-[#333] lg:col-span-2">
          <input
            type="checkbox"
            checked={newsletter}
            onChange={(e) => setNewsletter(e.target.checked)}
            className="h-4 w-4 accent-[#d51130]"
          />
          Subscribe to the DOM Hoberg newsletter
        </label>
      </div>

      {submitError ? (
        <p className="mt-5 mb-0 text-[0.9rem] text-[#d51130]" role="alert">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex h-11 items-center justify-center bg-[#d51130] px-6 text-[0.95rem] font-normal text-white hover:bg-[#a50d25] disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Submit request'}
        <span aria-hidden="true" className="ml-3 text-[1.2rem] leading-none">
          →
        </span>
      </button>
    </form>
  );
}
