# 📊 Analytics & Insights

Comprehensive analytics tracking to understand user behavior and derive product insights.

## 🎯 What We Track

### 1. Query Analytics
**Purpose:** Understand what questions users ask and how they use the tool

**Events Tracked:**
- `Query Submitted` - Every time a user asks a question
  - Mode (config vs general)
  - SDK type
  - Model used (Opus vs Sonnet)
  - Extended thinking enabled/disabled
  - Has issue context (config mode)
  - Conversation length (for follow-ups)
  - Is follow-up question (boolean)

**Metrics:**
- `copilot.query.submitted` - Counter by mode, SDK, model
- `copilot.query.follow_up` - Counter for follow-up questions

**Key Questions Answered:**
- Which mode is more popular? (config vs general)
- Which SDKs do users need help with most?
- Do users prefer Opus or Sonnet?
- How many users enable extended thinking?
- What % of queries are follow-up questions?

---

### 2. Performance Analytics
**Purpose:** Monitor response times and cost metrics

**Events Tracked:**
- `Query Completed` - When Claude finishes responding
  - Duration (milliseconds)
  - Model used
  - Thinking tokens used (if extended thinking)
  - Response token count

**Metrics:**
- `copilot.query.duration` - Distribution of response times
- `copilot.thinking.tokens` - Distribution of thinking token usage

**Key Questions Answered:**
- What's the p50/p95/p99 response time?
- How much do thinking tokens add to latency?
- Is Opus significantly slower than Sonnet?
- What's our average API cost per query?

---

### 3. Outcome/Engagement Analytics
**Purpose:** Measure user satisfaction and engagement signals

**Events Tracked:**
- `Copy Answer` - User copied the AI response
- `Download PDF` - User exported analysis to PDF (high intent!)
- `New Conversation` - User started fresh conversation
  - Includes final conversation length

**Metrics:**
- `copilot.outcome.copy_answer` - Counter
- `copilot.outcome.download_pdf` - Counter
- `copilot.outcome.new_conversation` - Counter
- `copilot.conversation.length` - Distribution of conversation lengths

**Key Questions Answered:**
- What % of users copy the answer? (engagement signal)
- What % download PDF? (high intent / satisfaction signal)
- How long are typical conversations?
- Do users have multi-turn conversations or single queries?

---

### 4. Product Insights (GOLD MINE 💰)
**Purpose:** Identify common issues, feature gaps, SDK pain points

**Events Tracked:**
- `Configuration Issues Identified` - When problems are found
  - Issue types (sanitized titles)
  - Severity levels
  - SDK type
  - Issue count

- `Complex Configuration Detected` - When human review is recommended
  - Reason for complexity
  - Problem count
  - SDK type

**Metrics:**
- `copilot.issue.found` - Counter by SDK, severity, issue type
- `copilot.complexity.human_review_needed` - Counter by SDK

**Key Questions Answered:**
- What are the most common Sentry configuration issues?
- Which SDKs have the most problems?
- What issues are critical vs low severity?
- Which configurations are too complex for the tool?
- What documentation needs improvement?

---

### 5. Navigation & Behavior
**Purpose:** Understand user journey through the tool

**Events Tracked:**
- Mode switches (config ↔ general)
- SDK selection changes

**Metrics:**
- `copilot.mode.switch` - Counter (from → to)
- `copilot.sdk.selected` - Counter by SDK and mode

**Breadcrumbs:**
- Mode switches logged as navigation breadcrumbs

**Key Questions Answered:**
- Do users switch between modes frequently?
- Do they start with config or general Q&A?
- Which SDKs are selected most often?

---

### 6. Error Tracking
**Purpose:** Identify reliability issues

**Events Tracked:**
- Query errors (config or general mode)
  - Error type
  - Mode
  - Model
  - SDK type

**Metrics:**
- `copilot.query.error` - Counter by mode and model

**Key Questions Answered:**
- What's our error rate by mode?
- Which models are more reliable?
- What types of errors occur most?

---

## 📈 How to View Analytics in Sentry

### Metrics Dashboard
1. Go to **Sentry → Your Project → Metrics**
2. Query examples:
   ```
   copilot.query.submitted{mode:general}
   copilot.query.duration{model:opus-4.5}
   copilot.issue.found{sdk_type:JavaScript,severity:critical}
   ```

