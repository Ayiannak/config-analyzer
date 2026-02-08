#!/usr/bin/env node

/**
 * Create Sentry Copilot Analytics Dashboard (Simplified)
 *
 * Creates a basic dashboard that can be expanded via the Sentry UI
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
      // Total Queries
      {
        title: 'Total Queries (Last 24h)',
        displayType: 'big_number',
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

      // Queries by Mode
      {
        title: 'Queries by Mode',
        displayType: 'table',
        limit: 10,
        queries: [
          {
            name: '',
            fields: ['tags[mode]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:"Query Submitted"',
            orderby: '-count()',
            columns: ['tags[mode]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 2, y: 0, w: 2, h: 2, minH: 2 }
      },

      // Engagement
      {
        title: 'High-Intent Actions (PDFs + Copies)',
        displayType: 'big_number',
        queries: [
          {
            name: '',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:"PDF Downloaded"',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 4, y: 0, w: 2, h: 2, minH: 2 }
      },

      // Queries Over Time
      {
        title: 'Queries Over Time',
        displayType: 'line',
        queries: [
          {
            name: 'Queries',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:"Query Submitted"',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 2, w: 3, h: 2, minH: 2 }
      },

      // Queries by Model
      {
        title: 'Queries by Model',
        displayType: 'bar',
        limit: 10,
        queries: [
          {
            name: '',
            fields: ['tags[model]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:"Query Submitted"',
            orderby: '-count()',
            columns: ['tags[model]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 3, y: 2, w: 3, h: 2, minH: 2 }
      },

      // Top SDKs
      {
        title: 'Top SDKs by Query Volume',
        displayType: 'table',
        limit: 10,
        queries: [
          {
            name: '',
            fields: ['tags[sdk_type]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:"Query Submitted"',
            orderby: '-count()',
            columns: ['tags[sdk_type]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 4, w: 3, h: 3, minH: 2 }
      },

      // Issues Found
      {
        title: 'Configuration Issues Identified',
        displayType: 'line',
        queries: [
          {
            name: 'Issues',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:"Configuration Issues Identified"',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 3, y: 4, w: 3, h: 3, minH: 2 }
      },

      // Follow-up Questions
      {
        title: 'Follow-up Question Trend',
        displayType: 'line',
        queries: [
          {
            name: 'Follow-ups',
            fields: ['count()'],
            aggregates: ['count()'],
            conditions: 'message:"Query Submitted" contexts.query.is_follow_up:true',
            orderby: '',
          }
        ],
        widgetType: 'error-events',
        layout: { x: 0, y: 7, w: 3, h: 2, minH: 2 }
      },

      // Complex Configs
      {
        title: 'Complex Configurations Detected',
        displayType: 'big_number',
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
        layout: { x: 3, y: 7, w: 1, h: 2, minH: 2 }
      },

      // Extended Thinking Usage
      {
        title: 'Extended Thinking Usage',
        displayType: 'table',
        limit: 10,
        queries: [
          {
            name: '',
            fields: ['tags[extended_thinking]', 'count()'],
            aggregates: ['count()'],
            conditions: 'message:"Query Submitted"',
            orderby: '-count()',
            columns: ['tags[extended_thinking]']
          }
        ],
        widgetType: 'error-events',
        layout: { x: 4, y: 7, w: 2, h: 2, minH: 2 }
      },

      // Error Rate
      {
        title: 'Query Errors',
        displayType: 'line',
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
        layout: { x: 0, y: 9, w: 3, h: 2, minH: 2 }
      },

      // Errors by Mode
      {
        title: 'Errors by Mode',
        displayType: 'table',
        limit: 10,
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
        layout: { x: 3, y: 9, w: 3, h: 2, minH: 2 }
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
    console.log(`🔗 View at: https://anthony-test-org.sentry.io/dashboards/${result.id}/`);
    console.log('\n🎉 Your analytics dashboard is ready!\n');
    console.log('💡 You can add more widgets and customize it from the Sentry UI.\n');

  } catch (error) {
    console.error('❌ Error creating dashboard:', error.message);
    process.exit(1);
  }
}

createDashboard();
