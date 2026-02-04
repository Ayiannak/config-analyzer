import type { AnalysisResult } from './analyzer';

const API_URL = 'http://localhost:3001';

export interface EnhancedAnalysisOptions {
  configCode: string;
  issueContext: string;
  sdkType: string;
  model?: 'sonnet-4' | 'opus-4.5';
  useExtendedThinking?: boolean;
  useStreaming?: boolean;
}

export interface StreamEvent {
  type: 'thinking' | 'thinking_start' | 'thinking_complete' | 'progress' | 'complete' | 'error';
  content?: string;
  length?: number;
  result?: any;
  error?: string;
  rawText?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Streaming analysis with real-time updates
export async function analyzeConfigStreaming(
  options: EnhancedAnalysisOptions,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const response = await fetch(`${API_URL}/api/analyze-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error('Failed to start streaming analysis');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('Response body is not readable');
  }

  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append new chunk to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete events (ending with \n\n)
      const events = buffer.split('\n\n');

      // Keep the last incomplete event in the buffer
      buffer = events.pop() || '';

      for (const event of events) {
        if (event.startsWith('data: ')) {
          const data = event.slice(6).trim();
          if (data) {
            try {
              const parsedEvent = JSON.parse(data) as StreamEvent;
              onEvent(parsedEvent);
            } catch (e) {
              console.error('Failed to parse event:', data.substring(0, 100));
            }
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim() && buffer.startsWith('data: ')) {
      const data = buffer.slice(6).trim();
      try {
        const parsedEvent = JSON.parse(data) as StreamEvent;
        onEvent(parsedEvent);
      } catch (e) {
        console.error('Failed to parse final event:', data.substring(0, 100));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Enhanced non-streaming analysis
export async function analyzeConfigEnhanced(
  options: EnhancedAnalysisOptions
): Promise<AnalysisResult & { thinking?: string }> {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to analyze configuration');
  }

  return await response.json();
}

// Chat with Claude about the config
export async function chatAboutConfig(
  messages: ChatMessage[],
  sdkType: string,
  configCode: string,
  model: 'sonnet-4' | 'opus-4.5' = 'sonnet-4'
): Promise<string> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      sdkType,
      configCode,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send chat message');
  }

  const data = await response.json();
  return data.response;
}

// Generate complete fixed configuration
export async function generateFixedConfig(
  configCode: string,
  problems: Array<{ title: string; description: string }>,
  sdkType: string,
  model: 'sonnet-4' | 'opus-4.5' = 'sonnet-4'
): Promise<string> {
  const response = await fetch(`${API_URL}/api/generate-fixed-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      configCode,
      problems,
      sdkType,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate fixed configuration');
  }

  const data = await response.json();
  return data.fixedConfig;
}
