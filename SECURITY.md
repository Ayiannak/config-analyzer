# Security Features

The Sentry Config Analyzer implements comprehensive security measures to protect sensitive data during analysis.

## 🔒 Multi-Layer Security Architecture

### 1. Client-Side Protection (First Layer)
**Location:** `src/utils/security.ts`

All sensitive data is detected and masked in the browser **before** being sent to the server:

- **Automatic Detection:** Scans for DSNs, API keys, tokens, passwords, and other secrets
- **Real-time Masking:** Applies masking as soon as files are uploaded or text is pasted
- **User Notification:** Alerts users when sensitive data is detected and masked
- **Zero Trust:** Assumes user input may contain secrets and validates everything

### 2. Server-Side Protection (Second Layer)
**Location:** `server-security.js`

Additional security validation on the server provides defense-in-depth:

- **Redundant Masking:** Re-scans all incoming data for any secrets that might have been missed
- **Logging:** Records when sensitive data is detected (without logging the actual secrets)
- **API Protection:** Ensures nothing sensitive reaches the Claude API

### 3. UI Security Notice
**Location:** Prominent banner in the application

Users are informed about security measures:

- **Transparency:** Clear explanation of how data is handled
- **Real-time Alerts:** Notifications when sensitive data is detected
- **Detailed Reporting:** Shows exactly what types of secrets were masked

## 🛡️ What We Detect and Mask

### Sentry-Specific
- **DSNs:** Full Sentry DSN URLs with public keys
  - Format: `https://[key]@[org].ingest.sentry.io/[project]`
  - Masked to: `https://***MASKED_DSN***@[org].ingest.sentry.io/[project]`

### API Keys & Tokens
- **Anthropic API Keys:** `sk-ant-api03-...`
- **Generic API Keys:** Various formats (apiKey, api_key, api-key)
- **Bearer Tokens:** Authorization headers
- **Auth Tokens:** Access tokens and authentication tokens
- **GitHub Tokens:** Personal access tokens (ghp_, gho_, ghu_)

### Cloud Provider Credentials
- **AWS Access Keys:** `AKIA[0-9A-Z]{16}`
- **AWS Secret Keys:** 40-character secrets
- **Private Keys:** RSA and other private key formats

### Generic Secrets
- **Passwords:** Various password formats
- **Long Secrets:** Any field labeled as secret/password with 12+ characters
- **Smart Detection:** Ignores common placeholders (test, example, demo)

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

## 🔄 Updates & Maintenance

Security patterns are regularly updated to detect:
- New API key formats
- Emerging secret patterns
- Cloud provider updates
- Framework-specific secrets

Last updated: 2025-02-04