### Events & Insights
1. Go to **Sentry → Your Project → Discover**
2. Filter by:
   - `message:Query Submitted` - See all queries
   - `message:Complex Configuration Detected` - Find pain points
   - `message:PDF Downloaded` - High-intent users

3. Group by:
   - `tags.sdk_type` - Issues by SDK
   - `tags.model` - Usage by model
   - `contexts.query.is_follow_up` - Follow-up rate

### Example Queries

**Most common SDK issues:**
```sql
SELECT
  tags.sdk_type,
  tags.issue_type,
  COUNT() as count
FROM events
WHERE message = 'Configuration Issues Identified'
GROUP BY sdk_type, issue_type
ORDER BY count DESC
```

**Average conversation length:**
```sql
SELECT
  AVG(contexts.conversation.length) as avg_length,
  PERCENTILE(contexts.conversation.length, 0.5) as median
FROM events
WHERE message = 'Conversation Ended'
```

**Response time by model:**
```sql
SELECT
  tags.model,
  PERCENTILE(contexts.performance.duration_ms, 0.5) as p50,
  PERCENTILE(contexts.performance.duration_ms, 0.95) as p95
FROM events
WHERE message = 'Query Completed'
GROUP BY model
```

---

## 🎁 Product Insights You Can Extract

### User Behavior Patterns
- **Mode preference:** Do users prefer Config Analysis or General Q&A?
- **Model preference:** Is Opus worth the extra cost vs Sonnet?
- **Follow-up rate:** Are users having conversations or single queries?
- **Engagement:** What % copy answers or download PDFs?

### SDK & Documentation Gaps
- **Top issues by SDK:** "JavaScript users struggle with sample rates"
- **Severity trends:** "Python has more critical issues than Ruby"
- **Common mistakes:** "60% of issues involve missing integrations"

### Feature Validation
- **Extended thinking adoption:** Do users leave it on?
- **Chat conversations:** Are multi-turn conversations working?
- **Mode switching:** Do users use both modes or stick to one?

### Cost Optimization
- **Token usage:** How many thinking tokens per query?
- **Model efficiency:** Can we recommend Sonnet for simple queries?
- **Response times:** Where can we optimize latency?

### Escalation Patterns
- **Complexity rate:** How often do we recommend human review?
- **Complexity reasons:** What makes configs too complex?
- **SDK complexity:** Which SDKs trigger complexity warnings most?

---

## 🔒 Privacy & PII Protection

All analytics are designed to be **PII-safe**:

✅ **What we track:**
- Issue types (sanitized, no specific values)
- SDK types
- Model selection
- Timing metrics
- Engagement signals

❌ **What we DON'T track:**
- Actual question content (only metadata)
- Configuration code
- DSNs or API keys
- User identifiable information
- IP addresses (if Sentry scrubbing is enabled)

**Sanitization Example:**
```
Original issue: "tracesSampleRate: 0.01 is too low"
Tracked as: "tracessamplerate: N.NN is too low"
```

Numbers and quoted strings are replaced to prevent PII leakage while preserving issue patterns.

---

## 🚀 Next Steps

### Dashboards to Build
1. **Executive Dashboard**
   - Daily active queries
   - Mode split (config vs general)
   - Engagement rate (copies + PDFs)
   - Error rate

2. **Product Insights Dashboard**
   - Top 10 issues by SDK
   - Critical issues trending up
   - Feature gaps (questions we can't answer)
   - Complexity triggers

3. **Performance Dashboard**
   - Response time p50/p95/p99
   - Thinking token usage
   - Cost per query
   - Error rate by model

4. **User Journey Dashboard**
   - Mode switches
   - Conversation lengths
   - Follow-up question rate
   - Time to first query

### Alerts to Set Up
- Error rate > 5%
- Response time p95 > 10 seconds
- Complexity rate > 30%
- Critical issues spike for specific SDK

---

## 📝 Adding New Analytics

To track a new event:

1. Add tracking function to `src/utils/analytics.ts`
2. Call it from the appropriate component
3. Update this doc with what you're tracking
4. Create Sentry dashboard to visualize

Example:
```typescript
export function trackNewFeature(data: { ... }) {
  Sentry.metrics.increment('copilot.feature.new_thing', 1, {
    tags: { ... }
  })

  Sentry.captureEvent({
    message: 'New Feature Used',
    level: 'info',
    contexts: { ... }
  })
}
```
