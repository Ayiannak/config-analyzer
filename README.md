# 🔍 Sentry Config Analyzer

An AI-powered tool to analyze Sentry SDK configurations and identify problems. Perfect for customer support and sales engineering calls.

## Features

- 📝 Paste customer's `Sentry.init()` code
- 🐛 Describe issues they're experiencing
- 🤖 Get instant AI analysis powered by Claude
- ✅ See what's configured correctly
- ❌ Identify problems with fix suggestions
- 💡 Get optimization recommendations

## Setup

1. **Clone and install:**
```bash
npm install
```

2. **Set up API key:**
```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:
```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from: https://console.anthropic.com/settings/keys

3. **Run dev server:**
```bash
npm run dev
```

4. **Open:** http://localhost:5174/

## Usage

1. Select the SDK type (JavaScript, Python, Ruby, etc.)
2. Paste the customer's `Sentry.init()` configuration code
3. Describe what issues they're facing
4. Click "Analyze Configuration"
5. Get instant recommendations with code fixes

## Example

**Input:**
```javascript
Sentry.init({
  dsn: "https://...",
  tracesSampleRate: 0.01,
  environment: "production"
});
```

**Issues:** "Not seeing performance data"

**Output:**
- ❌ Problem: `tracesSampleRate` is too low (0.01)
  - Only 1% of transactions captured
  - Fix: Increase to `0.1` for better visibility

## Deployment

Deploy to Vercel:
```bash
vercel
```

Make sure to add `VITE_ANTHROPIC_API_KEY` to your Vercel environment variables.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Claude API (Anthropic)

## Security Note

⚠️ This demo uses `dangerouslyAllowBrowser: true` for the Anthropic SDK. For production, you should:
1. Create a backend API endpoint
2. Make API calls server-side
3. Never expose API keys in the browser

## License

MIT
