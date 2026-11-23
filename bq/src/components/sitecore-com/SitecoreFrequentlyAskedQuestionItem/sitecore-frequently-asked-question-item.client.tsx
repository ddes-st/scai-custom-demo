'use client';

import React, { ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  itemId: string;
  children?: ReactNode;
}

const closeEvent = 'sitecore-faq-close';

export default function SitecoreFrequentlyAskedQuestionItemChrome({ itemId, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(itemId.endsWith('0'));

  useEffect(() => {
    const handleClose = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== itemId) {
        setIsOpen(false);
      }
    };
    window.addEventListener(closeEvent, handleClose);
    return () => window.removeEventListener(closeEvent, handleClose);
  }, [itemId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const trigger = root.querySelector<HTMLElement>('[data-faq-trigger]');
    const panel = root.querySelector<HTMLElement>('[data-faq-panel]');
    const question = root.querySelector<HTMLElement>('[data-faq-question]');
    const icon = root.querySelector<HTMLElement>('[data-faq-icon]');
    if (!trigger || !panel || !question || !icon) return;
    trigger.setAttribute('aria-expanded', String(isOpen));
    trigger.setAttribute('aria-controls', panel.id);
    panel.hidden = !isOpen;
    question.classList.toggle('text-[#5f25e7]', isOpen);
    question.classList.toggle('text-[#1e1c22]', !isOpen);
    icon.classList.toggle('text-[#5f25e7]', isOpen);
    icon.classList.toggle('text-[#c1bdc7]', !isOpen);
    icon.textContent = isOpen ? '−' : '+';
    root.classList.toggle('ring-1', isOpen);
    root.classList.toggle('ring-[#8629ff]', isOpen);
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-faq-trigger]')) return;
        const nextOpen = !isOpen;
        if (nextOpen) {
          window.dispatchEvent(new CustomEvent(closeEvent, { detail: itemId }));
        }
        setIsOpen(nextOpen);
      }}
    >
      {children}
    </div>
  );
}
