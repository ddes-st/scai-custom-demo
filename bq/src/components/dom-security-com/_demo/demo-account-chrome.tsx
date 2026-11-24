'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { cn } from 'components/lib/utils';
import { DEMO_PROFILE, displayName } from './demo-account';
import {
  clearLoginIdentityGuard,
  ensureLoginIdentityFromSession,
  pushLoginOpen,
  pushLoginToProfile,
  pushLogoutToProfile,
} from './demo-cdp';
import { useDemoSession } from './demo-session';

type DemoAccountChromeProps = {
  /** When true, use compact styles suitable for the mobile open drawer. */
  mobile?: boolean;
  className?: string;
};

export default function DemoAccountChrome({
  mobile = false,
  className,
}: DemoAccountChromeProps) {
  const { isLoggedIn, audience, profile, login, logout } = useDemoSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const loginTitleId = useId();
  const profileTitleId = useId();

  useEffect(() => {
    if (!menuOpen && !loginOpen && !profileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setLoginOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, loginOpen, profileOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  // Re-identify when a persisted demo session is restored (deduped across mounts).
  useEffect(() => {
    if (!isLoggedIn) return;
    ensureLoginIdentityFromSession(profile || DEMO_PROFILE);
  }, [isLoggedIn, profile]);

  const handleLoginSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const ok = login(email, password);
    if (!ok) {
      setError('Invalid email or password. Use the demo account credentials.');
      return;
    }
    setLoginOpen(false);
    setEmail('');
    setPassword('');
    void pushLoginToProfile(DEMO_PROFILE).then((saved) => {
      if (saved) window.location.reload();
    });
  };

  const handleLogout = () => {
    const loggedOutProfile = profile || DEMO_PROFILE;
    clearLoginIdentityGuard();
    logout();
    setMenuOpen(false);
    setProfileOpen(false);
    void pushLogoutToProfile(loggedOutProfile).then((saved) => {
      if (saved) window.location.reload();
    });
  };

  const accountLabel = isLoggedIn
    ? profile?.firstName || displayName(DEMO_PROFILE)
    : 'Log in';

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-2',
        mobile ? 'flex-wrap' : 'shrink-0',
        className,
      )}
    >
      {/* Account control */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 border border-transparent px-2 text-[0.8rem] font-normal leading-none',
            mobile
              ? 'h-8 bg-black/50 text-white'
              : 'h-[1.85rem] bg-black text-white',
          )}
          aria-expanded={isLoggedIn ? menuOpen : loginOpen}
          aria-haspopup={isLoggedIn ? 'menu' : 'dialog'}
          onClick={() => {
            if (isLoggedIn) {
              setMenuOpen((v) => !v);
            } else {
              pushLoginOpen();
              setLoginOpen(true);
              setError('');
            }
          }}
        >
          <span aria-hidden="true">{isLoggedIn ? '👤' : '🔑'}</span>
          <span>{accountLabel}</span>
          {isLoggedIn ? (
            <span aria-hidden="true" className="text-[0.5rem]">
              ▾
            </span>
          ) : null}
        </button>

        {isLoggedIn && menuOpen ? (
          <ul
            role="menu"
            className="absolute right-0 top-full z-[70] m-0 mt-1 min-w-[10rem] list-none border border-[#e5e5e5] bg-white p-0 text-black shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          >
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-[0.85rem] hover:bg-[#f5f5f5]"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
              >
                My profile
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-[0.85rem] text-[#d51130] hover:bg-[#f5f5f5]"
                onClick={handleLogout}
              >
                Log out
              </button>
            </li>
          </ul>
        ) : null}
      </div>

      {/* Login modal */}
      {loginOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLoginOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={loginTitleId}
            className="w-full max-w-md border border-[#e9e9e9] bg-white p-6 font-[Source_Sans_Pro] text-[#333] shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id={loginTitleId}
                className="m-0 text-[1.35rem] font-light text-black"
              >
                Log in to your DOM account
              </h2>
              <button
                type="button"
                className="text-2xl leading-none text-[#646363]"
                aria-label="Close"
                onClick={() => setLoginOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-[0.85rem] text-[#646363]">
              Demo account — use your Sitecore demo credentials.
            </p>
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
              <label className="block text-[0.8rem] font-semibold text-black">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block h-10 w-full border border-[#cac9c9] px-3 text-[0.95rem] outline-none focus:border-[#00a0de]"
                />
              </label>
              <label className="block text-[0.8rem] font-semibold text-black">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 block h-10 w-full border border-[#cac9c9] px-3 text-[0.95rem] outline-none focus:border-[#00a0de]"
                />
              </label>
              {error ? (
                <p className="m-0 text-[0.85rem] text-[#d51130]" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="mt-2 inline-flex h-11 items-center justify-center bg-[#d51130] px-5 text-[0.95rem] font-normal text-white hover:bg-[#a50d25]"
              >
                Log in
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Profile modal */}
      {profileOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProfileOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={profileTitleId}
            className="w-full max-w-md border border-[#e9e9e9] bg-white p-6 font-[Source_Sans_Pro] text-[#333] shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id={profileTitleId}
                className="m-0 text-[1.35rem] font-light text-black"
              >
                My profile
              </h2>
              <button
                type="button"
                className="text-2xl leading-none text-[#646363]"
                aria-label="Close"
                onClick={() => setProfileOpen(false)}
              >
                ×
              </button>
            </div>
            <dl className="m-0 grid grid-cols-1 gap-3 text-[0.9rem]">
              {(
                [
                  ['Name', displayName(DEMO_PROFILE)],
                  ['Email', DEMO_PROFILE.email],
                  ['Phone', DEMO_PROFILE.phone],
                  ['Mobile', DEMO_PROFILE.mobile],
                  ['Company', DEMO_PROFILE.company],
                  ['Customer #', DEMO_PROFILE.customerNumber],
                  [
                    'Address',
                    `${DEMO_PROFILE.street}, ${DEMO_PROFILE.postalCode} ${DEMO_PROFILE.city}`,
                  ],
                  [
                    'Audience',
                    audience === 'professional' ? 'Professional' : 'Customer',
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="border-b border-[#f3f3f3] pb-2">
                  <dt className="text-[0.75rem] font-semibold uppercase tracking-wide text-[#7e7c7c]">
                    {label}
                  </dt>
                  <dd className="m-0 mt-0.5 text-black">{value}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              className="mt-5 inline-flex h-10 items-center justify-center border border-[#cac9c9] px-4 text-[0.9rem] text-[#d51130] hover:bg-[#f5f5f5]"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
