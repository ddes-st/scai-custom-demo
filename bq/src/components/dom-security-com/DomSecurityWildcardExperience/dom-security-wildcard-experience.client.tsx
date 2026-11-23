'use client';

import type { ReactNode } from 'react';
import { useWildcardItem, WildcardItemProvider } from 'src/lib/wildcard';

type Props = {
  sourceRoot: string;
  language: string;
  children: ReactNode;
};

export default function WildcardExperienceClient({
  sourceRoot,
  language,
  children,
}: Props) {
  const state = useWildcardItem({ sourceRoot, language });

  return (
    <WildcardItemProvider state={state}>
      <div data-wildcard-status={state.status}>{children}</div>
    </WildcardItemProvider>
  );
}
