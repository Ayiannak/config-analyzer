# Error Tracking Guide

## Overview

All instrumented operations now have detailed error tracking that associates errors with specific spans and operations. This allows you to see exactly which metric/operation failed and why.

---

## How Errors Are Associated with Metrics

Every error captured includes:
1. **Operation Tag** - Identifies which operation failed
2. **Span Context** - Automatically links error to performance span
3. **Custom Fingerprints** - Groups similar errors together
4. **Contextual Data** - Metadata about the request/operation

---

## Viewing Errors by Operation in Sentry

### Method 1: Filter by Operation Tag

Navigate to **Issues** in Sentry:
https://anthony-test-org.sentry.io/issues/

Filter by operation:
- `operation:config.analysis` - Analysis errors
- `operation:config.generate_fixed` - Fixed config generation errors
- `operation:config.export_pdf` - PDF export errors
- `operation:config.chat` - Chat errors
- `operation:config.file_upload` - File upload errors
- `operation:api.analyze_stream` - Streaming API errors
- `operation:api.analyze` - Standard API errors
- `operation:api.chat` - Chat API errors
- `operation:api.generate_fixed_config` - Generate API errors

### Method 2: View in Performance Traces

Navigate to **Performance** → **Traces**:
https://anthony-test-org.sentry.io/performance/traces/

When an error occurs during a traced operation:
- The trace will show the error icon
- Click the span to see the associated error
- Error details include full stack trace and context

### Method 3: Dashboard Widget

Add a widget to your dashboard showing errors by operation:
```
count() by operation where event.type:error
```

---

## Error Details Captured

### Frontend Operations

#### **config.analysis**
- **Tags:**
  - `operation: config.analysis`
  - `sdk_type: JavaScript/Python/etc`
  - `model: sonnet-4/opus-4.5`
  - `streaming: true/false`
  - `extended_thinking: true/false`
- **Context:**
  - Config code length
  - Has issue context
- **Fingerprint:** `['config-analysis-error', sdkType, model]`

#### **config.generate_fixed**
- **Tags:**
  - `operation: config.generate_fixed`
  - `sdk_type`
  - `model`
- **Context:**
  - Problem count
  - Config length
- **Fingerprint:** `['generate-fixed-config-error', model]`

#### **config.export_pdf**
- **Tags:**
  - `operation: config.export_pdf`
  - `sdk_type`
  - `model`
- **Context:**
  - Problem count
  - Has fixed config
- **Fingerprint:** `['export-pdf-error']`

#### **config.chat**
- **Tags:**
  - `operation: config.chat`
  - `sdk_type`
  - `model`
- **Context:**
  - Message count
  - Message length
  - Has previous context
- **Fingerprint:** `['chat-error', model]`

#### **config.file_upload**
- **Tags:**
  - `operation: config.file_upload`
- **Context:**
  - File count
  - Total size bytes
  - File types
- **Fingerprint:** `['file-upload-error']`

### Backend Operations

#### **api.analyze_stream**
- **Tags:**
  - `operation: api.analyze_stream`
  - `sdk_type`
  - `model`
  - `extended_thinking`
- **Context:**
  - Has issue context
  - Config length
- **Fingerprint:** `['api-analyze-stream-error', model]`

#### **api.analyze**
- **Tags:**
  - `operation: api.analyze`
  - `sdk_type`
  - `model`
  - `extended_thinking`
- **Context:**
  - Has issue context
  - Config length
- **Fingerprint:** `['api-analyze-error', model]`

#### **api.chat**
- **Tags:**
  - `operation: api.chat`
  - `sdk_type`
  - `model`
- **Context:**
  - Message count
  - Config length
- **Fingerprint:** `['api-chat-error', model]`

#### **api.generate_fixed_config**
- **Tags:**
  - `operation: api.generate_fixed_config`
  - `sdk_type`
  - `model`
- **Context:**
  - Problem count
  - Config length
- **Fingerprint:** `['api-generate-fixed-config-error', model]`

---

## Example Queries

### Errors by Operation (Last 24h)
```
count() by operation where event.type:error
```

### Analysis Errors by Model
```
event.type:error operation:config.analysis sdk_type:*
group by model
```

### Failed Operations Rate
```
count_if(event.type, equals, error) / count() by operation
```

### Errors with High Problem Count
```
event.type:error problem_count:>5
```

---

## Setting Up Alerts

### Alert 1: High Error Rate for Analysis
**Condition:** Error rate > 10% for `config.analysis`
```
count_if(event.type, equals, error) / count() > 0.1
where operation:config.analysis
```

### Alert 2: Backend API Failures
**Condition:** Any error in backend operations
```
event.type:error operation:api.*
```

### Alert 3: Model-Specific Failures
**Condition:** High error rate for specific model
```
count() by model where event.type:error operation:config.analysis
```

---

## Debugging Workflow

When an error occurs:

1. **Go to Issues**
   - Filter by `operation:` tag to find errors for specific metric

2. **Check Error Details**
   - View stack trace
   - Review context data (config length, problem count, etc.)
   - Check tags (SDK type, model, etc.)

3. **View Related Traces**
   - Click "View Similar Events" or "Related Transactions"
   - See the full performance trace showing where error occurred
   - Review span duration and attributes

4. **Identify Pattern**
   - Custom fingerprints group similar errors
   - Check if errors occur for specific SDK types or models
   - Review context to understand what triggered the error

5. **Check Metrics**
   - Go to Performance dashboard
   - See if error coincides with performance degradation
   - Compare successful vs failed operations

---

## Benefits

✅ **Precise Error Attribution** - Know exactly which operation failed
✅ **Rich Context** - Understand what caused the error
✅ **Better Grouping** - Custom fingerprints group related errors
✅ **Trace Association** - Errors linked to performance spans
✅ **Actionable Insights** - Tags and context help debug faster
✅ **Pattern Detection** - Identify if errors affect specific SDKs/models

---

## Notes

- Errors are automatically associated with the active span
- All errors include request/operation context
- Fingerprints prevent duplicate issue creation
- Tags enable powerful filtering and analysis
- Context data helps reproduce and debug issues
