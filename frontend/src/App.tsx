import { useEffect, useState } from 'react';
import { Header } from './panels/Header';
import { Dashboard } from './pages/Dashboard';
import { Gallery } from './pages/Gallery';

function usePage(): 'dashboard' | 'gallery' {
  const read = (): 'dashboard' | 'gallery' => (window.location.hash.startsWith('#/gallery') ? 'gallery' : 'dashboard');
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onHash = () => setPage(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return page;
}

export default function App() {
  const page = usePage();
  return (
    <div className="flex min-h-screen flex-col bg-terminal-bg">
      <div className="sticky top-0 z-10">
        <Header page={page} />
      </div>
      {page === 'gallery' ? <Gallery /> : <Dashboard />}
    </div>
  );
}
