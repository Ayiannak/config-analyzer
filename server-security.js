// Server-side security utility for masking sensitive data

const SENSITIVE_PATTERNS = [
  {
    name: 'Sentry DSN',
    pattern: /https?:\/\/[a-f0-9]{32}@[a-z0-9-]+\.ingest\.sentry\.io\/\d+/gi,
    mask: (match) => {
      const urlParts = match.split('@');
      return `${urlParts[0].slice(0, 10)}***MASKED_DSN***@${urlParts[1]}`;
    }
  },
  {
    name: 'API Key (Anthropic)',
    pattern: /sk-ant-api03-[a-zA-Z0-9_-]{95}/g,
    mask: () => 'sk-ant-***MASKED_API_KEY***'
  },
  {
    name: 'API Key (Generic)',
    pattern: /['"]?(?:api[_-]?key|apikey|api[_-]?secret)['"]?\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]?/gi,
    mask: (match) => match.replace(/(['"]?)([a-zA-Z0-9_\-]{20,})(['"]?)/, '$1***MASKED_API_KEY***$3')
  },
  {
    name: 'Bearer Token',
    pattern: /bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
    mask: () => 'Bearer ***MASKED_TOKEN***'
  },
  {
    name: 'Auth Token',
    pattern: /['"]?(?:auth[_-]?token|access[_-]?token|token)['"]?\s*[:=]\s*['"]([a-zA-Z0-9_\-\.]{20,})['"]?/gi,
    mask: (match) => match.replace(/(['"]?)([a-zA-Z0-9_\-\.]{20,})(['"]?)/, '$1***MASKED_TOKEN***$3')
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    mask: () => 'AKIA***MASKED_AWS_KEY***'
  },
  {
    name: 'AWS Secret Key',
    pattern: /['"]?(?:aws[_-]?secret|secret[_-]?access[_-]?key)['"]?\s*[:=]\s*['"]([a-zA-Z0-9/+=]{40})['"]?/gi,
    mask: (match) => match.replace(/(['"]?)([a-zA-Z0-9/+=]{40})(['"]?)/, '$1***MASKED_AWS_SECRET***$3')
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
    mask: () => '-----BEGIN PRIVATE KEY-----\n***MASKED_PRIVATE_KEY***\n-----END PRIVATE KEY-----'
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[a-zA-Z0-9]{36,}/g,
    mask: () => 'ghp_***MASKED_GITHUB_TOKEN***'
  },
  {
    name: 'Generic Long Secret',
    pattern: /['"]?(?:secret|password|passwd|pwd)['"]?\s*[:=]\s*['"]([a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{12,})['"]?/gi,
    mask: (match) => {
      // Don't mask common placeholder values
      if (/your[_-]|my[_-]|example|test|demo|xxx|placeholder/i.test(match)) {
        return match;
      }
      return match.replace(/(['"]?)([a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{12,})(['"]?)/, '$1***MASKED_SECRET***$3');
    }
  }
];

/**
 * Detects and masks sensitive information in text (server-side)
 */
export function maskSensitiveData(content) {
  let maskedContent = content;
  const detectedSecrets = new Map();
  let wasMasked = false;

  for (const { name, pattern, mask } of SENSITIVE_PATTERNS) {
    // Reset the regex lastIndex to avoid issues with global flag
    pattern.lastIndex = 0;
    const matches = content.match(pattern);

    if (matches && matches.length > 0) {
      wasMasked = true;
      detectedSecrets.set(name, matches.length);

      maskedContent = maskedContent.replace(pattern, (match) => {
        return mask(match);
      });
    }
  }

  return {
    maskedContent,
    detectedSecrets: Array.from(detectedSecrets.entries()).map(([type, count]) => ({
      type,
      count
    })),
    wasMasked
  };
}
