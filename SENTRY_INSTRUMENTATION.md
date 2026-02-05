# Sentry Instrumentation Summary

## Overview
Complete performance tracking and custom metrics have been added throughout the Config Analyzer application to measure "time to" metrics for all key operations.

---

## Frontend Instrumentation (src/App.tsx)

### 1. Config Analysis
**Function:** `handleAnalyze()`
- **Span Name:** `config.analysis`
- **Operation:** `config.analyze`
- **Metric:** `config.analysis.duration` (milliseconds)
- **Attributes:**
  - `analysis.sdk_type` - SDK being analyzed (JavaScript, Python, etc.)
  - `analysis.model` - AI model used (sonnet-4, opus-4.5)
  - `analysis.streaming` - Whether streaming mode is enabled
  - `analysis.extended_thinking` - Whether extended thinking is enabled
  - `analysis.duration_ms` - Total analysis time
  - `analysis.success` - Whether analysis completed successfully

### 2. Fixed Config Generation
**Function:** `handleGenerateFixedConfig()`
- **Span Name:** `config.generate_fixed`
- **Operation:** `config.generate_fixed`
- **Metric:** `config.generate_fixed.duration` (milliseconds)
- **Attributes:**
  - `generate.sdk_type` - SDK type
  - `generate.model` - AI model used
  - `generate.problem_count` - Number of problems being fixed
  - `generate.duration_ms` - Generation time
  - `generate.success` - Success status

### 3. PDF Export
**Function:** `handleExportPDF()`
- **Span Name:** `config.export_pdf`
- **Operation:** `config.export_pdf`
- **Metric:** `config.export_pdf.duration` (milliseconds)
- **Attributes:**
  - `export.sdk_type` - SDK type
  - `export.model` - Model used for analysis
  - `export.problem_count` - Number of problems in report
  - `export.recommendation_count` - Number of recommendations
  - `export.duration_ms` - Export time
  - `export.success` - Success status

### 4. Chat Interaction
**Function:** `handleSendMessage()`
- **Span Name:** `config.chat`
- **Operation:** `config.chat`
- **Metric:** `config.chat.duration` (milliseconds)
- **Attributes:**
  - `chat.sdk_type` - SDK type
  - `chat.model` - AI model used
  - `chat.message_count` - Number of messages in conversation
  - `chat.message_length` - Length of user's message
  - `chat.duration_ms` - Chat response time
  - `chat.response_length` - Length of AI response
  - `chat.success` - Success status

### 5. File Upload
**Function:** `handleFileUpload()`
- **Span Name:** `config.file_upload`
- **Operation:** `config.file_upload`
- **Metric:** `config.file_upload.duration` (milliseconds)
- **Attributes:**
  - `upload.file_count` - Number of files uploaded
  - `upload.total_size_bytes` - Total size of all files
  - `upload.duration_ms` - Upload processing time
  - `upload.success` - Success status

---

## Backend Instrumentation (server.js)

### 1. Streaming Analysis Endpoint
**Endpoint:** `POST /api/analyze-stream`
- **Span Name:** `POST /api/analyze-stream`
- **Operation:** `http.server`
- **Metric:** `api.analyze_stream.duration` (milliseconds)
- **Attributes:**
  - `http.method` - HTTP method (POST)
  - `http.route` - Route path
  - `api.sdk_type` - SDK type being analyzed
  - `api.model` - AI model used
  - `api.extended_thinking` - Extended thinking enabled
  - `api.has_issue_context` - Whether issue context was provided
  - `api.duration_ms` - Total endpoint duration
  - `api.response_length` - Length of response

### 2. Standard Analysis Endpoint
**Endpoint:** `POST /api/analyze`
- **Span Name:** `POST /api/analyze`
- **Operation:** `http.server`
- **Metric:** `api.analyze.duration` (milliseconds)
- **Attributes:**
  - `http.method` - HTTP method (POST)
  - `http.route` - Route path
  - `api.sdk_type` - SDK type being analyzed
  - `api.model` - AI model used
  - `api.extended_thinking` - Extended thinking enabled
  - `api.has_issue_context` - Whether issue context was provided
  - `api.duration_ms` - Total endpoint duration

### 3. Chat Endpoint
**Endpoint:** `POST /api/chat`
- **Span Name:** `POST /api/chat`
- **Operation:** `http.server`
- **Metric:** `api.chat.duration` (milliseconds)
- **Attributes:**
  - `http.method` - HTTP method (POST)
  - `http.route` - Route path
  - `api.sdk_type` - SDK type
  - `api.model` - AI model used
  - `api.message_count` - Number of messages in conversation
  - `api.duration_ms` - Chat processing time
  - `api.response_length` - Length of response

### 4. Fixed Config Generation Endpoint
**Endpoint:** `POST /api/generate-fixed-config`
- **Span Name:** `POST /api/generate-fixed-config`
- **Operation:** `http.server`
- **Metric:** `api.generate_fixed_config.duration` (milliseconds)
- **Attributes:**
  - `http.method` - HTTP method (POST)
  - `http.route` - Route path
  - `api.sdk_type` - SDK type
  - `api.model` - AI model used
  - `api.problem_count` - Number of problems to fix
  - `api.duration_ms` - Generation time
  - `api.response_length` - Length of generated config

---

## How to View Metrics in Sentry

### 1. Performance Dashboard
Navigate to: https://anthony-test-org.sentry.io/performance/

**Filter by operations:**
- `config.analyze` - Main analysis operations
- `config.generate_fixed` - Fixed config generation
- `config.export_pdf` - PDF exports
- `config.chat` - Chat interactions
- `config.file_upload` - File uploads
- `http.server` - Backend API operations

### 2. Custom Metrics
Navigate to: https://anthony-test-org.sentry.io/metrics/

**Available distribution metrics:**
- `config.analysis.duration` - Analysis time distribution
- `config.generate_fixed.duration` - Fixed config generation time
- `config.export_pdf.duration` - PDF export time
- `config.chat.duration` - Chat response time
- `config.file_upload.duration` - File upload processing time
- `api.analyze_stream.duration` - Streaming API response time
- `api.analyze.duration` - Standard API response time
- `api.chat.duration` - Chat API response time
- `api.generate_fixed_config.duration` - Fixed config API time

### 3. Example Queries

**Average analysis time by model:**
```
avg(config.analysis.duration) by analysis.model
```

**95th percentile API response time:**
```
p95(api.analyze_stream.duration)
```

**Chat response time by SDK type:**
```
avg(api.chat.duration) by api.sdk_type
```

**File upload success rate:**
```
count(config.file_upload) by upload.success
```

---

## Error Tracking

All instrumented operations automatically:
- Capture exceptions with full context
- Set error status on spans
- Link errors to performance data
- Track success/failure rates

Failed operations include:
- Full stack traces
- Request/operation context
- Timing information
- User-facing error messages

---

## Testing the Instrumentation

1. Start the application:
   ```bash
   npm run dev
   ```

2. Perform various operations:
   - Analyze a config
   - Generate a fixed config
   - Chat with the AI
   - Upload files
   - Export to PDF

3. View data in Sentry:
   - Performance data appears within ~30 seconds
   - Metrics aggregate over time
   - Error tracking is immediate

---

## Benefits

- **Performance Insights:** Understand which operations are slow
- **User Experience:** Track actual user wait times
- **Model Comparison:** Compare Claude Sonnet 4 vs Opus 4.5 performance
- **Optimization:** Identify bottlenecks in the analysis pipeline
- **Success Rates:** Track how often operations succeed vs fail
- **Trend Analysis:** Monitor performance over time as usage scales
