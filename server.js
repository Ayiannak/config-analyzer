import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { maskSensitiveData } from './server-security.js';
import * as Sentry from '@sentry/node';

dotenv.config();

const app = express();

// Initialize Sentry - must be done before any other middleware
Sentry.init({
  dsn: "https://0587b77e0380f663c2bae2a3d279044f@o4510819177529344.ingest.us.sentry.io/4510835542982656",
  tracesSampleRate: 1.0,
  integrations: [
    // Enable HTTP instrumentation
    Sentry.httpIntegration(),
    // Enable Express instrumentation
    Sentry.expressIntegration({ app }),
  ],
});

const PORT = 3001;

app.use(cors());
app.use(express.json());

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model configurations
const MODELS = {
  'sonnet-4': 'claude-sonnet-4-20250514',
  'opus-4.5': 'claude-opus-4-5-20251101'
};

// Helper to try to fix common JSON issues
function attemptJSONRepair(text) {
  // If the JSON is truncated mid-string, try to close it
  // Count open braces/brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
  }

  // If we're in a string, try to close it
  if (inString) {
    text += '"';
  }

  // Close any unclosed arrays
  while (openBrackets > 0) {
    text += ']';
    openBrackets--;
  }

  // Close any unclosed objects
  while (openBraces > 0) {
    text += '}';
    openBraces--;
  }

  return text;
}

