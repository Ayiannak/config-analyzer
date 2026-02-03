import { useState } from 'react'

interface AnalysisResult {
  correctConfig: string[];
  problems: Array<{ title: string; description: string; fix: string }>;
  suggestions: Array<{ title: string; description: string }>;
}

function App() {
  const [configCode, setConfigCode] = useState('')
  const [issueContext, setIssueContext] = useState('')
  const [sdkType, setSdkType] = useState('JavaScript')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const handleAnalyze = async () => {
    if (!configCode.trim()) {
      alert('Please paste the Sentry.init() code')
      return
    }

    setAnalyzing(true)

    // TODO: Call LLM API for analysis
    // For now, mock response
    setTimeout(() => {
      setResult({
        correctConfig: [
          'DSN is properly configured',
          'Environment is set to "production"',
        ],
        problems: [
          {
            title: 'tracesSampleRate is too low (0.01)',
            description: 'Only 1% of transactions are being captured. This explains why performance data is sparse.',
            fix: 'tracesSampleRate: 0.1, // Capture 10% of transactions'
          },
          {
            title: 'Missing Replay integration',
            description: 'Session Replay is not configured. This would help debug user-reported issues.',
            fix: `integrations: [
  new Sentry.Replay({
    maskAllText: false,
    blockAllMedia: false,
  }),
],
replaysSessionSampleRate: 0.1,`
          }
        ],
        suggestions: [
          {
            title: 'Add custom tags for better filtering',
            description: 'Consider adding tags like "tier", "region", or "feature_flags" to help categorize issues.'
          }
        ]
      })
      setAnalyzing(false)
    }, 2000)
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-sentry-gradient bg-clip-text text-transparent">
            Sentry Config Analyzer
          </h1>
          <p className="text-gray-400 text-lg">
            Paste your Sentry.init() code and describe issues to get instant configuration recommendations
          </p>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left Column: Config Input */}
          <div className="card p-6">
            <h2 className="text-2xl font-semibold mb-4 text-sentry-purple-300">
              📝 Configuration Code
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                SDK Type
              </label>
              <select
                value={sdkType}
                onChange={(e) => setSdkType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-sentry-purple-500 focus:border-transparent"
              >
                <option>JavaScript</option>
                <option>Python</option>
                <option>Ruby</option>
                <option>PHP</option>
                <option>Java</option>
                <option>Go</option>
                <option>.NET</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Paste Sentry.init() Code
              </label>
              <textarea
                value={configCode}
                onChange={(e) => setConfigCode(e.target.value)}
                placeholder={`Sentry.init({
  dsn: "...",
  tracesSampleRate: 1.0,
  // ... paste your full config here
});`}
                className="w-full h-96 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-sentry-purple-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Right Column: Issue Context */}
          <div className="card p-6">
            <h2 className="text-2xl font-semibold mb-4 text-sentry-purple-300">
              🐛 Issue Context
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                What issues are they experiencing?
              </label>
              <textarea
                value={issueContext}
                onChange={(e) => setIssueContext(e.target.value)}
                placeholder={`Describe the problems:
- Not seeing errors from checkout flow
- Source maps aren't loading
- Performance data is missing
- Session replays aren't capturing
- etc...`}
                className="w-full h-96 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-sentry-purple-500 focus:border-transparent resize-none"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !configCode.trim()}
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? '🔍 Analyzing...' : '🚀 Analyze Configuration'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Correct Configuration */}
            {result.correctConfig.length > 0 && (
              <div className="card p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-green-400">✅</span>
                  <span>What's Configured Correctly</span>
                </h2>
                <ul className="space-y-2">
                  {result.correctConfig.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-300">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Problems Detected */}
            {result.problems.length > 0 && (
              <div className="card p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-red-400">❌</span>
                  <span>Problems Detected</span>
                </h2>
                <div className="space-y-6">
                  {result.problems.map((problem, i) => (
                    <div key={i} className="border-l-4 border-red-500 pl-4">
                      <h3 className="text-xl font-semibold text-red-300 mb-2">
                        {problem.title}
                      </h3>
                      <p className="text-gray-300 mb-3">
                        {problem.description}
                      </p>
                      <div className="bg-gray-900 p-4 rounded-lg">
                        <div className="text-sm text-gray-400 mb-2">🔧 Recommended Fix:</div>
                        <pre className="text-sm text-green-400 font-mono overflow-x-auto">
                          {problem.fix}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="card p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-blue-400">💡</span>
                  <span>Additional Suggestions</span>
                </h2>
                <div className="space-y-4">
                  {result.suggestions.map((suggestion, i) => (
                    <div key={i} className="border-l-4 border-blue-500 pl-4">
                      <h3 className="text-lg font-semibold text-blue-300 mb-1">
                        {suggestion.title}
                      </h3>
                      <p className="text-gray-300">
                        {suggestion.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
