'use client';

import { cn } from 'components/lib/utils';
import type { DemoAudience } from './demo-account';
import { pushAudienceToProfile } from './demo-cdp';
import { useDemoSession } from './demo-session';

type DemoAudienceToggleProps = {
  className?: string;
  /** Compact height for dense header chips. */
  compact?: boolean;
};

const OPTIONS = [
  { id: 'customer' as const, label: 'Customer' },
  { id: 'professional' as const, label: 'Professional' },
];

export default function DemoAudienceToggle({
  className,
  compact = true,
}: DemoAudienceToggleProps) {
  const { audience, isLoggedIn, setAudience } = useDemoSession();
  const selectedIndex = audience === 'professional' ? 1 : 0;

  const handleAudience = (next: DemoAudience) => {
    if (next === audience) return;
    setAudience(next);
    pushAudienceToProfile(next, { isLoggedIn });
  };

  return (
    <div
      role="group"
      aria-label="Audience: customer or professional"
      className={cn(
        'pointer-events-auto relative inline-grid grid-cols-2 rounded-full bg-[#e8e8e8] p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]',
        compact ? 'h-[1.95rem]' : 'h-9',
        className,
      )}
    >
      {/* Sliding thumb — makes the selected side obvious */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-[3px] top-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-[#d51130] shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-out',
          selectedIndex === 1 && 'translate-x-full',
        )}
      />
      {OPTIONS.map((option) => {
        const active = audience === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => handleAudience(option.id)}
            className={cn(
              'relative z-[1] min-w-[5.6rem] px-2.5 text-[0.68rem] font-semibold uppercase tracking-wide transition-colors duration-200',
              active ? 'text-white' : 'text-[#646363] hover:text-[#111]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
