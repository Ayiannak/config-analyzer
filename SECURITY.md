# 🔒 Security & Privacy

The Sentry Copilot is designed with security-first principles to protect sensitive credentials and secrets when analyzing customer configurations.

## 🔒 Multi-Layer Security Architecture

### 1. Client-Side Protection (First Layer)
**Location:** `src/utils/security.ts` and `src/App.tsx:228-240`

All sensitive data is detected and masked in the browser **before** being sent to the server:

- **Automatic Detection:** Scans for DSNs, API keys, tokens, passwords, and other secrets
- **Real-time Masking:** Applies masking as soon as text is pasted or typed
- **User Notification:** Alerts users when sensitive data is detected and masked
- **Zero Trust:** Assumes user input may contain secrets and validates everything
- **Memory Safety:** Real secrets never stored in application state

**How It Works:**

When a customer pastes configuration code, `handleConfigCodeChange()` immediately calls `maskSensitiveData()`:

```typescript
const handleConfigCodeChange = (value: string) => {
  const maskingResult = maskSensitiveData(value)

  if (maskingResult.wasMasked) {
    setMaskedSecrets(maskingResult.detectedSecrets)
    setShowSecurityNotice(true)
    setConfigCode(maskingResult.maskedContent)  // Only masked version stored
  } else {
    setConfigCode(value)
  }
}
```

The real secret is **immediately discarded** and only the masked version is kept in memory.

### 2. Server-Side Protection (Second Layer)
**Location:** `server.js:216-217, :423-424`

Additional security validation on the server provides defense-in-depth:

- **Redundant Masking:** Re-scans all incoming data for any secrets that might have been missed
- **API Protection:** Ensures nothing sensitive reaches the Claude API
- **Defense Against Tampering:** Protects even if frontend is bypassed

**Implementation:**

Before sending to Claude API:

```javascript
const maskedConfig = maskSensitiveData(configCode).maskedContent
```

This second pass catches any secrets that might have bypassed client-side masking (e.g., direct API calls, browser tampering).

### 3. UI Security Notice
**Location:** Prominent banner in the application

Users are informed about security measures:

- **Transparency:** Clear explanation of how data is handled
- **Real-time Alerts:** Notifications when sensitive data is detected
- **Detailed Reporting:** Shows exactly what types of secrets were masked

## 🛡️ What We Detect and Mask

All patterns are defined in `src/utils/security.ts:1-112` with smart detection that avoids false positives.

### Sentry-Specific
- **DSNs:** Full Sentry DSN URLs with public keys
  - **Pattern:** `https://[32-char-hex]@[org].ingest.sentry.io/[project]`
  - **Before:** `https://abc123def456789012345678901234567890@o123.ingest.sentry.io/456789`
  - **After:** `https://abc***MASKED_DSN***@o123.ingest.sentry.io/456789`
  - **Why:** Preserves URL structure for analysis while hiding the secret key

### API Keys & Tokens
- **Anthropic API Keys**
  - Pattern: `sk-ant-api03-...`
  - Masked to: `sk-ant-***MASKED_API_KEY***`

- **Generic API Keys**
  - Patterns: `apiKey`, `api_key`, `api-key` with 20+ character values
  - Masked to: `***MASKED_API_KEY***`

- **Bearer Tokens**
  - Pattern: `Authorization: Bearer [token]`
  - Masked to: `Authorization: Bearer ***MASKED_TOKEN***`

- **GitHub Tokens**
  - Patterns: `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`
  - Masked to: `ghp_***MASKED_GITHUB_TOKEN***`

### Cloud Provider Credentials
- **AWS Access Keys**
  - Pattern: `AKIA[0-9A-Z]{16}`
  - Masked to: `AKIA***MASKED_AWS_KEY***`

- **AWS Secret Keys**
  - Pattern: 40-character alphanumeric strings
  - Masked to: `***MASKED_AWS_SECRET***`

- **Private Keys**
  - Pattern: `-----BEGIN RSA PRIVATE KEY-----` (and other formats)
  - Masked to: `***MASKED_PRIVATE_KEY***`

### Generic Secrets
- **Passwords**
  - Pattern: Any field with "password" label + 8+ characters
  - Masked to: `***MASKED_PASSWORD***`

- **JWT Tokens**
  - Pattern: `eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+`
  - Masked to: `***MASKED_JWT***`

- **Long Secrets**
  - Pattern: Any field labeled secret/token with 12+ characters
  - Masked to: `***MASKED_SECRET***`

### Smart Detection Features

✅ **Ignores Placeholders:**
- `your_api_key_here`
- `your-dsn-here`
- `<YOUR_KEY>`
- `[YOUR_TOKEN]`
- Common dummy values (test, example, demo)

✅ **Context-Aware:**
- Only masks if field name suggests it's sensitive
- Requires minimum length to avoid false positives
- Preserves structure (e.g., keeps org/project IDs in masked DSN)

