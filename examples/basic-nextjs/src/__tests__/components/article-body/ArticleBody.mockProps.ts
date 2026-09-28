import { Field, ImageField, LinkField, RichTextField, Page, PageMode, ComponentRendering, RouteData } from '@sitecore-content-sdk/nextjs';
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
          ArticleContent: { value: '<p>This is the article body content with <strong>bold text</strong> and more.</p>' } as RichTextField,
          ArticleKeyTakeaways: { value: '<ul><li>Takeaway one</li><li>Takeaway two</li></ul>' } as RichTextField,
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
              personBio: { value: '<p>Experienced content strategist with 10 years in digital.</p>' },
              personLinkedIn: {
                value: { href: 'https://linkedin.com/in/janesmith', text: 'LinkedIn', linktype: 'external', target: '' },
              },
            },
          } as PersonReference,
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
  RenderingIdentifier: 'article-body-1',
};

const mockRendering: ComponentRendering = {
  componentName: 'ArticleBody',
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

export const propsWithoutTakeaways = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({ ArticleKeyTakeaways: undefined }),
};

export const propsWithoutAuthor = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({ ArticleAuthor: undefined }),
};

export const propsWithoutContent = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({ ArticleContent: undefined }),
};

export const propsMinimal = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({
    ArticleKeyTakeaways: undefined,
    ArticleAuthor: undefined,
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
        personBio: { value: '<p>A writer.</p>' },
        personLinkedIn: undefined,
      },
    },
  }),
};

export const propsAuthorNoBio = {
  params: mockParams,
  rendering: mockRendering,
  page: makePageWith({
    ArticleAuthor: {
      id: 'author-3',
      name: 'Sam Lee',
      fields: {
        personFirstName: { value: 'Sam' },
        personLastName: { value: 'Lee' },
        personJobTitle: undefined,
        personProfileImage: undefined,
        personBio: undefined,
        personLinkedIn: undefined,
      },
    },
  }),
};
