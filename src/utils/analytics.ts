import * as Sentry from '@sentry/react';

/**
 * Analytics helper for tracking user behavior and product insights
 */

export interface QueryAnalytics {
  mode: 'config' | 'general';
  sdkType?: string;
  model: 'sonnet-4' | 'opus-4.5';
  extendedThinking: boolean;
  hasIssueContext?: boolean;
  conversationLength?: number; // For follow-up questions
}

export interface OutcomeAnalytics {
  action: 'copy_answer' | 'download_pdf' | 'new_conversation' | 'mode_switch';
  mode: 'config' | 'general';
  conversationLength?: number;
}

export interface ComplexityAnalytics {
  requiresHumanReview: boolean;
  reason?: string;
  problemCount: number;
  sdkType?: string;
}

export interface PerformanceAnalytics {
  operation: string;
  duration: number;
  model: string;
  tokenCount?: number;
  thinkingTokens?: number;
}

/**
 * Track when a query is submitted
 */
export function trackQuerySubmitted(data: QueryAnalytics) {
  // Capture as Sentry event for searchability
  Sentry.captureEvent({
    message: 'Query Submitted',
    level: 'info',
    tags: {
      mode: data.mode,
      sdk_type: data.sdkType || 'none',
      model: data.model,
      extended_thinking: data.extendedThinking,
    },
    contexts: {
      query: {
        mode: data.mode,
        sdk_type: data.sdkType,
        model: data.model,
        extended_thinking: data.extendedThinking,
        has_issue_context: data.hasIssueContext,
        conversation_length: data.conversationLength || 0,
        is_follow_up: (data.conversationLength || 0) > 1,
      }
    }
  });

  // Increment metrics for time-series analysis
  Sentry.metrics.increment('copilot.query.submitted', 1, {
    tags: {
      mode: data.mode,
      sdk_type: data.sdkType || 'none',
      model: data.model,
      extended_thinking: data.extendedThinking.toString(),
    }
  });

  // Track follow-up questions separately
  if (data.conversationLength && data.conversationLength > 1) {
    Sentry.metrics.increment('copilot.query.follow_up', 1, {
      tags: {
        mode: data.mode,
        conversation_depth: data.conversationLength.toString(),
      }
    });
  }
}

/**
 * Track query completion with performance data
 */
export function trackQueryCompleted(data: PerformanceAnalytics) {
  Sentry.metrics.distribution('copilot.query.duration', data.duration, {
    unit: 'millisecond',
    tags: {
      operation: data.operation,
      model: data.model,
    }
  });

  if (data.thinkingTokens) {
    Sentry.metrics.distribution('copilot.thinking.tokens', data.thinkingTokens, {
      unit: 'none',
      tags: {
        model: data.model,
      }
    });
  }

  // Track cost-relevant metrics
  Sentry.captureEvent({
    message: 'Query Completed',
    level: 'info',
    tags: {
      operation: data.operation,
      model: data.model,
    },
    contexts: {
      performance: {
        duration_ms: data.duration,
        thinking_tokens: data.thinkingTokens,
        response_tokens: data.tokenCount,
      }
    }
  });
}

/**
 * Track user outcomes/engagement
 */
export function trackOutcome(data: OutcomeAnalytics) {
  Sentry.metrics.increment(`copilot.outcome.${data.action}`, 1, {
    tags: {
      mode: data.mode,
    }
  });

  // For conversation tracking
  if (data.action === 'new_conversation' && data.conversationLength) {
    Sentry.metrics.distribution('copilot.conversation.length', data.conversationLength, {
      unit: 'none',
      tags: {
        mode: data.mode,
      }
    });

    Sentry.captureEvent({
      message: 'Conversation Ended',
      level: 'info',
      tags: {
        mode: data.mode,
      },
      contexts: {
        conversation: {
          length: data.conversationLength,
          mode: data.mode,
        }
      }
    });
  }

  // High-intent actions
  if (data.action === 'download_pdf') {
    Sentry.captureEvent({
      message: 'PDF Downloaded',
      level: 'info',
      tags: {
        mode: data.mode,
      },
      contexts: {
        engagement: {
          action: 'download_pdf',
          high_intent: true,
        }
      }
    });
  }
}

/**
 * Track complexity assessments (product insights)
 */
export function trackComplexityAssessment(data: ComplexityAnalytics) {
  if (data.requiresHumanReview) {
    // Important product signal - configuration was too complex
    Sentry.captureEvent({
      message: 'Complex Configuration Detected',
      level: 'warning',
      tags: {
        sdk_type: data.sdkType || 'unknown',
        problem_count: data.problemCount.toString(),
      },
      contexts: {
        complexity: {
          requires_human_review: true,
          reason: data.reason,
          problem_count: data.problemCount,
          sdk_type: data.sdkType,
        }
      }
    });

    Sentry.metrics.increment('copilot.complexity.human_review_needed', 1, {
      tags: {
        sdk_type: data.sdkType || 'unknown',
      }
    });
  }
}

/**
 * Track common Sentry issues found (product insights gold mine)
 */
export function trackIssuesFound(problems: Array<{ title: string; severity?: string }>, sdkType?: string) {
  // Track each problem type for trend analysis
  problems.forEach(problem => {
    // Sanitize title to avoid PII while keeping useful info
    const sanitizedTitle = problem.title
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/["'].*?["']/g, '""') // Replace quoted strings
      .toLowerCase();

    Sentry.metrics.increment('copilot.issue.found', 1, {
      tags: {
        sdk_type: sdkType || 'unknown',
        severity: problem.severity || 'unknown',
        issue_type: sanitizedTitle.slice(0, 50), // Truncate for cardinality
      }
    });
  });

  // Summary event
  Sentry.captureEvent({
    message: 'Configuration Issues Identified',
    level: 'info',
    tags: {
      sdk_type: sdkType || 'unknown',
      issue_count: problems.length.toString(),
    },
    contexts: {
      issues: {
        count: problems.length,
        severities: problems.map(p => p.severity || 'unknown'),
        sdk_type: sdkType,
      }
    }
  });
}

/**
 * Track mode switching patterns
 */
export function trackModeSwitch(from: 'config' | 'general', to: 'config' | 'general') {
  Sentry.metrics.increment('copilot.mode.switch', 1, {
    tags: {
      from,
      to,
    }
  });

  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Switched from ${from} to ${to} mode`,
    level: 'info',
  });
}

/**
 * Track SDK type usage patterns
 */
export function trackSDKSelection(sdkType: string, mode: 'config' | 'general') {
  Sentry.metrics.increment('copilot.sdk.selected', 1, {
    tags: {
      sdk_type: sdkType,
      mode,
    }
  });
}

/**
 * Track errors in queries (for reliability monitoring)
 */
export function trackQueryError(error: Error, context: { mode: string; model: string; sdkType?: string }) {
  Sentry.captureException(error, {
    tags: {
      error_type: 'query_error',
      mode: context.mode,
      model: context.model,
      sdk_type: context.sdkType || 'unknown',
    },
    level: 'error',
  });

  Sentry.metrics.increment('copilot.query.error', 1, {
    tags: {
      mode: context.mode,
      model: context.model,
    }
  });
}