✅ **Language-Agnostic:**
- Works with JavaScript, Python, Ruby, Go, etc.
- Handles various quote styles (single, double, backticks)
- Recognizes different assignment patterns (=, :, =>)

## 🔐 What Data is Sent to Claude API

### Data Sent ✅
- Masked configuration code (all secrets replaced with `***MASKED_***`)
- Issue description (user-provided context about what's not working)
- SDK type selection (JavaScript, Python, Ruby, etc.)
- Chat messages (if using the chat feature)

### Never Sent ❌
- Real Sentry DSN keys
- Real API keys or tokens
- Passwords or credentials
- Private keys
- Any unmasked secrets

### Example Request to Claude

```json
{
  "configCode": "Sentry.init({\n  dsn: \"https://abc***MASKED_DSN***@o123.ingest.sentry.io/456789\",\n  tracesSampleRate: 0.01\n})",
  "issueContext": "Not seeing performance data in Sentry",
  "sdkType": "JavaScript"
}
```

Note: The masked DSN still allows Claude to identify configuration issues (like "DSN is present, good!") without exposing the actual secret.

---

## 🚨 API Key Security Warning

### Current Setup (Development Only)

⚠️ **Warning:** This demo uses `dangerouslyAllowBrowser: true` for the Anthropic SDK, which exposes your API key in the browser.

```bash
# .env
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

This is **ONLY** acceptable for:
- ✅ Local development
- ✅ Internal demos
- ✅ Testing environments
- ❌ **NOT for production**

### Production Deployment Requirements

For production, you **MUST**:

1. **Remove Frontend API Calls**
   - Delete all `import '@anthropic-ai/sdk'` from `src/App.tsx`
   - Remove `dangerouslyAllowBrowser: true`
   - Remove all direct Claude API calls from frontend

2. **Backend-Only API Calls**
   - Keep Claude API calls in `server.js` only
   - API key stored server-side as `ANTHROPIC_API_KEY` (not `VITE_*`)
   - Frontend only calls your backend endpoints

3. **Add Rate Limiting**
   ```javascript
   import rateLimit from 'express-rate-limit'

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   })

   app.use('/api/', limiter)
   ```

4. **Add Authentication**
   - Require users to log in before analyzing
   - Track usage per user
   - Implement quotas if needed

5. **Environment Variables**
   ```bash
   # Production .env (server-side only)
   ANTHROPIC_API_KEY=sk-ant-api03-...
   NODE_ENV=production
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

6. **CORS Configuration**
   ```javascript
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS,
     credentials: true
   }))
   ```

---

## 📊 Security Guarantees

### ✅ What We Do
1. **Automatic Masking:** All sensitive data is masked before transmission
2. **No Storage:** Configuration data is never stored on servers
3. **Direct API:** Analysis goes directly to Claude API (enterprise security)
4. **Client-Side First:** Masking happens in the browser before network transmission
5. **Defense in Depth:** Multiple layers of protection
6. **Transparent:** Users are informed what was detected and masked

### ❌ What We Don't Do
1. **No Logging:** Sensitive data is never logged or stored
2. **No Tracking:** No analytics on configuration content
3. **No Persistence:** No databases or file storage of configs
4. **No Third Parties:** Data only goes to Claude API (no other services)

## 📈 Complete Masking Flow

Here's exactly what happens when a customer pastes config with a real DSN:

```
1. Customer Pastes Config
   Sentry.init({ dsn: "https://abc123...@o123.ingest.sentry.io/456" })
          ↓
2. Frontend Instant Detection (handleConfigCodeChange)
   Pattern match: /https?:\/\/[a-f0-9]{32}@.../gi
          ↓
3. Automatic Masking
   Sentry.init({ dsn: "https://abc***MASKED_DSN***@o123.ingest.sentry.io/456" })
          ↓
4. Security Notice Appears
   🔒 "Sensitive data detected and automatically masked"
   • Sentry DSN
          ↓
5. Masked Content Stored in State
   Real DSN is gone from memory forever
          ↓
6. Customer Clicks "Analyze Configuration"
          ↓
7. Frontend Sends Masked Config to Backend
   POST /api/analyze { configCode: "...***MASKED_DSN***..." }
          ↓
8. Backend Re-Masks (Defense-in-Depth)
   const maskedConfig = maskSensitiveData(configCode).maskedContent
          ↓
9. Backend Sends to Claude API
   Only masked version reaches Claude
          ↓
10. Claude Analyzes Masked Config
    Can still identify: "DSN is present ✓" without seeing real key
          ↓
11. Results Returned to Customer
    Full analysis with recommendations
```

**Key Security Points:**
- ❌ Real DSN **never** leaves the browser
- ❌ Real DSN **never** stored anywhere
- ❌ Real DSN **never** reaches Claude API
- ✅ Customer gets immediate visual confirmation (security notice)
- ✅ Analysis still works perfectly with masked values