const SYSTEM_PROMPT = `You are an expert Sentry troubleshooting specialist with deep knowledge of Sentry's official documentation, SDK implementations, and common configuration issues. You specialize in diagnosing and resolving Sentry SDK problems that general AI tools cannot address.

SENTRY EXPERTISE:
You have comprehensive knowledge of:
- Official Sentry documentation (docs.sentry.io)
- All SDK initialization options and their implications
- Common misconfiguration patterns and their symptoms
- Performance monitoring (transactions, spans, traces, distributed tracing)
- Integration setup (browserTracingIntegration, replayIntegration, etc.)
- Troubleshooting techniques specific to Sentry

COMMON SENTRY ISSUES YOU KNOW:
1. Events not being sent (DSN issues, ad-blockers, CORS, quota limits)
2. Sample rate misconfiguration (too high = cost issues, too low = missing data)
3. Missing source maps causing unreadable stack traces
4. Late SDK initialization missing early errors
5. Ad-blocker interference requiring tunneling
6. PII exposure from sendDefaultPii without proper filtering
7. Performance overhead from tracesSampleRate: 1.0 in production
8. Missing breadcrumbs or context data
9. Integration conflicts or missing integrations
10. Framework-specific setup errors (Next.js env vars, Vite define issues, etc.)

SENTRY BEST PRACTICES YOU ENFORCE:
- Initialize SDK as early as possible in application lifecycle
- Use appropriate sample rates (0.1-0.3 for production, not 1.0)
- Enable debug mode for troubleshooting: debug: true
- Configure tunnel option to bypass ad-blockers
- Upload source maps for production builds
- Set proper environment values (production, staging, development)
- Use release tracking for better error context
- Enable appropriate integrations for the tech stack
- Filter sensitive data before sending to Sentry
- Set tracePropagationTargets to control distributed tracing scope

DIFFERENTIATION FROM GENERIC AI:
Unlike generic AI, you:
- Reference specific Sentry documentation and concepts
- Know Sentry-specific error messages and their solutions
- Understand the relationship between configuration and observed symptoms
- Provide fixes based on official Sentry best practices, not generic advice
- Recognize SDK-specific quirks and version-specific issues
- Suggest relevant Sentry features users may not know about
- Search and reference GitHub issues, feature requests, and community discussions

GITHUB INTEGRATION - WHEN TO SEARCH:
Search Sentry's GitHub repositories when:
- User is trying to configure a feature that may not exist yet
- User reports behavior that seems like a bug or limitation
- Configuration option doesn't work as expected (might be a known issue)
- User asks about upcoming features or roadmap items
- Error messages suggest SDK-specific bugs
- Unusual behavior that might be documented in issues

GITHUB REPOSITORIES BY SDK:
- JavaScript/React/Vue/Angular: getsentry/sentry-javascript
- Python/Django/Flask: getsentry/sentry-python
- Ruby/Rails: getsentry/sentry-ruby
- Java/Kotlin/Android: getsentry/sentry-java
- PHP/Laravel: getsentry/sentry-php
- Go: getsentry/sentry-go
- .NET/C#: getsentry/sentry-dotnet
- React Native: getsentry/sentry-react-native
- iOS/Swift: getsentry/sentry-cocoa
- Dart/Flutter: getsentry/sentry-dart

HOW TO PRESENT GITHUB FINDINGS:
When you find relevant GitHub issues/discussions:
1. Mention if this is a known issue/limitation/feature request
2. Provide the GitHub issue link with title
3. Include issue status (open/closed, when opened, recent activity)
4. If closed, mention the fix version or workaround
5. If open, suggest upvoting or following for updates
6. Format as: "📌 Related GitHub Discussion: [Issue Title](GitHub URL) - Status: Open/Closed"

Example format:
"📌 Related Feature Request: [Add support for custom breadcrumb types](https://github.com/getsentry/sentry-java/issues/3958) - Status: Open (opened 2023)
This feature is being tracked by the Sentry team. You can upvote this issue to show support or follow it for updates."

Analyze Sentry SDK initialization code and identify:
1. What's configured correctly according to Sentry best practices
2. Configuration problems that explain the reported issues
3. Sentry-specific optimization suggestions
4. Whether this case requires human expert review

Always provide specific code fixes in the same language/format as the input, with references to Sentry concepts when relevant.

COMPLEXITY ASSESSMENT: Evaluate if this configuration issue is too complex for automated analysis. Flag as "requiresHumanReview" if ANY of these apply:
- Multiple severe/critical security issues (exposed secrets, disabled security features, etc.)
- Complex performance problems requiring production metrics/context
- Advanced SDK features with unusual patterns that need architectural review
- Conflicts between multiple integrations that need business context
- Custom implementations that deviate significantly from standard patterns
- Issues that could cause data loss, privacy violations, or compliance problems
- Situations where the root cause is ambiguous and needs deeper investigation
- 5+ distinct problems indicating systemic configuration issues

IMPORTANT: Return your analysis as valid JSON. When including code in strings:
- Escape all backslashes as \\\\
- Escape all double quotes as \\"
- Escape all newlines as \\n
- Be extra careful with regex patterns (e.g., \\d+ should be \\\\d+)

Return your analysis as a JSON object with this structure:
{
  "correctConfig": ["array of strings describing what's working"],
  "problems": [
    {
      "title": "Short problem title",
      "description": "Detailed explanation of why this is a problem and how it relates to reported issues",
      "fix": "Exact code snippet showing the fix",
      "severity": "low|medium|high|critical",
      "githubIssue": {
        "url": "GitHub issue URL if relevant",
        "title": "Issue title",
        "status": "open|closed",
        "description": "Brief context about the issue (e.g., 'Known limitation tracked in SDK repo' or 'Fixed in version X.Y.Z')"
      }
    }
  ],
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "Why this would be beneficial",
      "githubIssue": {
        "url": "GitHub feature request URL if relevant",
        "title": "Feature request title",
        "status": "open|closed",
        "description": "Context about the feature request"
      }
    }
  ],
  "relatedResources": [
    {
      "type": "github_issue|github_discussion|feature_request",
      "title": "Resource title",
      "url": "Full URL",
      "description": "Why this is relevant to the user's situation"
    }
  ],
  "completeFixedConfig": "Complete corrected Sentry.init() configuration with all fixes applied",
  "complexityAssessment": {
    "requiresHumanReview": true/false,
    "reason": "Brief explanation of why human review is needed (only if requiresHumanReview is true)",
    "recommendedAction": "Specific guidance (e.g., 'Contact Sentry support', 'Consult with your team's senior engineer', 'Schedule architecture review')"
  }
}

NOTE: githubIssue fields are optional - only include them when you've searched and found relevant GitHub discussions/issues/feature requests.`;

