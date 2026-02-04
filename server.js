import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { maskSensitiveData } from './server-security.js';

dotenv.config();

const app = express();
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

const SYSTEM_PROMPT = `You are a Sentry configuration expert. Analyze Sentry SDK initialization code and identify:
1. What's configured correctly
2. Configuration problems that explain the reported issues
3. Additional optimization suggestions

Always provide specific code fixes in the same language/format as the input.

Return your analysis as a JSON object with this structure:
{
  "correctConfig": ["array of strings describing what's working"],
  "problems": [
    {
      "title": "Short problem title",
      "description": "Detailed explanation of why this is a problem and how it relates to reported issues",
      "fix": "Exact code snippet showing the fix"
    }
  ],
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "Why this would be beneficial"
    }
  ],
  "completeFixedConfig": "Complete corrected Sentry.init() configuration with all fixes applied"
}`;

// Streaming analysis endpoint with extended thinking
app.post('/api/analyze-stream', async (req, res) => {
  try {
    const { configCode, issueContext, sdkType, model = 'sonnet-4', useExtendedThinking = false } = req.body;

    if (!configCode) {
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

          // Validate it's valid JSON
          const parsed = JSON.parse(cleanedText);

          // Send the validated, complete result
          res.write(`data: ${JSON.stringify({ type: 'complete', result: parsed })}\n\n`);
        } catch (parseError) {
          console.error('Server-side JSON parse error:', parseError);
          console.error('Raw text length:', fullText.length);
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: `Failed to parse response: ${parseError.message}`,
            rawText: fullText.substring(0, 1000) // Send first 1000 chars for debugging
          })}\n\n`);
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Error in streaming analysis:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Original non-streaming endpoint (kept for compatibility)
app.post('/api/analyze', async (req, res) => {
  try {
    const { configCode, issueContext, sdkType, model = 'sonnet-4', useExtendedThinking = false } = req.body;

    if (!configCode) {
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

    res.json(result);
  } catch (error) {
    console.error('Error analyzing configuration:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze configuration'
    });
  }
});

// Interactive chat endpoint for follow-up questions
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, sdkType, configCode, model = 'sonnet-4' } = req.body;

    if (!messages || messages.length === 0) {
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

    res.json({ response: content.text });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      error: error.message || 'Failed to process chat message'
    });
  }
});

// Generate complete fixed config endpoint
app.post('/api/generate-fixed-config', async (req, res) => {
  try {
    const { configCode, problems, sdkType, model = 'sonnet-4' } = req.body;

    if (!configCode) {
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

    res.json({ fixedConfig: code });
  } catch (error) {
    console.error('Error generating fixed config:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate fixed configuration'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Config Analyzer API running on http://localhost:${PORT}`);
});