---

## 🔍 How to Verify

### Test the Masking
1. Paste a config with a real DSN
2. Watch the security alert appear
3. Check that the DSN is masked in the textarea

### View Network Requests
1. Open browser DevTools (F12)
2. Go to Network tab
3. Submit an analysis
4. Inspect the request payload
5. Verify all sensitive data is masked

## 🚨 What to Do If You Find a Security Issue

If you discover sensitive data that isn't being masked:

1. **Don't panic:** The data hasn't been stored anywhere
2. **Report it:** Create an issue or contact the maintainer
3. **Provide patterns:** Share the format (not the actual secret) so we can add detection
4. **We'll fix it:** We'll add detection for that pattern immediately

## 📝 Security Pattern Updates

To add new secret patterns, update both:
- `src/utils/security.ts` (client-side)
- `server-security.js` (server-side)

Pattern format:
```javascript
{
  name: 'Type of Secret',
  pattern: /regex-pattern/gi,
  mask: (match) => 'MASKED_VALUE'
}
```

## 🔐 Best Practices for Users

1. **Review Before Submitting:** Check your config before analysis
2. **Use Placeholders:** Replace real secrets with placeholders when possible
3. **Trust the System:** Our masking is thorough, but verify if concerned
4. **Report Issues:** If you see unmasked sensitive data, let us know

## 🏢 Enterprise Security

This tool is designed for:
- **Internal Use:** Safe for analyzing customer configurations
- **Support Teams:** Secure enough for customer support workflows
- **Compliance:** No data retention = minimal compliance concerns
- **Audit Trail:** Server-side logging of masked detection (not the secrets themselves)

## 🚀 Production Deployment Checklist

Before deploying to production, verify:

### API Security
- [ ] Moved `ANTHROPIC_API_KEY` to server-side environment variable
- [ ] Removed `VITE_ANTHROPIC_API_KEY` from .env
- [ ] Removed `dangerouslyAllowBrowser: true` from frontend
- [ ] Deleted all Anthropic SDK imports from frontend code
- [ ] All Claude API calls go through backend only

### Rate Limiting & Auth
- [ ] Implemented rate limiting on all API endpoints
- [ ] Added user authentication
- [ ] Set up usage quotas per user
- [ ] Configured CORS for production domain only

### Security Testing
- [ ] Tested masking with real credentials (then revoked them)
- [ ] Verified network requests contain only masked data
- [ ] Tested direct API calls to backend (bypassing frontend)
- [ ] Reviewed all console.log statements (no secrets logged)

### Monitoring
- [ ] Sentry integration active (already done ✓)
- [ ] Error tracking configured (already done ✓)
- [ ] Set up alerts for high error rates
- [ ] Monitor API usage in Anthropic dashboard
- [ ] Track masking events in Sentry

### Documentation
- [ ] Update README with production deployment instructions
- [ ] Document environment variables required
- [ ] Create runbook for security incidents
- [ ] Set up security contact email

---

## 📊 Sentry Integration Security

### What Sentry Tracks

The analyzer uses Sentry to monitor itself (not customer data):

**Tracked:**
- ✅ Performance metrics (time to analysis, latency)
- ✅ Error rates and exceptions
- ✅ User interactions (analysis count, chat usage)
- ✅ Operation names (config.analysis, config.chat, etc.)

**Not Tracked:**
- ❌ Customer configuration code
- ❌ Customer DSNs or secrets
- ❌ Analysis results
- ❌ Any customer PII

**Sentry Configuration:**
```typescript
// Frontend: src/main.tsx
Sentry.init({
  dsn: "https://...",  // This is YOUR analyzer's monitoring DSN
  tracesSampleRate: 1.0,
})

// Backend: server.js
Sentry.init({
  dsn: "https://...",  // Same DSN for correlation
  tracesSampleRate: 1.0,
})
```

Only metadata (SDK types, models, timing) is sent to Sentry, never the actual configuration content.

---

## 🔄 Updates & Maintenance

Security patterns are regularly updated to detect:
- New API key formats
- Emerging secret patterns
- Cloud provider updates
- Framework-specific secrets

**Security Pattern Updates:** Update both `src/utils/security.ts` and server-side masking

**Last Updated:** February 2026

---

## 📞 Security Contact

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **Email:** security@yourdomain.com (or create private security advisory)
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Example secret pattern (not real secret)
   - Potential impact
   - Suggested fix (optional)

**Response Time:** We aim to respond within 48 hours and will work with you to address the issue before public disclosure.

---

## 📚 Additional Resources

- [Anthropic API Security Best Practices](https://docs.anthropic.com/en/api/security)
- [Sentry Security & PII Documentation](https://docs.sentry.io/security-legal-pii/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Masking Utility Source Code](./src/utils/security.ts)