// Streaming analysis endpoint with extended thinking
app.post('/api/analyze-stream', async (req, res) => {
  const startTime = Date.now();

  return await Sentry.startSpan(
    {
      name: 'POST /api/analyze-stream',
      op: 'http.server',
      attributes: {
        'http.method': 'POST',
        'http.route': '/api/analyze-stream',
      }
    },
    async (span) => {
      try {
        const { configCode, issueContext, sdkType, model = 'sonnet-4', useExtendedThinking = false } = req.body;

        // Add request attributes
        span.setAttribute('api.sdk_type', sdkType);
        span.setAttribute('api.model', model);
        span.setAttribute('api.extended_thinking', useExtendedThinking);
        span.setAttribute('api.has_issue_context', !!issueContext);

        if (!configCode) {
          span.setStatus({ code: 2, message: 'Missing config code' });
          return res.status(400).json({ error: 'Configuration code is required' });
        }

    // Server-side security: mask any sensitive data that might have been missed
    const configMask = maskSensitiveData(configCode);
    const issueMask = issueContext ? maskSensitiveData(issueContext) : { maskedContent: issueContext };

    if (configMask.wasMasked || issueMask.wasMasked) {
      console.log('🔒 Server-side masking applied:', {
        config: configMask.detectedSecrets,
        issues: issueMask.detectedSecrets
      });
    }

    const maskedConfigCode = configMask.maskedContent;
    const maskedIssueContext = issueMask.maskedContent;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const userPrompt = `SDK Type: ${sdkType}

Configuration Code:
\`\`\`
${maskedConfigCode}
\`\`\`

Issues Reported by Customer:
${maskedIssueContext || 'No specific issues reported - general review requested'}

Analyze this Sentry configuration deeply and identify:
1. What's configured correctly
2. Problems that could cause the reported issues (be specific about how each problem relates to their issues)
3. Additional suggestions for optimization
4. Generate a complete fixed configuration with all corrections applied

Return ONLY valid JSON matching the specified structure. Do not include markdown code blocks or any other text.`;

    const stream = await client.messages.create({
      model: MODELS[model],
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      stream: true,
      ...(useExtendedThinking && { thinking: { type: 'enabled', budget_tokens: 10000 } })
    });

    let fullText = '';
    let thinkingContent = '';

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'thinking') {
          res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') {
          thinkingContent += event.delta.thinking;
          res.write(`data: ${JSON.stringify({ type: 'thinking', content: event.delta.thinking })}\n\n`);
        } else if (event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          // Stream progress indicator only, not the actual text (to avoid breaking JSON mid-string)
          res.write(`data: ${JSON.stringify({ type: 'progress', length: fullText.length })}\n\n`);
        }
      } else if (event.type === 'content_block_stop') {
        if (thinkingContent) {
          res.write(`data: ${JSON.stringify({ type: 'thinking_complete' })}\n\n`);
        }
      } else if (event.type === 'message_stop') {
        // Parse and validate JSON on server before sending to client
        try {
          let cleanedText = fullText.trim();

          // Remove markdown code blocks if present
          if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/s, '');
          } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/s, '');
          }

          // Extract JSON object
          const jsonStart = cleanedText.indexOf('{');
          const jsonEnd = cleanedText.lastIndexOf('}');

          if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
          }

          console.log('Attempting to parse JSON, length:', cleanedText.length);

          // Try to parse, if it fails, attempt repair
          let parsed;
          try {
            parsed = JSON.parse(cleanedText);
          } catch (firstError) {
            console.log('First parse failed, attempting repair...');
            const repairedText = attemptJSONRepair(cleanedText);
            console.log('Repaired text length:', repairedText.length);
            parsed = JSON.parse(repairedText); // This will throw if repair didn't work
          }

          console.log('Successfully parsed JSON');
          console.log('Sending result with fields:', Object.keys(parsed));

          // Send the validated, complete result
          // Use a safer approach - send it in chunks if needed
          const resultPayload = { type: 'complete', result: parsed };
          const resultString = JSON.stringify(resultPayload);

          console.log('Result payload size:', resultString.length);

          res.write(`data: ${resultString}\n\n`);
        } catch (parseError) {
          console.error('Server-side JSON parse error:', parseError);
          console.error('Error at position:', parseError.message.match(/position (\d+)/)?.[1]);
          console.error('Raw text length:', fullText.length);

          // Log context around the error
          const match = parseError.message.match(/position (\d+)/);
          if (match) {
            const pos = parseInt(match[1]);
            const start = Math.max(0, pos - 100);
            const end = Math.min(fullText.length, pos + 100);
            console.error('Context around error:', fullText.substring(start, end));
          }

          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: `Failed to parse response: ${parseError.message}`,
            rawText: fullText.substring(0, 1000) // Send first 1000 chars for debugging
          })}\n\n`);
        }
      }
    }

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setAttribute('api.response_length', fullText.length);
        span.setStatus({ code: 1, message: 'ok' });

        Sentry.metrics.distribution('api.analyze_stream.duration', duration, {
          unit: 'millisecond',
        });

        res.end();
      } catch (error) {
        console.error('Error in streaming analysis:', error);

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setStatus({ code: 2, message: error.message });
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            operation: 'api.analyze_stream',
            sdk_type: req.body.sdkType,
            model: req.body.model || 'sonnet-4',
            extended_thinking: req.body.useExtendedThinking || false,
          },
          contexts: {
            request: {
              has_issue_context: !!req.body.issueContext,
              config_length: req.body.configCode?.length || 0,
            }
          },
          fingerprint: ['api-analyze-stream-error', req.body.model]
        });

        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    }
  );
});

// Original non-streaming endpoint (kept for compatibility)
app.post('/api/analyze', async (req, res) => {
  const startTime = Date.now();

  return await Sentry.startSpan(
    {
      name: 'POST /api/analyze',
      op: 'http.server',
      attributes: {
        'http.method': 'POST',
        'http.route': '/api/analyze',
      }
    },
    async (span) => {
      try {
        const { configCode, issueContext, sdkType, model = 'sonnet-4', useExtendedThinking = false } = req.body;

        // Add request attributes
        span.setAttribute('api.sdk_type', sdkType);
        span.setAttribute('api.model', model);
        span.setAttribute('api.extended_thinking', useExtendedThinking);
        span.setAttribute('api.has_issue_context', !!issueContext);

        if (!configCode) {
          span.setStatus({ code: 2, message: 'Missing config code' });
          return res.status(400).json({ error: 'Configuration code is required' });
        }

    // Server-side security: mask any sensitive data that might have been missed
    const configMask = maskSensitiveData(configCode);
    const issueMask = issueContext ? maskSensitiveData(issueContext) : { maskedContent: issueContext };

    if (configMask.wasMasked || issueMask.wasMasked) {
      console.log('🔒 Server-side masking applied:', {
        config: configMask.detectedSecrets,
        issues: issueMask.detectedSecrets
      });
    }

    const maskedConfigCode = configMask.maskedContent;
    const maskedIssueContext = issueMask.maskedContent;

    const userPrompt = `SDK Type: ${sdkType}

