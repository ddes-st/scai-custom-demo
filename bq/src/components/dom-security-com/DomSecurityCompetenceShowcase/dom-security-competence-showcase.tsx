"use client";

import { RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { useState } from "react";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
}

interface SlideFields {
  Title?: TextField;
  Text?: RichTextField;
  Image?: ImageField;
}

interface SlideRendering {
  uid?: string;
  fields?: SlideFields;
}

type CompetenceShowcaseProps = ComponentProps & { fields: Fields };

function readSlides(rendering: ComponentProps["rendering"]): SlideRendering[] {
  const placeholders = rendering?.placeholders ?? {};
  const key = Object.keys(placeholders).find((name) => name.startsWith("competence-slides"));
  const entries = key ? placeholders[key] : [];
  return Array.isArray(entries) ? (entries as SlideRendering[]) : [];
}

export const Default = (props: CompetenceShowcaseProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const slides = readSlides(props.rendering);
  const [active, setActive] = useState(0);
  const current = slides[Math.min(active, Math.max(slides.length - 1, 0))];
  const imageSrc = current?.fields?.Image?.value?.src;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative isolate overflow-hidden bg-[#1a1a1a] font-['Source_Sans_Pro',sans-serif] font-light text-white md:min-h-[755px]"
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="relative z-10 mx-auto w-full max-w-[1170px] px-[15px] py-9 md:py-[90px]">
        <Text field={fields.Title} tag="h2" className="dom-accent !text-white" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-0">
          <ul className="m-0 list-none p-0 md:col-span-3">
            {slides.map((slide, index) => {
              const selected = index === active;
              const isLast = index === slides.length - 1;
              return (
                <li key={slide.uid || index}>
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    className={`relative inline-block max-w-full bg-transparent pr-5 text-left text-[27px] leading-[31px] text-white ${
                      selected ? "font-normal" : "font-light"
                    } ${isLast ? "mb-0" : "mb-[45px]"}`}
                  >
                    <Text field={slide.fields?.Title} tag="span" />
                    {selected ? (
                      <span aria-hidden="true" className="absolute top-0 right-0 h-[27px] w-[4px] bg-[#d51130]" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="md:col-span-5 md:col-start-5">
            <Text
              field={current?.fields?.Title}
              tag="h3"
              className="m-0 mb-9 text-[1.278rem] font-light leading-[1.39rem] text-white md:text-[45.9px] md:leading-[50px]"
            />
            <RichText
              field={current?.fields?.Text}
              className="text-[16px] font-light leading-[1.3] text-white md:text-[18px] md:leading-[25.7px] [&_p]:mb-[10px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
