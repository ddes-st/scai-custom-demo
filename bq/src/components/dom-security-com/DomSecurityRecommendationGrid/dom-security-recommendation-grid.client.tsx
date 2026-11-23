'use client';

import type { ReactNode } from 'react';

type RecommendationGridChromeProps = {
  children: ReactNode;
};

export default function RecommendationGridChrome({ children }: RecommendationGridChromeProps) {
  return <div className="dom-rec-list">{children}</div>;
};
