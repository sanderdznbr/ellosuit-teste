// Re-export the context-based useAuth from AuthProvider to ensure
// a single shared auth state across the app. Previously this file
// defined its own useAuth that re-initialized on every component
// mount, causing flicker/redirects when navigating between pages.
export { useAuth } from '@/components/AuthProvider';
