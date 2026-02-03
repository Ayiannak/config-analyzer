import Anthropic from '@anthropic-ai/sdk';

export interface AnalysisResult {
  correctConfig: string[];
  problems: Array<{ title: string; description: string; fix: string }>;
  suggestions: Array<{ title: string; description: string }>;
}

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
  ]
}`;

export async function analyzeConfig(
  configCode: string,
  issueContext: string,
  sdkType: string
): Promise<AnalysisResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true // For demo purposes only
  });

  const userPrompt = `SDK Type: ${sdkType}

Configuration Code:
\`\`\`
${configCode}
\`\`\`

Issues Reported by Customer:
${issueContext || 'No specific issues reported - general review requested'}

Analyze this Sentry configuration and identify:
1. What's configured correctly
2. Problems that could cause the reported issues (be specific about how each problem relates to their issues)
3. Additional suggestions for optimization

Return ONLY valid JSON matching the specified structure. Do not include markdown code blocks or any other text.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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

    // Parse the JSON response
    let jsonText = content.text.trim();

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

    return result;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}
