import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <title>Not found · Vidshelf</title>
      <h1 className="text-2xl font-semibold text-zinc-900">Page not found</h1>
      <Link to="/" className="mt-4 inline-block font-medium text-indigo-600 hover:underline">
        Back to all videos
      </Link>
    </div>
  );
}
