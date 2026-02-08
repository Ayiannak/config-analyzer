# Sentry Copilot - Specialized Troubleshooting

## What Makes This Tool Different

The Sentry Copilot is **NOT** a generic AI code assistant. It is a **specialized Sentry troubleshooting expert** trained on official Sentry docs and common Sentry-specific issues.

---

## Core Differentiation

### Generic AI vs. Sentry Copilot

| Generic AI | Sentry Copilot |
|------------|------------------------|
| Generic coding advice | Sentry-specific troubleshooting |
| Guesses at configuration issues | References official Sentry docs |
| May suggest incorrect Sentry patterns | Knows Sentry best practices |
| Doesn't understand Sentry concepts | Deep knowledge of DSN, events, transactions, spans |
| Can't diagnose Sentry-specific errors | Recognizes common Sentry issues and symptoms |
| No access to SDK repositories | Searches GitHub for known issues and feature requests |

---

## Sentry Documentation Knowledge

The analyzer has been trained on official Sentry docs including:

### Core Documentation
- **docs.sentry.io** - Complete Sentry documentation
- SDK setup guides for JavaScript, Python, and other platforms
- Configuration options and their implications
- Performance monitoring concepts
- Integration setup and configuration

### Common Issues Database
The tool recognizes and can troubleshoot:

1. **Events Not Being Sent**
   - DSN misconfiguration
   - Ad-blocker interference
   - CORS issues
   - Quota limits exceeded
   - Environment variable issues (Next.js, Vite, etc.)

2. **Performance Issues**
   - Sample rate misconfiguration
   - Missing browserTracingIntegration
   - Incorrect tracePropagationTargets
   - Transaction not capturing

3. **Data Quality Issues**
   - Missing source maps
   - Unreadable stack traces
   - Missing breadcrumbs
   - Insufficient context

4. **Security & PII Issues**
   - sendDefaultPii exposing sensitive data
   - Missing data filtering
   - Improper beforeSend implementation

5. **Integration Issues**
   - Missing or misconfigured integrations
   - Framework-specific setup errors
   - Replay not capturing
   - Profiling not working

---

## Sentry Best Practices Enforced

The analyzer enforces official Sentry best practices:

### Initialization
- ✅ Initialize SDK as early as possible
- ✅ Set appropriate sample rates (0.1-0.3 for production, not 1.0)
- ✅ Configure environment properly
- ✅ Set release tracking

### Performance Monitoring
- ✅ Use appropriate tracesSampleRate
- ✅ Configure tracePropagationTargets
- ✅ Enable relevant integrations
- ✅ Understand transaction/span model

### Data Management
- ✅ Upload source maps for production
- ✅ Filter sensitive data with beforeSend
- ✅ Use appropriate maxBreadcrumbs
- ✅ Configure proper context

### Troubleshooting
- ✅ Enable debug mode for diagnostics
- ✅ Use tunnel option for ad-blocker bypass
- ✅ Verify DSN configuration
- ✅ Check Sentry quota and stats

---

## Sentry-Specific Knowledge

### Concepts Understood
- **DSN (Data Source Name)** - How it routes events to projects
- **Events vs Issues** - The difference and relationship
- **Transactions & Spans** - Performance monitoring fundamentals
- **Breadcrumbs** - Context trail for debugging
- **Releases & Environments** - Version tracking and organization
- **Integrations** - Auto-instrumentation capabilities
- **Sample Rates** - Cost vs completeness tradeoffs
- **Distributed Tracing** - Multi-service performance tracking

### SDK-Specific Knowledge
- JavaScript/Browser SDK quirks and patterns
- Python SDK best practices
- Framework-specific setup (React, Next.js, Django, Flask)
- Integration configurations (Replay, BrowserTracing, etc.)

### Troubleshooting Techniques
- How to use debug mode effectively
- When to check Sentry Stats page
- How to verify events are being sent
- CORS configuration for cross-origin scripts
- Tunneling setup to bypass ad-blockers

---

## Example Analyses

