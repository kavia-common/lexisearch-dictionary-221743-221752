import { render, screen } from '@testing-library/react';
import App from './App';

test('renders hero title text and panels', () => {
  render(<App />);
  const titleText = screen.getByText(/Find the meaning of any word/i);
  expect(titleText).toBeInTheDocument();

  // Panels labels should be present after initial render (even if empty).
  const historyLabel = screen.getByRole("heading", { name: /Recent Searches/i });
  const favoritesLabel = screen.getByRole("heading", { name: /Favorites/i });
  expect(historyLabel).toBeInTheDocument();
  expect(favoritesLabel).toBeInTheDocument();
});
