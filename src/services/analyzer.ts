export interface GitHubIssue {
  url: string;
  title: string;
  status: 'open' | 'closed';
  description: string;
}

export interface RelatedResource {
  type: 'github_issue' | 'github_discussion' | 'feature_request';
  title: string;
  url: string;
  description: string;
}

export interface AnalysisResult {
  correctConfig: string[];
  problems: Array<{
    title: string;
    description: string;
    fix: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    githubIssue?: GitHubIssue;
  }>;
  suggestions: Array<{
    title: string;
    description: string;
    code?: string;
    githubIssue?: GitHubIssue;
  }>;
  relatedResources?: RelatedResource[];
  completeFixedConfig?: string;
  thinking?: string;
  recommendations?: string;
  complexityAssessment?: {
    requiresHumanReview: boolean;
    reason?: string;
    recommendedAction?: string;
  };
}

const API_URL = 'http://localhost:3001';

export async function analyzeConfig(
  configCode: string,
  issueContext: string,
  sdkType: string
): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        configCode,
        issueContext,
        sdkType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze configuration');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling analysis API:', error);
    throw error;
  }
}
