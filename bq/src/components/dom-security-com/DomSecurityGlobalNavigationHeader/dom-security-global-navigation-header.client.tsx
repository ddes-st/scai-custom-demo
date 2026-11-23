'use client';

import { useEffect, type ReactNode } from "react";

export default function HeaderChrome({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.querySelector("[data-header-navigation]")?.closest("header");
    if (!root) return;

    const products = root.querySelector("[data-header-products]");
    const navigation = root.querySelector("[data-header-navigation]");
    const mobileNavigation = root.querySelector("[data-header-mobile-navigation]");
    const menuButton = root.querySelector<HTMLButtonElement>("[data-header-menu]");
    const productLink = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-header-navigation] a")).find((link) => link.textContent?.trim() === "Products");
    const searchButtons = root.querySelectorAll<HTMLButtonElement>("[data-header-search]");

    const toggleProducts = (event: Event) => {
      event.preventDefault();
      products?.classList.toggle("hidden");
    };
    productLink?.addEventListener("click", toggleProducts);

    const toggleMobile = () => {
      mobileNavigation?.classList.toggle("hidden");
      menuButton?.setAttribute("aria-expanded", String(!mobileNavigation?.classList.contains("hidden")));
    };
    menuButton?.addEventListener("click", toggleMobile);

    const searchHandler = () => {
      document.querySelector("[data-header-search-panel]")?.classList.toggle("hidden");
    };
    searchButtons.forEach((button) => button.addEventListener("click", searchHandler));

    const resize = () => {
      if (window.innerWidth >= 1024) {
        navigation?.classList.remove("hidden");
        mobileNavigation?.classList.add("hidden");
      }
    };
    window.addEventListener("resize", resize);

    return () => {
      productLink?.removeEventListener("click", toggleProducts);
      menuButton?.removeEventListener("click", toggleMobile);
      searchButtons.forEach((button) => button.removeEventListener("click", searchHandler));
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <>{children}</>;
}