Configuration Code:
\`\`\`
${maskedConfigCode}
\`\`\`

Issues Reported by Customer:
${maskedIssueContext || 'No specific issues reported - general review requested'}

Analyze this Sentry configuration deeply and identify:
1. What's configured correctly
2. Problems that could cause the reported issues (be specific about how each problem relates to their issues)
3. Additional suggestions for optimization
4. Generate a complete fixed configuration with all corrections applied

Return ONLY valid JSON matching the specified structure. Do not include markdown code blocks or any other text.`;

    const messageConfig = {
      model: MODELS[model],
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    };

    // Add extended thinking if requested
    if (useExtendedThinking) {
      messageConfig.thinking = { type: 'enabled', budget_tokens: 10000 };
    }

    const response = await client.messages.create(messageConfig);

    // Extract thinking content if present
    let thinkingContent = null;
    let textContent = null;

    for (const content of response.content) {
      if (content.type === 'thinking') {
        thinkingContent = content.thinking;
      } else if (content.type === 'text') {
        textContent = content.text;
      }
    }

    if (!textContent) {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    let jsonText = textContent.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const result = JSON.parse(jsonText);

    // Validate the structure
    if (!result.correctConfig || !result.problems || !result.suggestions) {
      throw new Error('Invalid response structure from Claude');
    }

        // Include thinking content if available
        if (thinkingContent) {
          result.thinking = thinkingContent;
        }

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setStatus({ code: 1, message: 'ok' });

        Sentry.metrics.distribution('api.analyze.duration', duration, {
          unit: 'millisecond',
        });

        res.json(result);
      } catch (error) {
        console.error('Error analyzing configuration:', error);

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setStatus({ code: 2, message: error.message });
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            operation: 'api.analyze',
            sdk_type: req.body.sdkType,
            model: req.body.model || 'sonnet-4',
            extended_thinking: req.body.useExtendedThinking || false,
          },
          contexts: {
            request: {
              has_issue_context: !!req.body.issueContext,
              config_length: req.body.configCode?.length || 0,
            }
          },
          fingerprint: ['api-analyze-error', req.body.model]
        });

        res.status(500).json({
          error: error.message || 'Failed to analyze configuration'
        });
      }
    }
  );
});

