'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-slate-600 break-all">{error.message}</p>
          <button onClick={reset} className="px-4 py-2 rounded-md bg-slate-900 text-white">Try again</button>
        </div>
      </body>
    </html>
  )
}
