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

const SYSTEM_PROMPT = `You are a Sentry configuration expert. Analyze Sentry SDK initialization code and identify:
1. What's configured correctly
2. Configuration problems that explain the reported issues
3. Additional optimization suggestions
4. Whether this case requires human expert review

Always provide specific code fixes in the same language/format as the input.

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
      "severity": "low|medium|high|critical"
    }
  ],
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "Why this would be beneficial"
    }
  ],
  "completeFixedConfig": "Complete corrected Sentry.init() configuration with all fixes applied",
  "complexityAssessment": {
    "requiresHumanReview": true/false,
    "reason": "Brief explanation of why human review is needed (only if requiresHumanReview is true)",
    "recommendedAction": "Specific guidance (e.g., 'Contact Sentry support', 'Consult with your team's senior engineer', 'Schedule architecture review')"
  }
}`;

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
        Sentry.captureException(error);

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
        Sentry.captureException(error);

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

    const systemPrompt = `You are a Sentry configuration expert. You're in a conversation helping someone understand and fix their Sentry configuration.

Original SDK Type: ${sdkType}

Original Configuration:
\`\`\`
${configCode}
\`\`\`

Provide clear, helpful answers to their questions about Sentry configuration. When suggesting code changes, provide complete, runnable examples.`;

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
        Sentry.captureException(error);

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
        Sentry.captureException(error);

        res.status(500).json({
          error: error.message || 'Failed to generate fixed configuration'
        });
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
