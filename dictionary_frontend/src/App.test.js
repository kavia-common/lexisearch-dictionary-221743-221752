import { render, screen } from '@testing-library/react';
import App from './App';

test('renders hero title text', () => {
  render(<App />);
  const titleText = screen.getByText(/Find the meaning of any word/i);
  expect(titleText).toBeInTheDocument();
});
