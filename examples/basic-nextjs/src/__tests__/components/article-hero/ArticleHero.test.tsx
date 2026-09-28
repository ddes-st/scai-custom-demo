import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Default as ArticleHero, Minimal as ArticleHeroMinimal, SplitImage as ArticleHeroSplitImage } from '@/components/uiim/article/ArticleHero';
import {
  defaultProps,
  propsEditing,
  propsNoRouteFields,
  propsWithoutImage,
  propsWithoutAuthor,
  propsWithoutDate,
  propsWithoutReadTime,
  propsMinimal,
  propsAuthorNoImage,
} from './ArticleHero.mockProps';
import type { Field } from '@sitecore-content-sdk/nextjs';

// Mock @sitecore-content-sdk/nextjs
jest.mock('@sitecore-content-sdk/nextjs', () => ({
  useSitecore: () => ({
    page: {
      mode: {
        isEditing: false,
        isPreview: false,
        isNormal: true,
      },
    },
  }),
  Text: ({
    field,
    tag,
    className,
    ...rest
  }: {
    field?: Field<string>;
    tag?: string;
    className?: string;
  }) => {
    const Tag = (tag || 'span') as keyof JSX.IntrinsicElements;
    return React.createElement(Tag, { className, 'data-testid': 'text-field', ...rest }, field?.value || '');
  },
  DateField: ({
    field,
    render,
    tag,
  }: {
    field?: Field<string>;
    render?: (value: string) => string;
    tag?: string;
  }) => {
    const Tag = (tag || 'span') as keyof JSX.IntrinsicElements;
    const formatted = render && field?.value ? render(field.value) : field?.value;
    return React.createElement(Tag, { 'data-testid': 'date-field' }, formatted || '');
  },
  NextImage: ({
    field,
    className,
  }: {
    field?: { value?: { src?: string; alt?: string } };
    className?: string;
  }) =>
    // eslint-disable-next-line @next/next/no-img-element
    React.createElement('img', {
      src: field?.value?.src,
      alt: field?.value?.alt,
      className,
      'data-testid': 'sdk-image',
    }),
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

// Mock window.open
const mockWindowOpen = jest.fn();
window.open = mockWindowOpen;

describe('ArticleHero Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render article title', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
    });

    it('should render hero image', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      const images = screen.getAllByTestId('sdk-image');
      expect(images.length).toBeGreaterThan(0);
    });

    it('should render author name', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByTestId('author-name')).toHaveTextContent('Jane Smith');
    });

    it('should render publication date', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByTestId('date-field')).toBeInTheDocument();
    });

    it('should render read time', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByText('5 min read')).toBeInTheDocument();
    });

    it('should render share buttons', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByTestId('share-buttons')).toBeInTheDocument();
      expect(screen.getByTestId('share-facebook')).toBeInTheDocument();
      expect(screen.getByTestId('share-twitter')).toBeInTheDocument();
      expect(screen.getByTestId('share-linkedin')).toBeInTheDocument();
      expect(screen.getByTestId('share-copy')).toBeInTheDocument();
    });

    it('should render header element', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByTestId('article-hero-header')).toBeInTheDocument();
    });
  });

  describe('Optional fields handling', () => {
    it('should render without image', () => {
      render(<ArticleHero {...(propsWithoutImage as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
    });

    it('should render without author', () => {
      render(<ArticleHero {...(propsWithoutAuthor as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.queryByTestId('author-meta')).not.toBeInTheDocument();
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
    });

    it('should render without date', () => {
      render(<ArticleHero {...(propsWithoutDate as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.queryByTestId('date-field')).not.toBeInTheDocument();
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
    });

    it('should render without read time', () => {
      render(<ArticleHero {...(propsWithoutReadTime as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.queryByText('5 min read')).not.toBeInTheDocument();
    });

    it('should render with minimal props (title only)', () => {
      render(<ArticleHero {...(propsMinimal as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
    });

    it('should render author without profile image', () => {
      render(<ArticleHero {...(propsAuthorNoImage as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByTestId('author-name')).toHaveTextContent('John Doe');
    });
  });

  describe('Fallback rendering', () => {
    it('should render fallback when no route fields', () => {
      render(<ArticleHero {...(propsNoRouteFields as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByText('ArticleHero')).toBeInTheDocument();
    });
  });

  describe('Share functionality', () => {
    it('should open Facebook share dialog', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      fireEvent.click(screen.getByTestId('share-facebook'));
      expect(mockWindowOpen).toHaveBeenCalled();
      expect(mockWindowOpen.mock.calls[0][0]).toContain('facebook.com');
    });

    it('should open Twitter share dialog', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      fireEvent.click(screen.getByTestId('share-twitter'));
      expect(mockWindowOpen).toHaveBeenCalled();
      expect(mockWindowOpen.mock.calls[0][0]).toContain('twitter.com');
    });

    it('should open LinkedIn share dialog', () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      fireEvent.click(screen.getByTestId('share-linkedin'));
      expect(mockWindowOpen).toHaveBeenCalled();
      expect(mockWindowOpen.mock.calls[0][0]).toContain('linkedin.com');
    });

    it('should copy link to clipboard', async () => {
      render(<ArticleHero {...(defaultProps as unknown as Parameters<typeof ArticleHero>[0])} />);
      fireEvent.click(screen.getByTestId('share-copy'));
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });
  });

  describe('Editing mode', () => {
    it('should show fields in editing mode even when empty', () => {
      render(<ArticleHero {...(propsEditing as unknown as Parameters<typeof ArticleHero>[0])} />);
      expect(screen.getByTestId('article-hero-header')).toBeInTheDocument();
    });
  });

  describe('Minimal variant', () => {
    it('should render title without background image', () => {
      render(<ArticleHeroMinimal {...(defaultProps as unknown as Parameters<typeof ArticleHeroMinimal>[0])} />);
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
      expect(screen.getByTestId('article-hero-header')).toBeInTheDocument();
    });

    it('should render metadata and share buttons', () => {
      render(<ArticleHeroMinimal {...(defaultProps as unknown as Parameters<typeof ArticleHeroMinimal>[0])} />);
      expect(screen.getByTestId('author-meta')).toBeInTheDocument();
      expect(screen.getByTestId('share-buttons')).toBeInTheDocument();
    });

    it('should render fallback when no route fields', () => {
      render(<ArticleHeroMinimal {...(propsNoRouteFields as unknown as Parameters<typeof ArticleHeroMinimal>[0])} />);
      expect(screen.getByText('ArticleHero')).toBeInTheDocument();
    });

    it('should handle missing optional fields', () => {
      render(<ArticleHeroMinimal {...(propsMinimal as unknown as Parameters<typeof ArticleHeroMinimal>[0])} />);
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
    });
  });

  describe('SplitImage variant', () => {
    it('should render title and image in two columns', () => {
      render(<ArticleHeroSplitImage {...(defaultProps as unknown as Parameters<typeof ArticleHeroSplitImage>[0])} />);
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
      expect(screen.getByTestId('split-image')).toBeInTheDocument();
    });

    it('should render metadata and share buttons', () => {
      render(<ArticleHeroSplitImage {...(defaultProps as unknown as Parameters<typeof ArticleHeroSplitImage>[0])} />);
      expect(screen.getByTestId('author-meta')).toBeInTheDocument();
      expect(screen.getByTestId('share-buttons')).toBeInTheDocument();
    });

    it('should render fallback when no route fields', () => {
      render(<ArticleHeroSplitImage {...(propsNoRouteFields as unknown as Parameters<typeof ArticleHeroSplitImage>[0])} />);
      expect(screen.getByText('ArticleHero')).toBeInTheDocument();
    });

    it('should handle missing optional fields', () => {
      render(<ArticleHeroSplitImage {...(propsMinimal as unknown as Parameters<typeof ArticleHeroSplitImage>[0])} />);
      expect(screen.getByText('The Future of Web Development')).toBeInTheDocument();
    });
  });
});
