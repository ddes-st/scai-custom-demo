import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Default, Header } from '@/components/uiim/search/SearchTypeahead';

// --- Mocks (single CI seam: the SDK search module; see spec #45) ---

const mockUseSearch = jest.fn();
jest.mock('@sitecore-content-sdk/nextjs/search', () => ({
  useSearch: (...args: unknown[]) => mockUseSearch(...args),
}));

jest.mock('@sitecore-content-sdk/nextjs', () => ({}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => `dict:${key}`;
    t.has = () => false;
    return t;
  },
}));

jest.mock('@sitecore-content-sdk/events', () => ({
  event: jest.fn(),
}));

const mockAssign = jest.fn();
jest.mock('@/lib/search-ui/navigate', () => ({
  navigateTo: (href: string) => mockAssign(href),
}));

// --- Fixtures ---

const field = (value: string) => ({ value });

const baseFields = {
  SearchIndex: field('5db6d2f0-4157-45fc-9017-fd928f94f87c'),
  TitleMapping: field('Title'),
  LinkMapping: field(''),
  ResultsPage: { value: { href: '/Articles' } },
  MaxSuggestions: field('5'),
};

const livePage = {
  mode: { isEditing: false, isPreview: false },
  siteName: 'main-website',
  layout: { sitecore: { route: { name: 'Articles', itemLanguage: 'en' } } },
};

const editingPage = {
  ...livePage,
  mode: { isEditing: true, isPreview: false },
};

const baseProps = {
  fields: baseFields,
  params: { styles: '', RenderingIdentifier: 'search-typeahead' },
  rendering: { uid: 'test-uid', componentName: 'SearchTypeahead' },
  page: livePage,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const doc = (title: string, overrides: Record<string, unknown> = {}) => ({
  sc_item_id: title.replace(/\s/g, ''),
  Title: title,
  ...overrides,
});

const searchState = (overrides: Record<string, unknown> = {}) => ({
  total: 0,
  totalPages: 0,
  results: [],
  isLoading: false,
  isSuccess: true,
  isError: false,
  error: null,
  ...overrides,
});

const typeAndSettle = (value: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  act(() => jest.advanceTimersByTime(400));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockUseSearch.mockReturnValue(searchState());
});

afterEach(() => {
  jest.useRealTimers();
});

// --- Tests (external behavior only) ---

describe('suggestions', () => {
  it('passes index, max suggestions, and the debounced query to useSearch', () => {
    render(<Default {...baseProps} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'can' } });
    expect(mockUseSearch).not.toHaveBeenCalledWith(expect.objectContaining({ query: 'can' }));

    act(() => jest.advanceTimersByTime(400));

    expect(mockUseSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchIndexId: '5db6d2f0-4157-45fc-9017-fd928f94f87c',
        query: 'can',
        pageSize: 5,
        enabled: true,
      })
    );
  });

  it('shows title suggestions and a see-all option while typing', () => {
    mockUseSearch.mockReturnValue(
      searchState({ total: 1, results: [doc('Canary Releases Explained')] })
    );
    render(<Default {...baseProps} />);
    typeAndSettle('can');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Canary Releases Explained')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all results' })).toHaveAttribute(
      'href',
      '/Articles?q=can'
    );
  });

  it('does not search or open the dropdown with an empty input', () => {
    render(<Default {...baseProps} />);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(mockUseSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });
});

describe('navigation intent', () => {
  it('Enter without a selection navigates to the results page with ?q=', () => {
    mockUseSearch.mockReturnValue(
      searchState({ total: 1, results: [doc('Canary Releases Explained')] })
    );
    render(<Default {...baseProps} />);
    typeAndSettle('canary');

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(mockAssign).toHaveBeenCalledWith('/Articles?q=canary');
  });

  it('arrow keys move the active option and Enter chooses it (no link mapping -> results page with the title)', () => {
    mockUseSearch.mockReturnValue(
      searchState({
        total: 2,
        results: [doc('Canary Releases Explained'), doc('Canary Deep Dive')],
      })
    );
    render(<Default {...baseProps} />);
    typeAndSettle('can');

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Canary Deep Dive', selected: true })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockAssign).toHaveBeenCalledWith('/Articles?q=Canary%20Deep%20Dive');
  });

  it('clicking a suggestion with a link mapping navigates to the document link', () => {
    mockUseSearch.mockReturnValue(
      searchState({
        total: 1,
        results: [doc('Canary Releases Explained', { url: '/articles/canary' })],
      })
    );
    render(
      <Default {...baseProps} fields={{ ...baseFields, LinkMapping: field('url') }} />
    );
    typeAndSettle('can');

    fireEvent.click(screen.getByText('Canary Releases Explained'));
    expect(mockAssign).toHaveBeenCalledWith('/articles/canary');
  });

  it('Escape closes the dropdown', () => {
    mockUseSearch.mockReturnValue(
      searchState({ total: 1, results: [doc('Canary Releases Explained')] })
    );
    render(<Default {...baseProps} />);
    typeAndSettle('can');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('states', () => {
  it('is quiet in editing mode: search disabled, input inert', () => {
    render(<Default {...baseProps} page={editingPage} />);

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(mockUseSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('renders nothing live (and a hint while editing) without a datasource', () => {
    const noFields = { ...baseProps, fields: undefined };
    const { container } = render(<Default {...noFields} />);
    expect(container).toBeEmptyDOMElement();

    render(<Default {...noFields} page={editingPage} />);
    expect(screen.getByText('SearchTypeahead')).toBeInTheDocument();
  });
});

describe('Header variant', () => {
  it('shares the full combobox behavior: suggestions and direct link navigation', () => {
    mockUseSearch.mockReturnValue(
      searchState({
        total: 1,
        results: [doc('Canary Releases Explained', { url: '/articles/canary' })],
      })
    );
    render(
      <Header {...baseProps} fields={{ ...baseFields, LinkMapping: field('url') }} />
    );
    typeAndSettle('can');

    expect(mockUseSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'can', pageSize: 5, enabled: true })
    );
    fireEvent.click(screen.getByText('Canary Releases Explained'));
    expect(mockAssign).toHaveBeenCalledWith('/articles/canary');
  });

  it('renders nothing live without a datasource', () => {
    const { container } = render(<Header {...baseProps} fields={undefined as never} />);
    expect(container).toBeEmptyDOMElement();
  });
});
