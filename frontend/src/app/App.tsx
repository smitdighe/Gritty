import { RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { createAppRouter } from './router';

const router = createAppRouter();

/** App root: providers wrap the router. No data fetching here. */
export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
