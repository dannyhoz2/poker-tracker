import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-6">Could not find the requested page.</p>
        <Link
          href="/login"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}
