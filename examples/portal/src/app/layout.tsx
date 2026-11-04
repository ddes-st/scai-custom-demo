import './globals.css';
import 'src/styles/base.css';
import 'src/styles/design.css';
import 'src/styles/site.css';
import 'src/styles/portal.css';
import 'src/styles/sports.css';
import 'src/styles/university.css';
import 'src/styles/automotive.css';
import 'src/styles/sxa.css';
import 'src/styles/sitecoreai.css';
import 'src/styles/brand-hub.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://edge-platform.sitecorecloud.io" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
