#!/usr/bin/env node

/**
 * Create Sentry Copilot Analytics Dashboard
 *
 * This script creates a comprehensive dashboard in Sentry to visualize
 * all the metrics tracked by Sentry Copilot.
 */

import dotenv from 'dotenv';
dotenv.config();

const SENTRY_ORG = 'anthony-test-org';
const SENTRY_PROJECT = 'config-analyzer';
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

if (!SENTRY_AUTH_TOKEN) {
  console.error('❌ SENTRY_AUTH_TOKEN not found in .env');
  process.exit(1);
}

const API_BASE = `https://sentry.io/api/0`;

async function createDashboard() {
  console.log('🚀 Creating Sentry Copilot Analytics Dashboard...\n');

  const dashboard = {
    title: '📊 Sentry Copilot Analytics',
    widgets: [
      // Row 1: Overview Metrics
      {
        title: 'Total Queries (24h)',
        displayType: 'big_number',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:"Query Submitted"',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 0, w: 2, h: 2, minH: 2 }
      },
      {
        title: 'Config Analysis vs General Q&A',
        displayType: 'table',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['tags[mode]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:Query Submitted',
            orderby: '-count()',
            columns: ['tags[mode]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 2, y: 0, w: 2, h: 2, minH: 2 }
      },
      {
        title: 'Engagement Rate (Copies + PDFs)',
        displayType: 'big_number',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:["PDF Downloaded" OR "Copy Answer"]',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 4, y: 0, w: 2, h: 2, minH: 2 }
      },

      // Row 2: Performance Metrics
      {
        title: 'Response Time (p50, p95, p99)',
        displayType: 'line',
        interval: '5m',
        queries: [
          {
            name: 'p50',
            fields: ['p50(contexts.performance.duration_ms)'],
            aggregates: ['p50(contexts.performance.duration_ms)'],
            conditions: 'message:Query Completed',
            orderby: '',
          },
          {
            name: 'p95',
            fields: ['p95(contexts.performance.duration_ms)'],
            aggregates: ['p95(contexts.performance.duration_ms)'],
            conditions: 'message:Query Completed',
            orderby: '',
          },
          {
            name: 'p99',
            fields: ['p99(contexts.performance.duration_ms)'],
            aggregates: ['p99(contexts.performance.duration_ms)'],
            conditions: 'message:Query Completed',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 2, w: 3, h: 2, minH: 2 }
      },
      {
        title: 'Queries by Model',
        displayType: 'bar',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['tags[model]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:Query Submitted',
            orderby: '-count()',
            columns: ['tags[model]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 3, y: 2, w: 3, h: 2, minH: 2 }
      },

      // Row 3: SDK & Issue Insights
      {
        title: 'Top 10 SDKs by Query Volume',
        displayType: 'table',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['tags[sdk_type]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:Query Submitted',
            orderby: '-count()',
            columns: ['tags[sdk_type]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 4, w: 3, h: 3, minH: 2 }
      },
      {
        title: 'Issues by Severity',
        displayType: 'bar',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['contexts.issues.severities', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:"Configuration Issues Identified"',
            orderby: '-count()',
            columns: ['contexts.issues.severities']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 3, y: 4, w: 3, h: 3, minH: 2 }
      },

      // Row 4: Conversation Analytics
      {
        title: 'Follow-up Question Rate',
        displayType: 'line',
        interval: '5m',
        queries: [
          {
            name: 'Follow-ups',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:Query Submitted contexts.query.is_follow_up:true',
            orderby: '',
          },
          {
            name: 'All Queries',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:Query Submitted',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 7, w: 3, h: 2, minH: 2 }
      },
      {
        title: 'Average Conversation Length',
        displayType: 'big_number',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['avg(contexts.conversation.length)'],
            aggregates: ['avg(contexts.conversation.length)'],
            conditions: 'message:"Conversation Ended"',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 3, y: 7, w: 1, h: 2, minH: 2 }
      },
      {
        title: 'Extended Thinking Adoption',
        displayType: 'table',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['tags[extended_thinking]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:Query Submitted',
            orderby: '-count()',
            columns: ['tags[extended_thinking]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 4, y: 7, w: 2, h: 2, minH: 2 }
      },

      // Row 5: Product Insights (GOLD MINE)
      {
        title: 'Most Common Issues (by type)',
        displayType: 'table',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['tags[issue_type]', 'tags[sdk_type]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:"Configuration Issues Identified"',
            orderby: '-count()',
            columns: ['tags[issue_type]', 'tags[sdk_type]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 9, w: 4, h: 3, minH: 2 }
      },
      {
        title: 'Complexity Rate (Human Review Needed)',
        displayType: 'line',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:"Complex Configuration Detected"',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 4, y: 9, w: 2, h: 3, minH: 2 }
      },

      // Row 6: Reliability
      {
        title: 'Error Rate',
        displayType: 'line',
        interval: '5m',
        queries: [
          {
            name: 'Errors',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'level:error tags[error_type]:query_error',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 12, w: 3, h: 2, minH: 2 }
      },
      {
        title: 'Errors by Mode',
        displayType: 'bar',
        interval: '5m',
        queries: [
          {
            name: '',
            fields: ['tags[mode]', 'count()'],
            aggregates: ['count()'],
            conditions: 'level:error tags[error_type]:query_error',
            orderby: '-count()',
            columns: ['tags[mode]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 3, y: 12, w: 3, h: 2, minH: 2 }
      }
    ]
  };

  try {
    const response = await fetch(
      `${API_BASE}/organizations/${SENTRY_ORG}/dashboards/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dashboard)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create dashboard: ${response.status} - ${error}`);
    }

    const result = await response.json();

    console.log('✅ Dashboard created successfully!');
    console.log(`📊 Dashboard ID: ${result.id}`);
    console.log(`🔗 View at: https://sentry.io/organizations/${SENTRY_ORG}/dashboards/${result.id}/`);
    console.log('\n🎉 Your analytics dashboard is ready!\n');

  } catch (error) {
    console.error('❌ Error creating dashboard:', error.message);
    process.exit(1);
  }
}

createDashboard();
