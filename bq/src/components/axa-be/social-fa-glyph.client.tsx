'use client';

import { FaIcon } from 'components/icons/fa-icon';

type SocialFaGlyphProps = {
  name: string;
  className?: string;
};

/** Client glyph so Server map-entry components can stay RSC-safe. */
export default function SocialFaGlyph({ name, className }: SocialFaGlyphProps) {
  if (!name) return null;
  // FA 7 styles.css wrongly sets position:absolute on all .svg-inline--fa — force flow layout.
  const classes = [
    '!static !inset-auto !m-0 inline-block h-[1.25em] w-[1.25em]',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <FaIcon name={name} faStyle="brands" className={classes} />;
}
