"use client";

import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import * as React from "react";
import { Button } from "components/registry/primitives/core/button";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { useDirection } from "components/hooks/registry/use-direction";
import { cn } from "components/lib/registry/cn";

type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselProps = {
  opts?: UseCarouselParameters[0];
  plugins?: UseCarouselParameters[1];
  orientation?: "horizontal" | "vertical";
  setApi?: (api: UseEmblaCarouselType[1]) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & CarouselProps) {
  const direction = useDirection();
  const isRtl = direction === "rtl";
  const resolvedOpts = React.useMemo(
    () => ({
      ...opts,
      axis: (orientation === "horizontal" ? "x" : "y") as "x" | "y",
      direction:
        orientation === "horizontal"
          ? (opts?.direction ?? direction)
          : undefined,
    }),
    [opts, orientation, direction],
  );
  const [carouselRef, api] = useEmblaCarousel(resolvedOpts, plugins);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api: UseEmblaCarouselType[1]) => {
    if (!api) return;
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (orientation !== "horizontal") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (isRtl) {
          scrollNext();
        } else {
          scrollPrev();
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (isRtl) {
          scrollPrev();
        } else {
          scrollNext();
        }
      }
    },
    [orientation, isRtl, scrollPrev, scrollNext],
  );

  React.useEffect(() => {
    if (!api || !setApi) return;
    setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) return;
    onSelect(api);
    api.on("reInit", onSelect);
    api.on("select", onSelect);

    return () => {
      api?.off("reInit", onSelect);
      api?.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation:
          orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <section
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        aria-roledescription="carousel"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : "Carousel")}
        data-slot="carousel"
        {...props}
      >
        {children}
      </section>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef, orientation } = useCarousel();
  const overflowClassName =
    orientation === "horizontal"
      ? "overflow-y-visible overflow-x-clip"
      : "overflow-y-clip overflow-x-visible";

  return (
    <div
      ref={carouselRef}
      className={overflowClassName}
      data-slot="carousel-content"
    >
      <div
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col" : "",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: ARIA carousel-slide pattern; <fieldset> would imply form-field grouping and no semantic HTML element represents a slide.
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn("min-w-0 shrink-0 grow-0 basis-full", className)}
      {...props}
    />
  );
}

const carouselButtonClasses =
  "flex h-(--carousel-button-size,2rem) w-(--carousel-button-size,2rem) items-center justify-center rounded-(--carousel-button-radius,9999px) border-(--carousel-button-border-color,transparent) bg-(--carousel-button-bg,var(--color-background)) text-(--carousel-button-color,var(--color-foreground)) shadow-(--carousel-button-shadow,var(--shadow-md)) transition-colors [border-width:var(--carousel-button-border-width,0)] hover:bg-(--carousel-button-bg,var(--color-background)) hover:shadow-(--carousel-button-shadow-hover,var(--shadow-lg)) active:bg-(--carousel-button-bg,var(--color-background))";
const carouselButtonIconClasses =
  "h-(--carousel-button-icon-size,1rem) w-(--carousel-button-icon-size,1rem)";

function CarouselPrevious({
  className,
  variant = "ghost",
  colorScheme = "neutral",
  size = "icon",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();
  const direction = useDirection();
  const isRtl = direction === "rtl";
  const iconName = isRtl ? "arrow-right" : "arrow-left";

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      colorScheme={colorScheme}
      size={size}
      className={cn(
        "absolute",
        carouselButtonClasses,
        orientation === "horizontal"
          ? "-start-12 top-1/2 -translate-y-1/2 rtl:start-auto rtl:-end-12"
          : "start-1/2 -top-12 -translate-x-1/2 rotate-90",
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ThemeIcon name={iconName} className={carouselButtonIconClasses} />
      <span className="sr-only">Previous slide</span>
    </Button>
  );
}

function CarouselNext({
  className,
  variant = "ghost",
  colorScheme = "neutral",
  size = "icon",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollNext, canScrollNext } = useCarousel();
  const direction = useDirection();
  const isRtl = direction === "rtl";
  const iconName = isRtl ? "arrow-left" : "arrow-right";

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      colorScheme={colorScheme}
      size={size}
      className={cn(
        "absolute",
        carouselButtonClasses,
        orientation === "horizontal"
          ? "-end-12 top-1/2 -translate-y-1/2 rtl:-start-12 rtl:end-auto"
          : "start-1/2 -bottom-12 -translate-x-1/2 rotate-90",
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ThemeIcon name={iconName} className={carouselButtonIconClasses} />
      <span className="sr-only">Next slide</span>
    </Button>
  );
}

export type CarouselApi = UseEmblaCarouselType[1];

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
};