### What Generic AI Might Say:
> "Your tracesSampleRate is set to 0.01. You might want to increase it."

### What Sentry Copilot Says:
> "**Problem: Insufficient Performance Data Capture**
>
> Your tracesSampleRate is set to 0.01 (1%), which means only 1 in 100 transactions are captured. This is why you're not seeing performance data in Sentry's Performance tab.
>
> According to Sentry best practices, production environments should use 0.1-0.3 (10-30%) for adequate visibility while managing costs. Development can use 1.0 (100%).
>
> **Fix:**
> ```javascript
> tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0
> ```
>
> This gives you 20% sampling in production (sufficient for pattern detection) and 100% in development (full visibility for debugging).
>
> **Reference:** [Sentry Performance Monitoring Docs](https://docs.sentry.io/product/performance/)"

---

## Complexity Assessment

The analyzer can detect when issues are beyond automated analysis and require human experts:

### Triggers for Human Review:
- Multiple critical security issues
- Complex architectural problems requiring production context
- 5+ distinct problems (systemic issues)
- Advanced custom implementations
- Compliance or data loss concerns
- Ambiguous root causes

### Recommendations Provided:
- "Contact Sentry Support at support@sentry.io"
- "Consult with your senior engineer"
- "Schedule an architecture review with your team"
- "Review the Sentry Enterprise docs for advanced configuration"

---

## GitHub Integration

### Accessing Sentry's Open Source Knowledge Base

The analyzer can search and reference Sentry's GitHub repositories to provide deeper context about:
- Known issues and limitations
- Feature requests and their status
- Bug reports and workarounds
- Community discussions
- Upcoming features and roadmap items

### When GitHub Integration Activates

The analyzer automatically searches GitHub when:
1. **Feature Doesn't Exist** - User tries to configure something not yet available
2. **Known Bug/Limitation** - Behavior suggests a documented SDK issue
3. **Unexpected Behavior** - Configuration seems correct but doesn't work as expected
4. **Recent Changes** - Feature behavior may have changed in recent SDK versions
5. **Workarounds Needed** - Official solution pending, but community has workarounds

### Supported Repositories

The analyzer searches the appropriate SDK repository based on your configuration:
- **JavaScript/React/Vue/Angular**: [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript)
- **Python/Django/Flask**: [getsentry/sentry-python](https://github.com/getsentry/sentry-python)
- **Ruby/Rails**: [getsentry/sentry-ruby](https://github.com/getsentry/sentry-ruby)
- **Java/Kotlin/Android**: [getsentry/sentry-java](https://github.com/getsentry/sentry-java)
- **PHP/Laravel**: [getsentry/sentry-php](https://github.com/getsentry/sentry-php)
- **Go**: [getsentry/sentry-go](https://github.com/getsentry/sentry-go)
- **.NET/C#**: [getsentry/sentry-dotnet](https://github.com/getsentry/sentry-dotnet)
- **React Native**: [getsentry/sentry-react-native](https://github.com/getsentry/sentry-react-native)
- **iOS/Swift**: [getsentry/sentry-cocoa](https://github.com/getsentry/sentry-cocoa)
- **Dart/Flutter**: [getsentry/sentry-dart](https://github.com/getsentry/sentry-dart)

### Example: GitHub-Enhanced Analysis

**User Reports:** "Custom breadcrumb types not working in Java SDK"

**Generic AI Response:**
> "Try using `Sentry.addBreadcrumb()` with a custom type parameter."

**Sentry Copilot with GitHub:**
> "**Known Limitation**: Custom breadcrumb types are not yet supported in the Java SDK.
>
> 📌 **Related Feature Request**: [Add support for custom breadcrumb types](https://github.com/getsentry/sentry-java/issues/3958) - Status: **OPEN** (opened 2023)
>
> This feature is being tracked by the Sentry team. You can:
> - ⭐ Upvote the issue to show support
> - 📝 Add your use case to help prioritize
> - 🔔 Watch the issue for updates
>
> **Workaround**: Currently, you can only use the standard breadcrumb types: `default`, `debug`, `error`, `navigation`, `http`, `info`, `query`, `transaction`, `ui`, `user`."

### Information Provided

When linking to GitHub issues, the analyzer includes:
- **Issue Title** - Clear description of the issue/feature
- **Status** - Open or Closed
- **Context** - Why this is relevant to your situation
- **Actions** - What you can do (upvote, follow, implement workaround)
- **Version Info** - If closed, which version includes the fix

### Benefits

✅ **Know if it's you or the SDK** - Distinguish configuration errors from SDK limitations
✅ **Save time** - Avoid spending hours trying to make unsupported features work
✅ **Stay informed** - Learn about upcoming features and their progress
✅ **Find workarounds** - Access community solutions from GitHub discussions
✅ **Influence roadmap** - Learn how to upvote features that matter to you

---

## Integration with Sentry Features

The analyzer understands and references:

### Sentry UI Features
- **Issues Tab** - Error tracking and grouping
- **Performance Tab** - Transaction and span analysis
- **Replays Tab** - Session replay viewing
- **Releases Tab** - Version tracking
- **Stats Page** - Quota and usage monitoring

### Sentry Concepts
- Event grouping and fingerprinting
- Issue states (unresolved, resolved, ignored)
- Alert rules and notifications
- User feedback integration
- Cron monitoring

---

## Continuous Learning

The analyzer's knowledge is based on Sentry documentation as of February 2026. Key documentation areas include:

- Platform SDKs (JavaScript, Python, Ruby, Go, etc.)
- Product features (Error Monitoring, Performance, Replays, Profiling)
- Configuration options and their effects
- Troubleshooting guides
- Integration setup guides
- API documentation

---

## Use Cases Where Specialization Matters

### 1. Debugging "Events Not Showing Up"
- Generic AI: Suggests checking internet connection
- **This Tool**: Checks DSN, ad-blockers, CORS, quota, debug mode, environment variables

### 2. Performance Monitoring Not Working
- Generic AI: Suggests enabling performance
- **This Tool**: Checks browserTracingIntegration, tracesSampleRate, tracePropagationTargets, explains transactions vs spans

### 3. Source Maps Not Working
- Generic AI: Suggests uploading source maps
- **This Tool**: Explains source map upload methods, checks release configuration, verifies URL matching, references sentry-cli

### 4. High Costs
- Generic AI: Suggests reducing usage
- **This Tool**: Analyzes sample rates, explains extrapolation, suggests appropriate rates by environment, mentions inbound filters

### 5. Missing Context
- Generic AI: Suggests adding more logging
- **This Tool**: Explains breadcrumbs, contexts, tags, beforeSend, and how to configure each properly

---

## Verification

You can verify the tool's Sentry specialization by:

1. **Testing with Sentry-specific concepts**
   - Ask about DSN, breadcrumbs, transactions, or spans
   - The tool will reference official documentation

2. **Comparing with generic AI**
   - Try the same config in ChatGPT vs this tool
   - Note the difference in specificity and accuracy

3. **Checking recommendations**
   - The tool references official Sentry best practices
   - Provides Sentry-specific debugging steps
   - Suggests relevant Sentry UI features to check

---

## Limitations

While specialized, the tool:
- Cannot access your actual Sentry project data
- Cannot see your Sentry UI or quota usage
- Cannot debug issues requiring production metrics
- May not know about very recent SDK changes (post-Feb 2026)
- Cannot replace human expertise for complex architectural issues

For these cases, the tool will recommend consulting Sentry Support or your engineering team.

---

## Summary

The Sentry Copilot is your specialized Sentry troubleshooting assistant that:
- ✅ Knows official Sentry docs
- ✅ Recognizes common Sentry issues
- ✅ Enforces Sentry best practices
- ✅ References Sentry-specific concepts
- ✅ Provides actionable Sentry-focused solutions
- ✅ Knows when to escalate to human experts

Use this tool when you need Sentry expertise, not generic coding advice.
