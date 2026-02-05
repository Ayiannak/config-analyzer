# Sentry Dashboard Setup

## Custom Metrics Dashboard for Config Analyzer

This document provides instructions for creating a dashboard to visualize all the custom metrics instrumented in the Config Analyzer application.

## Option 1: Manual Dashboard Creation (Recommended)

1. Navigate to your Sentry organization dashboards:
   https://anthony-test-org.sentry.io/dashboards/

2. Click **"Create Dashboard"**

3. Name it: **"Config Analyzer - Performance Metrics"**

4. Add the following widgets:

### Widget 1: Analysis Time Distribution
- **Type:** Line Chart
- **Query:**
  - `p50(config.analysis.duration)`
  - `p95(config.analysis.duration)`
  - `p99(config.analysis.duration)`
- **Y-Axis:** Milliseconds

### Widget 2: Analysis Time by Model
- **Type:** Line Chart
- **Query:** `avg(config.analysis.duration) by analysis.model`
- **Group By:** `analysis.model`

### Widget 3: Total Analyses
- **Type:** Big Number
- **Query:** Count of spans with operation `config.analyze`

### Widget 4: Chat Response Time
- **Type:** Line Chart
- **Query:**
  - `p50(config.chat.duration)`
  - `p95(config.chat.duration)`

### Widget 5: Fixed Config Generation Time
- **Type:** Line Chart
- **Query:**
  - `p50(config.generate_fixed.duration)`
  - `p95(config.generate_fixed.duration)`

### Widget 6: PDF Export Time
- **Type:** Line Chart
- **Query:** `avg(config.export_pdf.duration)`

### Widget 7: File Upload Processing
- **Type:** Line Chart
- **Query:** `avg(config.file_upload.duration)`

### Widget 8: API Streaming Analysis
- **Type:** Line Chart
- **Query:**
  - `p50(api.analyze_stream.duration)`
  - `p95(api.analyze_stream.duration)`

### Widget 9: API Chat Duration
- **Type:** Line Chart
- **Query:** `avg(api.chat.duration)`

### Widget 10: All Operations
- **Type:** Table
- **Query:** Count by transaction name

### Widget 11: Streaming vs Non-Streaming
- **Type:** Bar Chart
- **Query:** `avg(config.analysis.duration) by analysis.streaming`

## Option 2: Using Metrics Explorer

Navigate to **Metrics** in Sentry:
https://anthony-test-org.sentry.io/metrics/

Search for these distribution metrics:
- `config.analysis.duration`
- `config.chat.duration`
- `config.generate_fixed.duration`
- `config.export_pdf.duration`
- `config.file_upload.duration`
- `api.analyze_stream.duration`
- `api.analyze.duration`
- `api.chat.duration`
- `api.generate_fixed_config.duration`

You can:
- View distributions (p50, p75, p95, p99)
- Filter by attributes (model, SDK type, etc.)
- Create custom queries
- Add to dashboards

## Key Metrics to Monitor

### Performance
- **Analysis Duration**: How long it takes to analyze configs
- **API Response Times**: Backend performance
- **Chat Response**: AI chat latency

### Usage Patterns
- **Operations by SDK Type**: Which SDKs are analyzed most
- **Model Usage**: Sonnet 4 vs Opus 4.5 usage
- **Streaming vs Non-streaming**: Performance comparison

### Success Rates
- Monitor for failed operations
- Track error rates by operation type

## Example Queries

### Average analysis time today:
```
avg(config.analysis.duration) [last 24h]
```

### 95th percentile by model:
```
p95(config.analysis.duration) by analysis.model
```

### Chat operations per hour:
```
count() where transaction:config.chat [grouped by hour]
```

### Slowest operations:
```
p99(config.analysis.duration)
```

## Alert Recommendations

Consider setting up alerts for:
1. **Slow Analysis**: Alert if p95 > 30 seconds
2. **API Errors**: Alert on error rate > 5%
3. **High Latency**: Alert if chat response p95 > 10 seconds

## Notes

- Metrics may take 1-2 minutes to appear in Sentry after an operation
- Custom metrics are retained for 90 days by default
- Use the Performance tab for detailed span analysis
- Use the Metrics tab for aggregated distributions
