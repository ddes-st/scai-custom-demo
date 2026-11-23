import React from 'react';

export default function Link({ href, children, className, ...rest }) {
  return React.createElement('a', { href: href || '#', className, ...rest }, children);
}
