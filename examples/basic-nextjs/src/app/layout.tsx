import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "components/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
import { Button } from "components/components/ui/button"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="preconnect" href="https://edge-platform.sitecorecloud.io" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}

        <div>
          <Button variant="default">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </body>
    </html>
  );
}