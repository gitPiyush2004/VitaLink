/**
 * React entrypoint. Kept to the minimum: mount the app, nothing else.
 * The provider stack lives in `App.tsx` so tests can render it directly.
 */

import { createRoot } from 'react-dom/client';

import { App } from './App';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root is missing from index.html');
}

createRoot(container).render(<App />);
