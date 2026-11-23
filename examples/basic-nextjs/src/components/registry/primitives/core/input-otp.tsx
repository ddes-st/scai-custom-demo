"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";
import { LibraryIcon } from "components/registry/primitives/core/library-icon";
import { useDirection } from "components/hooks/registry/use-direction";
import { cn } from "components/lib/registry/cn";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  const direction = useDirection();
  return (
    <div dir={direction} className="contents">
      <OTPInput
        data-slot="input-otp"
        dir={direction}
        containerClassName={cn(
          "flex items-center gap-2 has-disabled:opacity-50",
          containerClassName,
        )}
        className={cn("disabled:cursor-not-allowed", className)}
        {...props}
      />
    </div>
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const direction = useDirection();
  const isRtl = direction === "rtl";
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};
  const roundingClasses = isRtl
    ? "first:rounded-e-md first:rounded-s-0 last:rounded-s-md last:rounded-e-0"
    : "first:rounded-s-md first:rounded-e-0 last:rounded-e-md last:rounded-s-0";

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      dir={direction}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-(--input-border,var(--color-border)) border-y border-e text-sm shadow-xs outline-none transition-all [border-width:var(--input-border-width,1px)] first:border-s",
        roundingClasses,
        "aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" aria-hidden="true" {...props}>
      <LibraryIcon name="minus" />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
