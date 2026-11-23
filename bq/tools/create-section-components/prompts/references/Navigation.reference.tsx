/**
 * FROZEN REFERENCE — do not edit; add a new file if a new pattern is required.
 * Prompt text only — imports are the target pattern for generated src/components code; this file is not compiled.
 * Unstyled structure only. Codegen must take visual styling from capture evidence.
 * Type: Navigation
 *
 * Sitecore navigation content resolver returns fields as Record<string, NavItemFields>
 * (child items), not flat spaced BQ datasource fields.
 */

'use client';

import React, { JSX, useEffect, useRef, useState } from 'react';
import {
  Link,
  Text,
  TextField,
  LinkField,
  useSitecore,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

export interface NavItemFields {
  Id: string;
  DisplayName: string;
  Title: TextField;
  NavigationTitle: TextField;
  Href: string;
  Querystring: string;
  Children?: Array<NavItemFields>;
  Styles: string[];
}

export type NavigationFields = Record<string, NavItemFields>;

type NavigationProps = ComponentWithContextProps & {
  fields: NavigationFields;
};

function isParamEnabled(value: string | undefined): boolean {
  return value === '1';
}

function extractMediaUrl(param: string | undefined): string | undefined {
  const mediaUrlPattern = /mediaurl="([^"]*)"/i;
  if (param && mediaUrlPattern.test(param)) {
    return param.match(mediaUrlPattern)?.[1] || '';
  }
  return undefined;
}

function useClickAway(
  ref: React.RefObject<HTMLElement | null>,
  onClickAway: () => void,
): void {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        onClickAway();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [ref, onClickAway]);
}

export function isNavLevel(fields: NavItemFields, level: number): boolean {
  return Array.isArray(fields.Styles) && fields.Styles.includes(`level${level}`);
}

export function isNavRootItem(fields: NavItemFields): boolean {
  const isFlatLevel =
    Array.isArray(fields.Styles) &&
    fields.Styles.some((style) => style.startsWith('flat-level'));
  return isNavLevel(fields, 0) && !isFlatLevel;
}

export function getLinkContent(
  fields: NavItemFields,
  logoSrc?: string,
): JSX.Element | string {
  if (isNavRootItem(fields) && logoSrc) {
    const altText =
      fields.NavigationTitle?.value ||
      fields.Title?.value ||
      fields.DisplayName ||
      '';
    return <img src={logoSrc} alt={String(altText)} />;
  }
  const textField = fields.NavigationTitle || fields.Title;
  if (textField) {
    return <Text field={textField} />;
  }
  return fields.DisplayName;
}

export function getLinkField(fields: NavItemFields): LinkField {
  return {
    value: {
      href: fields.Href,
      title:
        fields.NavigationTitle?.value?.toString() ??
        fields.Title?.value?.toString() ??
        fields.DisplayName,
      querystring: fields.Querystring,
    },
  };
}

export function prepareFields(
  fields: NavigationFields,
  center: boolean = true,
): NavigationFields {
  const result: NavigationFields = {};
  const entries = Object.entries(fields).filter(Boolean);

  if (entries.length === 1 && isNavRootItem(entries[0][1])) {
    const rootItem = entries[0][1];
    const children = rootItem.Children || [];
    const flattenedChildren = [...children];
    if (center) {
      const middleIndex = Math.floor(children.length / 2);
      flattenedChildren.splice(middleIndex, 0, {
        ...rootItem,
        Children: undefined,
      });
    } else {
      flattenedChildren.unshift({ ...rootItem, Children: undefined });
    }
    flattenedChildren.forEach((item, idx) => {
      result[String(idx)] = item;
    });
  } else {
    entries.forEach(([key, item]) => {
      result[key] = item;
    });
  }

  return result;
}

interface NavigationListItemProps {
  fields: NavItemFields;
  handleClick: (event?: React.MouseEvent<HTMLElement>) => void;
  logoSrc?: string;
}

const NavigationListItem = ({
  fields,
  handleClick,
  logoSrc,
}: NavigationListItemProps): JSX.Element => {
  const { page } = useSitecore();
  const [isActive, setIsActive] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);
  useClickAway(dropdownRef, () => setIsActive(false));

  const isTopLevelPage = isNavLevel(fields, 1);
  const hasChildren = !!fields.Children?.length;
  const hasDropdownMenu = hasChildren && isTopLevelPage;

  const clickHandler = (event: React.MouseEvent<HTMLElement>) => {
    handleClick(event);
    setIsActive(false);
  };

  return (
    <li ref={dropdownRef} tabIndex={0} role="menuitem">
      <div>
        <Link
          field={getLinkField(fields)}
          editable={page.mode.isEditing}
          onClick={clickHandler}
        >
          {getLinkContent(fields, logoSrc)}
        </Link>
        {hasDropdownMenu ? (
          <button
            type="button"
            aria-label="Toggle submenu"
            aria-haspopup="true"
            aria-expanded={isActive}
            onClick={() => setIsActive((a) => !a)}
          >
            {isActive ? '−' : '+'}
          </button>
        ) : null}
      </div>
      {hasChildren ? (
        <ul role="menu" hidden={hasDropdownMenu && !isActive}>
          {fields.Children!.map((child) => (
            <NavigationListItem
              key={child.Id}
              fields={child}
              handleClick={clickHandler}
              logoSrc={logoSrc}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

export const Default = (props: NavigationProps): JSX.Element => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { page } = useSitecore();
  const id = params.RenderingIdentifier;
  const logoSrc = extractMediaUrl(params.Logo);
  const isSimpleLayout = isParamEnabled(params.SimpleLayout);

  if (!Object.values(fields || {}).some((v) => !!v)) {
    return (
      <div id={id}>
        <div>[Navigation]</div>
      </div>
    );
  }

  const handleToggleMenu = (
    event?: React.MouseEvent<HTMLElement>,
    forceState?: boolean,
  ) => {
    if (event && page.mode.isEditing) {
      event.preventDefault();
    }
    setIsMenuOpen(forceState ?? !isMenuOpen);
  };

  const preparedFields = prepareFields(fields, !isSimpleLayout);
  const rootItem = Object.values(preparedFields).find((item) =>
    isNavRootItem(item),
  );
  const hasLogoRootItem = !!(rootItem && logoSrc);

  return (
    <div id={id}>
      <div>
        {hasLogoRootItem ? (
          <Link
            field={getLinkField(rootItem!)}
            editable={page.mode.isEditing}
          >
            {getLinkContent(rootItem!, logoSrc)}
          </Link>
        ) : null}
        <button
          type="button"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={() => handleToggleMenu()}
        >
          Menu
        </button>
      </div>
      <nav hidden={!isMenuOpen}>
        <ul role="menubar">
          {Object.values(preparedFields)
            .filter((item): item is NavItemFields => !!item)
            .map((item) => (
              <NavigationListItem
                key={item.Id}
                fields={item}
                handleClick={(event) => handleToggleMenu(event, false)}
                logoSrc={logoSrc}
              />
            ))}
        </ul>
      </nav>
    </div>
  );
};
