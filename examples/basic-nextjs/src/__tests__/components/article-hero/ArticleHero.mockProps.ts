import { Field, ImageField, Page, PageMode, ComponentRendering, RouteData } from '@sitecore-content-sdk/nextjs';
import { PersonReference } from 'src/Layout';

const mockPageBase: Page = {
  mode: {
    isEditing: false,
    isPreview: false,
    isNormal: true,
    name: 'normal' as PageMode['name'],
    designLibrary: { isVariantGeneration: false },
    isDesignLibrary: false,
  },
  layout: {
    sitecore: {
      context: {},
      route: {
        fields: {
          Title: { value: 'The Future of Web Development' } as Field<string>,
          ArticleImage: {
            value: { src: '/test-hero.jpg', alt: 'Hero Image', width: 1200, height: 800 },
          } as ImageField,
          ArticleAuthor: {
            id: 'author-1',
            name: 'Jane Smith',
            fields: {
              personFirstName: { value: 'Jane' },
              personLastName: { value: 'Smith' },
              personJobTitle: { value: 'Senior Content Strategist' },
              personProfileImage: {
                value: { src: '/test-author.jpg', alt: 'Jane Smith', width: 64, height: 64 },
              },
              personBio: { value: '<p>Experienced content strategist.</p>' },
              personLinkedIn: {
                value: { href: 'https://linkedin.com/in/janesmith', text: 'LinkedIn' },
              },
            },
          } as PersonReference,
          ArticlePublicationDate: { value: '2025-06-15' } as Field<string>,
          ArticleReadTime: { value: '5 min read' } as Field<string>,
        } as unknown as RouteData['fields'],
        name: 'test-article',
        displayName: 'Test Article',
        placeholders: {},
      },
    },
  },
  locale: 'en',
};

const mockPageEditing: Page = {
  ...mockPageBase,
  mode: {
    isEditing: true,
    isPreview: false,
    isNormal: false,
    name: 'edit' as PageMode['name'],
    designLibrary: { isVariantGeneration: false },
    isDesignLibrary: false,
  },
};

const mockPageNoRouteFields: Page = {
  ...mockPageBase,
  layout: {
    sitecore: {
      context: {},
      route: null,
    },
  },
};

function makePageWith(overrides: Record<string, unknown>): Page {
  return {
    ...mockPageBase,
    layout: {
      sitecore: {
        context: {},
        route: {
          ...mockPageBase.layout.sitecore.route!,
          fields: {
            ...mockPageBase.layout.sitecore.route!.fields,
            ...overrides,
          } as unknown as RouteData['fields'],
        },
      },
    },
  };
}

const mockParams = {
  styles: 'custom-style',
  RenderingIdentifier: 'article-hero-1',
};

const mockRendering: ComponentRendering = {
  componentName: 'ArticleHero',
} as ComponentRendering;

export const defaultProps = {
  params: mockParams,
  rendering: mockRendering,
  page: mockPageBase,
};

export const propsEditing = {
  params: mockParams,
  rendering: mockRendering,
  page: mockPageEditing,
};

export const propsNoRouteFields = {
  params: mockParams,
  rendering: mockRendering,
  page: mockPageNoRouteFields,
};

export const propsWithoutImage = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({ ArticleImage: undefined }),
};

export const propsWithoutAuthor = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({ ArticleAuthor: undefined }),
};

export const propsWithoutDate = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({ ArticlePublicationDate: undefined }),
};

export const propsWithoutReadTime = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({ ArticleReadTime: undefined }),
};

export const propsMinimal = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({
    ArticleImage: undefined,
    ArticleAuthor: undefined,
    ArticlePublicationDate: undefined,
    ArticleReadTime: undefined,
  }),
};

export const propsAuthorNoImage = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({
    ArticleAuthor: {
      id: 'author-2',
      name: 'John Doe',
      fields: {
        personFirstName: { value: 'John' },
        personLastName: { value: 'Doe' },
        personJobTitle: { value: 'Writer' },
        personProfileImage: undefined,
      },
    },
  }),
};
