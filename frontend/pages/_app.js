import '../styles/globals.css';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import ChatPanel from '../components/ChatPanel';

const fetcher = (url) => fetch(url).then(r => r.json());

function NavLink({ href, children }) {
  const router = useRouter();
  const isActive = router.pathname === href;
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
      }`}
    >
      {children}
    </Link>
  );
}

export default function App({ Component, pageProps }) {
  const { data } = useSWR(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/weather`, fetcher, { refreshInterval: 600000 });
  const locationName = data?.location?.replace(', CA', '').replace(', ON', '') || 'Loading...';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐻</span>
            <h1 className="text-lg font-bold text-gray-900">Goldilocks</h1>
            <span className="text-xs text-gray-400 mt-1">{locationName}</span>
          </div>
          <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/carbon">Carbon</NavLink>
            <NavLink href="/simulator">Simulator</NavLink>
            <NavLink href="/savings">Savings</NavLink>
            <NavLink href="/settings">Settings</NavLink>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Component {...pageProps} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-4 text-center text-xs text-gray-400">
        Goldilocks {locationName} — QHacks 2026
      </footer>

      {/* Global chat panel */}
      <ChatPanel />
    </div>
  );
}
