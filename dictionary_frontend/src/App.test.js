import { render, screen } from '@testing-library/react';
import App from './App';

test('renders panels', () => {
  render(<App />);
  // Panels labels should be present after initial render (even if empty).
  const historyLabel = screen.getByRole("heading", { name: /Recent Searches|हाल की खोजें|ఇటీవలి శోధనలు/i });
  const favoritesLabel = screen.getByRole("heading", { name: /Favorites|पसंदीदा|ఇష్టమైనవి/i });
  expect(historyLabel).toBeInTheDocument();
  expect(favoritesLabel).toBeInTheDocument();
});