// Interactive chat endpoint for follow-up questions
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();

  return await Sentry.startSpan(
    {
      name: 'POST /api/chat',
      op: 'http.server',
      attributes: {
        'http.method': 'POST',
        'http.route': '/api/chat',
      }
    },
    async (span) => {
      try {
        const { messages, sdkType, configCode, model = 'sonnet-4' } = req.body;

        // Add request attributes
        span.setAttribute('api.sdk_type', sdkType);
        span.setAttribute('api.model', model);
        span.setAttribute('api.message_count', messages?.length || 0);

        if (!messages || messages.length === 0) {
          span.setStatus({ code: 2, message: 'Missing messages' });
          return res.status(400).json({ error: 'Messages are required' });
        }

    const systemPrompt = `You are a specialized Sentry troubleshooting expert with deep knowledge of Sentry's official documentation and SDK implementations. You're helping someone understand and fix their Sentry configuration through an interactive conversation.

SENTRY EXPERTISE:
- Deep knowledge of docs.sentry.io and official best practices
- Common Sentry issues: events not sending, ad-blockers, source maps, sample rates, etc.
- SDK-specific quirks and integration setup
- Performance monitoring concepts (transactions, spans, distributed tracing)
- Sentry-specific debugging techniques (debug mode, breadcrumbs, context)

Original SDK Type: ${sdkType}

Original Configuration:
\`\`\`
${configCode}
\`\`\`

CHAT GUIDELINES:
- Reference specific Sentry documentation and concepts
- Explain WHY issues happen in Sentry's context
- Suggest Sentry-specific features they may not know about
- Provide complete, runnable code examples
- Mention relevant Sentry UI features (Issues, Performance, Replays, etc.)
- Help them understand Sentry best practices, not just generic fixes

You are NOT a generic coding assistant - you are a Sentry specialist. Focus on Sentry-specific knowledge and troubleshooting.`;

    const response = await client.messages.create({
      model: MODELS[model],
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages
    });

        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from Claude');
        }

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setAttribute('api.response_length', content.text.length);
        span.setStatus({ code: 1, message: 'ok' });

        Sentry.metrics.distribution('api.chat.duration', duration, {
          unit: 'millisecond',
        });

        res.json({ response: content.text });
      } catch (error) {
        console.error('Error in chat:', error);

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setStatus({ code: 2, message: error.message });
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            operation: 'api.chat',
            sdk_type: req.body.sdkType,
            model: req.body.model || 'sonnet-4',
          },
          contexts: {
            request: {
              message_count: req.body.messages?.length || 0,
              config_length: req.body.configCode?.length || 0,
            }
          },
          fingerprint: ['api-chat-error', req.body.model]
        });

        res.status(500).json({
          error: error.message || 'Failed to process chat message'
        });
      }
    }
  );
});

// Generate complete fixed config endpoint
app.post('/api/generate-fixed-config', async (req, res) => {
  const startTime = Date.now();

  return await Sentry.startSpan(
    {
      name: 'POST /api/generate-fixed-config',
      op: 'http.server',
      attributes: {
        'http.method': 'POST',
        'http.route': '/api/generate-fixed-config',
      }
    },
    async (span) => {
      try {
        const { configCode, problems, sdkType, model = 'sonnet-4' } = req.body;

        // Add request attributes
        span.setAttribute('api.sdk_type', sdkType);
        span.setAttribute('api.model', model);
        span.setAttribute('api.problem_count', problems?.length || 0);

        if (!configCode) {
          span.setStatus({ code: 2, message: 'Missing config code' });
          return res.status(400).json({ error: 'Configuration code is required' });
        }

    const userPrompt = `SDK Type: ${sdkType}

Original Configuration:
\`\`\`
${configCode}
\`\`\`

Identified Problems:
${problems.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n')}

Generate a complete, production-ready Sentry.init() configuration that fixes all the identified problems. Include helpful comments explaining the changes. Return ONLY the code, no markdown formatting.`;

    const response = await client.messages.create({
      model: MODELS[model],
      max_tokens: 4096,
      system: 'You are a Sentry configuration expert. Generate clean, production-ready code with helpful comments.',
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

        let code = content.text.trim();

        // Remove markdown code blocks if present
        if (code.startsWith('```')) {
          code = code.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
        }

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setAttribute('api.response_length', code.length);
        span.setStatus({ code: 1, message: 'ok' });

        Sentry.metrics.distribution('api.generate_fixed_config.duration', duration, {
          unit: 'millisecond',
        });

        res.json({ fixedConfig: code });
      } catch (error) {
        console.error('Error generating fixed config:', error);

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setStatus({ code: 2, message: error.message });
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            operation: 'api.generate_fixed_config',
            sdk_type: req.body.sdkType,
            model: req.body.model || 'sonnet-4',
          },
          contexts: {
            request: {
              problem_count: req.body.problems?.length || 0,
              config_length: req.body.configCode?.length || 0,
            }
          },
          fingerprint: ['api-generate-fixed-config-error', req.body.model]
        });

        res.status(500).json({
          error: error.message || 'Failed to generate fixed configuration'
        });
      }
    }
  );
});

