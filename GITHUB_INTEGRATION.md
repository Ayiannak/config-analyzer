# 🔗 GitHub Integration Guide

## Overview

The Sentry Copilot integrates with Sentry's open-source GitHub repositories to provide deeper context about known issues, feature requests, and community discussions. This helps distinguish between configuration errors and SDK limitations.

---

## How It Works

### Automatic Detection

The analyzer automatically searches GitHub when it detects scenarios like:

1. **Missing/Unsupported Features**
   - User tries to configure something that doesn't exist yet
   - Example: Custom breadcrumb types in Java SDK

2. **Known Bugs or Limitations**
   - Configuration seems correct but behavior is unexpected
   - Example: Source maps not working with specific build tools

3. **Version-Specific Issues**
   - Feature behavior changed in recent SDK versions
   - Example: Breaking changes in v8 → v9 migration

4. **Workarounds Needed**
   - Official solution is pending but community has workarounds
   - Example: Ad-blocker bypass before tunnel option was added

---

## Supported Repositories

The analyzer searches the appropriate SDK repository based on your configuration:

### Core SDKs

| Language/Framework | GitHub Repository |
|-------------------|-------------------|
| JavaScript (Browser, Node, React, Vue, Angular) | [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript) |
| Python (Django, Flask, FastAPI) | [getsentry/sentry-python](https://github.com/getsentry/sentry-python) |
| Ruby (Rails) | [getsentry/sentry-ruby](https://github.com/getsentry/sentry-ruby) |
| Java (Kotlin, Android) | [getsentry/sentry-java](https://github.com/getsentry/sentry-java) |
| PHP (Laravel, Symfony) | [getsentry/sentry-php](https://github.com/getsentry/sentry-php) |
| Go | [getsentry/sentry-go](https://github.com/getsentry/sentry-go) |
| .NET (C#, F#) | [getsentry/sentry-dotnet](https://github.com/getsentry/sentry-dotnet) |

### Mobile SDKs

| Platform | GitHub Repository |
|----------|-------------------|
| React Native | [getsentry/sentry-react-native](https://github.com/getsentry/sentry-react-native) |
| iOS/Swift | [getsentry/sentry-cocoa](https://github.com/getsentry/sentry-cocoa) |
| Dart/Flutter | [getsentry/sentry-dart](https://github.com/getsentry/sentry-dart) |

---

## What Information Is Provided

When the analyzer finds relevant GitHub issues, it includes:

### 1. Issue/Feature Request Link
Direct link to the GitHub issue or discussion

### 2. Status Badge
- **OPEN** (green) - Issue is being tracked, not yet resolved
- **CLOSED** (purple) - Issue has been resolved or feature implemented

### 3. Context Description
- Why this is relevant to your situation
- What it means for your configuration
- Impact on your implementation

### 4. Actionable Guidance
- **If Open**: How to upvote, follow, or add your use case
- **If Closed**: Which version includes the fix
- **Workarounds**: Alternative approaches while waiting for official fix

---

## Example Scenarios

### Scenario 1: Unsupported Feature

**User Input:**
```java
Sentry.init(options -> {
  options.setDsn("...");
  options.addBreadcrumb(new Breadcrumb("custom_type")); // Custom type
});
```

**Issue:** "Breadcrumbs with custom types not appearing"

**Analyzer Output:**

> **Problem: Custom Breadcrumb Type Not Supported**
>
> The Java SDK currently only supports predefined breadcrumb types (`default`, `debug`, `error`, `navigation`, `http`, `info`, `query`, `transaction`, `ui`, `user`). Custom types are not yet available.
>
> 📌 **Related Feature Request**: [Add support for custom breadcrumb types](https://github.com/getsentry/sentry-java/issues/3958) - Status: **OPEN** (opened 2023)
>
> This feature is being tracked by the Sentry team. You can:
> - ⭐ **Upvote the issue** to show support and help prioritize
> - 📝 **Add your use case** to provide context on why you need this
> - 🔔 **Watch the issue** for updates on implementation progress
>
> **Recommended Action:**
> Use one of the existing breadcrumb types that best fits your use case. For example:
> ```java
> options.addBreadcrumb(new Breadcrumb(BreadcrumbType.DEFAULT));
> ```

---

### Scenario 2: Known Bug with Workaround

**User Input:**
```javascript
Sentry.init({
  dsn: "...",
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 1.0,
});
```

**Issue:** "Performance traces not capturing in Safari 15"

**Analyzer Output:**

> **Problem: Safari 15 Performance Tracing Issue**
>
> There was a known issue with Performance API in Safari 15 that affected tracing.
>
> 📌 **Related Issue**: [Performance API broken in Safari 15](https://github.com/getsentry/sentry-javascript/issues/4567) - Status: **CLOSED**
>
> **Fixed in version 7.45.0**
>
> **Recommended Action:**
> Update your Sentry JavaScript SDK to 7.45.0 or later:
> ```bash
> npm install @sentry/browser@latest
> ```

---

### Scenario 3: Breaking Change Documentation

**User Input:**
```javascript
Sentry.init({
  dsn: "...",
  tracingOptions: {  // Old v7 API
    tracePropagationTargets: ["api.example.com"]
  }
});
```

**Issue:** "Upgraded to v8, now tracing doesn't work"

**Analyzer Output:**

> **Problem: Breaking Change in v8 Migration**
>
> The `tracingOptions` configuration was moved to top-level in Sentry JavaScript v8.
>
> 📌 **Related Migration Guide**: [v7 to v8 Breaking Changes](https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md#traceoptions-moved-to-top-level) - Status: **CLOSED** (fixed in v8.0.0)
>
> **Fix:**
> ```javascript
> Sentry.init({
>   dsn: "...",
>   tracePropagationTargets: ["api.example.com"]  // Now top-level
> });
> ```

---

## UI Display

### In Problems Section

GitHub issues appear as purple cards below the problem description and fix:

```
┌─────────────────────────────────────────────────┐
│ ❌ Problem: Custom Breadcrumb Type Not Supported│
│                                                 │
│ Description: The Java SDK currently only        │
│ supports predefined breadcrumb types...         │
│                                                 │
│ 🔧 Recommended Fix:                             │
│ options.addBreadcrumb(...)                      │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 📌 Add support for custom breadcrumb... │   │
│ │ Status: OPEN                             │   │
│ │ This feature is being tracked...        │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### In Suggestions Section

Similar purple cards appear below suggestions that relate to feature requests:

```
┌─────────────────────────────────────────────────┐
│ 💡 Suggestion: Consider using Session Replay    │
│                                                 │
│ Description: Session Replay can help debug...   │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 📌 Add mobile Session Replay support... │   │
│ │ Status: OPEN                             │   │
│ │ Feature request for mobile platforms... │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Related Resources Section

A dedicated section appears when multiple related GitHub resources are found:

```
┌──────────────────────────────────────────────────┐
│ 🔗 Related GitHub Discussions & Feature Requests │
│                                                  │
│ 🐛 Issue: Performance API broken in Safari 15   │
│    Fixed in version 7.45.0                       │
│                                                  │
│ ✨ Feature Request: Custom instrumentation API  │
│    Track this for updates on implementation      │
│                                                  │
│ 💬 Discussion: Best practices for Next.js       │
│    Community solutions and recommendations       │
└──────────────────────────────────────────────────┘
```

---

## Benefits

### 🎯 Save Time
Don't waste hours trying to make unsupported features work. Know immediately if it's a configuration issue or SDK limitation.

### 📚 Learn About Roadmap
Discover upcoming features and their progress. Plan your implementation timeline accordingly.

### 🔧 Find Workarounds
Access community-vetted workarounds while waiting for official fixes.

### 🗳️ Influence Priorities
Learn how to upvote issues that matter to your team. Help Sentry prioritize features.

### 🔄 Stay Updated
Follow issues to get notified when features are implemented or bugs are fixed.

### ✅ Version Planning
Know which SDK versions include specific fixes. Plan your upgrade path.

---

## How to Use the Information

### When Status is OPEN

1. **Click the link** to view the full GitHub issue
2. **Read the discussion** to understand context and workarounds
3. **Upvote (👍)** the first post to show support
4. **Comment** with your specific use case if it adds new information
5. **Watch (👁️)** the issue to get notifications on progress

### When Status is CLOSED

1. **Check the fix version** mentioned in the description
2. **Verify your SDK version**: Are you on the fixed version?
3. **Upgrade if needed**:
   ```bash
   npm install @sentry/browser@latest
   ```
4. **Review migration guides** if upgrading across major versions

### When a Workaround is Provided

1. **Implement the workaround** as a temporary solution
2. **Add a TODO comment** referencing the GitHub issue
3. **Watch the issue** to know when to remove the workaround
4. **Plan to refactor** once the official solution is available

---

## Example: Full Analysis with GitHub Integration

**User Configuration (Java SDK):**
```java
Sentry.init(options -> {
  options.setDsn("https://...");
  options.setTracesSampleRate(0.01);
  options.addBreadcrumb(new Breadcrumb("custom_tracking"));
});
```

**Issue:** "Not seeing breadcrumbs in Sentry, very little performance data"

**Analysis Output:**

✅ **What's Configured Correctly**
- DSN is properly set
- Performance monitoring is enabled

❌ **Problems Detected**

**1. Very Low Traces Sample Rate**
- **Severity:** HIGH
- **Description:** Only 1% of transactions are being captured
- **Fix:**
  ```java
  options.setTracesSampleRate(0.1); // 10% for production
  ```

**2. Custom Breadcrumb Type Not Supported**
- **Severity:** MEDIUM
- **Description:** Custom breadcrumb types are not available in Java SDK
- **Fix:**
  ```java
  options.addBreadcrumb(new Breadcrumb(BreadcrumbType.DEFAULT));
  ```
- 📌 **Related Feature Request**: [Add support for custom breadcrumb types](https://github.com/getsentry/sentry-java/issues/3958) - Status: **OPEN**

  This feature is being tracked. You can upvote to show support or follow for updates.

💡 **Suggestions**
- Enable debug mode during troubleshooting: `options.setDebug(true)`
- Consider adding contextual data with `options.setTag()`

🔗 **Related Resources**
- **✨ Feature Request**: Custom breadcrumb types - Track for future implementation
- **💬 Discussion**: Best practices for breadcrumb usage in Java

---

## Technical Implementation

### Backend (server.js)

The system prompt includes:

```javascript
GITHUB INTEGRATION - WHEN TO SEARCH:
Search Sentry's GitHub repositories when:
- User is trying to configure a feature that may not exist yet
- User reports behavior that seems like a bug or limitation
- Configuration option doesn't work as expected (might be a known issue)
...

GITHUB REPOSITORIES BY SDK:
- JavaScript/React/Vue/Angular: getsentry/sentry-javascript
- Python/Django/Flask: getsentry/sentry-python
...
```

### Frontend (src/services/analyzer.ts)

TypeScript interfaces support GitHub data:

```typescript
export interface GitHubIssue {
  url: string;
  title: string;
  status: 'open' | 'closed';
  description: string;
}

export interface AnalysisResult {
  problems: Array<{
    githubIssue?: GitHubIssue;
    // ...
  }>;
  // ...
}
```

### UI (src/App.tsx)

Displays GitHub cards with status badges and links.

---

## Privacy & Security

**What is sent to GitHub:**
- ❌ **Nothing** - The analyzer doesn't make API calls to GitHub
- ✅ Claude has knowledge of Sentry's GitHub repositories from training data
- ✅ Links provided are for user to explore manually

**Your configuration:**
- Never shared with GitHub
- GitHub links are informational only
- Clicking links is optional

---

## Feedback

Found a scenario where GitHub integration would be helpful but wasn't triggered? Let us know:
- Create an issue with example configuration
- Describe what GitHub resource would have been relevant
- We'll improve the detection logic

---

**Last Updated:** February 2026
