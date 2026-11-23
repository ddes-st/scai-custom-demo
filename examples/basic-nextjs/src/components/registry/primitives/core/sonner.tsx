"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { useDirection } from "components/hooks/registry/use-direction";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const direction = useDirection();
  const isRtl = direction === "rtl";
  const position = isRtl ? "top-left" : "top-right";
  const offset = isRtl ? { top: 24, left: 24 } : { top: 24, right: 24 };

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={position}
      offset={offset}
      expand={true}
      toastOptions={{
        classNames: {
          toast:
            "!border-none !relative !w-full !items-start !justify-start !pe-12 !pt-4 !pb-4",
          icon: "!self-start !mt-0.5",
          success: "!bg-success-background",
          error: "!bg-destructive-background",
          info: "!bg-info-background",
          warning: "!bg-warning-background",
          default: "!bg-info-background",
          actionButton:
            "!bg-primary !text-inverse-text !hover:bg-primary-600 !active:bg-primary-700 !rounded-4xl",
          title: "text-sm !text-foreground !font-normal",
          description: "text-sm !text-foreground",
          closeButton:
            "!absolute !top-4 !end-1 !start-auto !rounded-md !border-none !bg-transparent !p-1.5 !hover:bg-muted",
        },
      }}
      {...props}
      icons={{
        success: (
          <div className="text-success">
            <ThemeIcon name="check" className="size-5" />
          </div>
        ),
        error: (
          <div className="text-destructive">
            <ThemeIcon name="alert" className="size-5" />
          </div>
        ),
        info: (
          <div className="text-info">
            <ThemeIcon name="info" className="size-5" />
          </div>
        ),
        warning: (
          <div className="text-warning">
            <ThemeIcon name="warning" className="size-5" />
          </div>
        ),
        close: (
          <div className="text-neutral">
            <ThemeIcon name="x" className="size-4" />
          </div>
        ),
      }}
    />
  );
};

export { Toaster };