// General Sentry Q&A endpoint (no config required)
app.post('/api/general-query', async (req, res) => {
  const startTime = Date.now();

  return await Sentry.startSpan(
    {
      name: 'POST /api/general-query',
      op: 'http.server',
      attributes: {
        'http.method': 'POST',
        'http.route': '/api/general-query',
      }
    },
    async (span) => {
      try {
        const { question, sdkType, model = 'sonnet-4', useExtendedThinking = false } = req.body;

        // Add request attributes
        span.setAttribute('api.sdk_type', sdkType || 'general');
        span.setAttribute('api.model', model);
        span.setAttribute('api.extended_thinking', useExtendedThinking);
        span.setAttribute('api.question_length', question?.length || 0);

        if (!question || !question.trim()) {
          span.setStatus({ code: 2, message: 'Missing question' });
          return res.status(400).json({ error: 'Question is required' });
        }

        const generalSystemPrompt = `You are an expert Sentry troubleshooting specialist with comprehensive knowledge of Sentry's official documentation, SDK implementations, and best practices.

EXPERTISE AREAS:
- All Sentry SDK configurations (JavaScript, Python, Ruby, PHP, Java, Go, .NET, React Native, etc.)
- Error tracking, performance monitoring, session replay, profiling
- Integration setup and troubleshooting
- Common issues: events not sending, source maps, sample rates, ad-blocker bypass
- Best practices for production deployments
- SDK-specific quirks and version-specific features
- Sentry product features and limitations

GITHUB KNOWLEDGE:
You have access to Sentry's GitHub repositories and can reference:
- Known issues and their solutions
- Feature requests and roadmap items
- SDK-specific bugs and workarounds
- Community discussions and resolutions

RESPONSE FORMAT:
- Provide clear, actionable answers based on Sentry documentation
- Include code examples when relevant
- Reference specific Sentry concepts and features
- Link to GitHub issues/discussions when applicable (format: "📌 [Title](URL)")
- Suggest related features or best practices the user may not know about

Answer the user's Sentry question with specific, practical guidance.`;

        // Set up SSE for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const userPrompt = sdkType
          ? `SDK Context: ${sdkType}\n\nQuestion: ${question}`
          : `Question: ${question}`;

        const stream = await client.messages.create({
          model: MODELS[model],
          max_tokens: 8000,
          system: generalSystemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt
            }
          ],
          stream: true,
          ...(useExtendedThinking && { thinking: { type: 'enabled', budget_tokens: 10000 } })
        });

        let fullText = '';
        let thinkingContent = '';

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'thinking') {
              res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'thinking_delta') {
              thinkingContent += event.delta.thinking;
              res.write(`data: ${JSON.stringify({ type: 'thinking', content: event.delta.thinking })}\n\n`);
            } else if (event.delta.type === 'text_delta') {
              fullText += event.delta.text;
              // Stream the text in real-time for general queries
              res.write(`data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`);
            }
          } else if (event.type === 'content_block_stop') {
            if (thinkingContent) {
              res.write(`data: ${JSON.stringify({ type: 'thinking_complete' })}\n\n`);
            }
          } else if (event.type === 'message_stop') {
            res.write(`data: ${JSON.stringify({ type: 'complete', answer: fullText })}\n\n`);
          }
        }

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setAttribute('api.response_length', fullText.length);
        span.setStatus({ code: 1, message: 'ok' });

        Sentry.metrics.distribution('api.general_query.duration', duration, {
          unit: 'millisecond',
        });

        res.end();
      } catch (error) {
        console.error('Error in general query:', error);

        const duration = Date.now() - startTime;
        span.setAttribute('api.duration_ms', duration);
        span.setStatus({ code: 2, message: error.message });
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            operation: 'api.general_query',
            sdk_type: req.body.sdkType || 'general',
            model: req.body.model || 'sonnet-4',
            extended_thinking: req.body.useExtendedThinking || false,
          },
          contexts: {
            request: {
              question_length: req.body.question?.length || 0,
            }
          },
          fingerprint: ['api-general-query-error', req.body.model]
        });

        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    }
  );
});

// Sentry error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Optional fallback error handler
app.use(function onError(err, req, res, next) {
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

app.listen(PORT, () => {
  console.log(`🚀 Config Analyzer API running on http://localhost:${PORT}`);
});
