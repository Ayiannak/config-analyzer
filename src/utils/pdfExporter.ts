import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult } from '../services/analyzer';

interface ExportOptions {
  result: AnalysisResult;
  sdkType: string;
  fixedConfig?: string;
  model: string;
  originalConfig?: string;
}

// Syntax highlighting helper
interface CodeToken {
  text: string;
  color: number[];
}

function highlightCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];

  // Colors for syntax highlighting
  const colors = {
    keyword: [147, 51, 234],    // Purple
    string: [34, 197, 94],       // Green
    comment: [107, 114, 128],    // Gray
    number: [59, 130, 246],      // Blue
    property: [236, 72, 153],    // Pink
    default: [31, 41, 55]        // Dark gray
  };

  // Common JavaScript/C# keywords
  const keywords = new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'new', 'this', 'class', 'import', 'export', 'from', 'async', 'await',
    'try', 'catch', 'throw', 'true', 'false', 'null', 'undefined',
    'public', 'private', 'static', 'void', 'using', 'namespace'
  ]);

  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if entire line is a comment
    if (line.trim().startsWith('//')) {
      tokens.push({ text: line, color: colors.comment });
      if (i < lines.length - 1) tokens.push({ text: '\n', color: colors.default });
      continue;
    }

    // Split line into words and special characters
    const parts = line.split(/(\s+|[{}()[\];,.:=+\-*/<>!&|])/);

    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];
      if (!part) continue;

      // Check for comments
      if (part.startsWith('//')) {
        tokens.push({ text: part, color: colors.comment });
        continue;
      }

      // Check for strings
      if (part.match(/^["'`].*["'`]$/)) {
        tokens.push({ text: part, color: colors.string });
        continue;
      }

      // Check for numbers
      if (part.match(/^\d+(\.\d+)?$/)) {
        tokens.push({ text: part, color: colors.number });
        continue;
      }

      // Check for keywords
      if (keywords.has(part)) {
        tokens.push({ text: part, color: colors.keyword });
        continue;
      }

      // Check for properties (word followed by colon)
      if (part.match(/^\w+$/)) {
        if (partIndex < parts.length - 1) {
          const nextNonWhitespace = parts.slice(partIndex + 1).find(p => p.trim());
          if (nextNonWhitespace === ':' || nextNonWhitespace === '.') {
            tokens.push({ text: part, color: colors.property });
            continue;
          }
        }
      }

      // Default color
      tokens.push({ text: part, color: colors.default });
    }

    if (i < lines.length - 1) {
      tokens.push({ text: '\n', color: colors.default });
    }
  }

  return tokens;
}

// Helper function to render syntax-highlighted code
function renderHighlightedCode(
  doc: jsPDF,
  code: string,
  startX: number,
  startY: number,
  maxWidth: number
): number {
  const tokens = highlightCode(code);
  let x = startX;
  let y = startY;
  const lineHeight = 7;
  const rightBoundary = startX + maxWidth;

  for (const token of tokens) {
    if (token.text === '\n') {
      x = startX;
      y += lineHeight;
      continue;
    }

    doc.setTextColor(...token.color);
    const textWidth = doc.getTextWidth(token.text);

    // If this token would exceed the boundary
    if (x + textWidth > rightBoundary) {
      // If we're not at the start of a line, wrap to next line
      if (x > startX) {
        x = startX;
        y += lineHeight;
      }

      // If the token itself is too long for one line, split it
      if (textWidth > maxWidth) {
        const chars = token.text.split('');
        let tempText = '';

        for (const char of chars) {
          const charWidth = doc.getTextWidth(char);

          if (x + doc.getTextWidth(tempText + char) > rightBoundary) {
            // Render what we have so far
            if (tempText) {
              doc.text(tempText, x, y);
            }
            // Move to next line
            x = startX;
            y += lineHeight;
            tempText = char;
          } else {
            tempText += char;
          }
        }

        // Render remaining text
        if (tempText) {
          doc.text(tempText, x, y);
          x += doc.getTextWidth(tempText);
        }
        continue;
      }
    }

    // Normal rendering
    doc.text(token.text, x, y);
    x += textWidth;
  }

  return y - startY + lineHeight;
}

// Helper function to extract relevant code snippet from original config
function extractRelevantCode(originalConfig: string, problem: any): string {
  if (!originalConfig) {
    return `// Original configuration not available\n// Issue: ${problem.title}`;
  }

  const lines = originalConfig.split('\n');

  // Extract key terms from the problem title to search for
  const searchTerms = [
    problem.title.toLowerCase(),
    ...problem.title.split(/\s+/).filter(word => word.length > 3).map(w => w.toLowerCase())
  ];

  // Common configuration keywords that might be in the problem
  const configKeywords = [
    'tracesSampleRate', 'replaysSessionSampleRate', 'replaysOnErrorSampleRate',
    'integrations', 'beforeSend', 'beforeBreadcrumb', 'transport', 'dsn',
    'environment', 'release', 'debug', 'attachStacktrace', 'sampleRate',
    'normalizeDepth', 'maxBreadcrumbs', 'maxValueLength'
  ];

  // Find relevant lines in the original config
  const relevantLines: string[] = [];
  let foundRelevantSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Check if this line matches any search terms or config keywords
    const isRelevant = searchTerms.some(term => lowerLine.includes(term)) ||
                       configKeywords.some(keyword => lowerLine.includes(keyword.toLowerCase()));

    if (isRelevant) {
      foundRelevantSection = true;
      // Add some context (previous and next lines)
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 2);

      for (let j = start; j < end; j++) {
        if (!relevantLines.includes(lines[j])) {
          relevantLines.push(lines[j]);
        }
      }
    }
  }

  if (relevantLines.length > 0) {
    return relevantLines.slice(0, 8).join('\n'); // Limit to 8 lines
  }

  // If no specific match, return a snippet from the config with the problem noted
  const snippet = lines.slice(0, 5).join('\n');
  return `${snippet}\n...\n// Issue relates to: ${problem.title}`;
}

export function exportToPDF(options: ExportOptions) {
  const { result, sdkType, fixedConfig, model, originalConfig } = options;
  const doc = new jsPDF();

  // Colors - Abacus theme
  const orange = [255, 149, 0]; // Primary
  const cyan = [0, 206, 209]; // Secondary
  const darkGray = [31, 41, 55];
  const lightGray = [156, 163, 175];

  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Helper function to add wrapped text
  const addWrappedText = (text: string, x: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      checkPageBreak(fontSize / 2);
      doc.text(line, x, yPosition);
      yPosition += fontSize / 2;
    });
  };

  // Header
  doc.setFillColor(...orange);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Sentry Configuration Analysis', margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`SDK: ${sdkType} | Model: ${model}`, margin, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 30, { align: 'right' });

  yPosition = 50;

  // Summary Box
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(margin, yPosition, contentWidth, 25, 3, 3, 'F');

  doc.setTextColor(...darkGray);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Analysis Summary', margin + 5, yPosition + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`[OK] ${result.correctConfig.length} items configured correctly`, margin + 5, yPosition + 15);
  doc.text(`[!] ${result.problems.length} problems identified`, margin + 5, yPosition + 20);
  doc.text(`[i] ${result.suggestions.length} optimization suggestions`, pageWidth / 2, yPosition + 15);

  yPosition += 35;

  // Correct Configuration Section
  if (result.correctConfig.length > 0) {
    checkPageBreak(20);

    doc.setFillColor(...cyan);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('[OK] Correct Configuration', margin + 3, yPosition + 5.5);

    yPosition += 12;

    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    result.correctConfig.forEach((item, index) => {
      checkPageBreak(10);
      doc.setFillColor(220, 252, 231);
      doc.circle(margin + 3, yPosition - 2, 2, 'F');
      addWrappedText(item, margin + 8, contentWidth - 8, 10);
      yPosition += 3;
    });

    yPosition += 5;
  }

  // Problems Section
  if (result.problems.length > 0) {
    checkPageBreak(20);

    doc.setFillColor(...orange);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('[!] Problems & Recommended Fixes', margin + 3, yPosition + 5.5);

    yPosition += 12;

    result.problems.forEach((problem, index) => {
      checkPageBreak(40);

      // Problem title
      doc.setTextColor(...orange);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${problem.title}`, margin, yPosition);
      yPosition += 6;

      // Problem description
      doc.setTextColor(...darkGray);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      addWrappedText(problem.description, margin + 5, contentWidth - 10, 10);
      yPosition += 3;

      // "Current Code (Problem)" section
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38); // Red color
      doc.text('X Current Code (Problem):', margin + 5, yPosition);
      yPosition += 5;

      // Extract actual problematic code from original config
      const relevantCode = extractRelevantCode(originalConfig || '', problem);
      const problemCodeWithHeader = `// ISSUE: ${problem.title}\n${relevantCode}`;

      const badCodeLines = doc.splitTextToSize(problemCodeWithHeader, contentWidth - 32);
      const estimatedHeight = (badCodeLines.length * 7) + 16;

      checkPageBreak(estimatedHeight + 10);

      // Save position to draw box after rendering
      const boxStartY = yPosition;

      doc.setFontSize(10);
      doc.setFont('courier', 'normal');

      const badCodeRenderedHeight = renderHighlightedCode(
        doc,
        problemCodeWithHeader,
        margin + 10,
        yPosition + 8,
        contentWidth - 20
      );

      const actualHeight = badCodeRenderedHeight + 10;

      // Draw white background first
      doc.setFillColor(255, 255, 255);
      doc.rect(margin + 5, boxStartY, contentWidth - 10, actualHeight, 'F');

      // Redraw the code on top of the background
      renderHighlightedCode(
        doc,
        problemCodeWithHeader,
        margin + 10,
        boxStartY + 8,
        contentWidth - 20
      );

      // Draw red border on top
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(2);
      doc.roundedRect(margin + 5, boxStartY, contentWidth - 10, actualHeight, 2, 2, 'S');

      yPosition += actualHeight + 6;

      // "Recommended Fix" section
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74); // Green color
      doc.text('> Recommended Fix:', margin + 5, yPosition);
      yPosition += 5;

      // Split the fix text with proper width to prevent overflow
      const fixLines = doc.splitTextToSize(problem.fix, contentWidth - 32);
      const estimatedFixHeight = (fixLines.length * 7) + 16;

      checkPageBreak(estimatedFixHeight + 10);

      const fixBoxStartY = yPosition;

      doc.setFontSize(10);
      doc.setFont('courier', 'normal');

      const fixRenderedHeight = renderHighlightedCode(
        doc,
        problem.fix,
        margin + 10,
        yPosition + 8,
        contentWidth - 20
      );

      const actualFixHeight = fixRenderedHeight + 10;

      // Draw white background
      doc.setFillColor(255, 255, 255);
      doc.rect(margin + 5, fixBoxStartY, contentWidth - 10, actualFixHeight, 'F');

      // Redraw the code on top of the background
      renderHighlightedCode(
        doc,
        problem.fix,
        margin + 10,
        fixBoxStartY + 8,
        contentWidth - 20
      );

      // Draw green border on top
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(2);
      doc.roundedRect(margin + 5, fixBoxStartY, contentWidth - 10, actualFixHeight, 2, 2, 'S');

      yPosition += actualFixHeight + 10;

      // Separator line
      doc.setDrawColor(...lightGray);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
    });
  }

  // Suggestions Section
  if (result.suggestions.length > 0) {
    checkPageBreak(20);

    doc.setFillColor(100, 180, 220);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('[i] Optimization Suggestions', margin + 3, yPosition + 5.5);

    yPosition += 12;

    result.suggestions.forEach((suggestion, index) => {
      checkPageBreak(20);

      doc.setTextColor(100, 180, 220);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${suggestion.title}`, margin, yPosition);
      yPosition += 5;

      doc.setTextColor(...darkGray);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      addWrappedText(suggestion.description, margin + 5, contentWidth - 10, 10);
      yPosition += 3;

      // Add code snippet if available
      if (suggestion.code) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 180, 220);
        doc.text('Example Implementation:', margin + 5, yPosition);
        yPosition += 5;

        const codeLines = doc.splitTextToSize(suggestion.code, contentWidth - 32);
        const estimatedSuggestionHeight = (codeLines.length * 7) + 16;

        checkPageBreak(estimatedSuggestionHeight + 10);

        const suggestionBoxStartY = yPosition;

        doc.setFontSize(10);
        doc.setFont('courier', 'normal');

        const suggestionRenderedHeight = renderHighlightedCode(
          doc,
          suggestion.code,
          margin + 10,
          yPosition + 8,
          contentWidth - 20
        );

        const actualSuggestionHeight = suggestionRenderedHeight + 10;

        // Draw white background
        doc.setFillColor(255, 255, 255);
        doc.rect(margin + 5, suggestionBoxStartY, contentWidth - 10, actualSuggestionHeight, 'F');

        // Redraw the code on top of the background
        renderHighlightedCode(
          doc,
          suggestion.code,
          margin + 10,
          suggestionBoxStartY + 8,
          contentWidth - 20
        );

        // Draw blue border on top
        doc.setDrawColor(100, 180, 220);
        doc.setLineWidth(2);
        doc.roundedRect(margin + 5, suggestionBoxStartY, contentWidth - 10, actualSuggestionHeight, 2, 2, 'S');

        yPosition += actualSuggestionHeight + 8;
      } else {
        yPosition += 5;
      }
    });
  }

  // Complete Fixed Configuration
  if (fixedConfig || result.completeFixedConfig) {
    const configToUse = fixedConfig || result.completeFixedConfig;

    // Add new page for fixed config
    doc.addPage();
    yPosition = 20;

    doc.setFillColor(...orange);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('[FIX] Complete Fixed Configuration', margin + 3, yPosition + 5.5);

    yPosition += 12;

    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('> Ready-to-Use Configuration', margin, yPosition);
    yPosition += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Copy and paste this entire configuration to replace your current Sentry.init() code:', margin, yPosition);
    yPosition += 8;

    // Code block with fixed config - with syntax highlighting
    const configLines = doc.splitTextToSize(configToUse, contentWidth - 24);
    const estimatedConfigHeight = (configLines.length * 7) + 16;

    // For very long configs, we'll need to handle page breaks
    const availableSpace = pageHeight - yPosition - 30;

    if (estimatedConfigHeight > availableSpace) {
      // Multi-page config - use simpler rendering to handle page breaks
      const boxHeight = availableSpace;

      // Draw white background first
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, yPosition, contentWidth, boxHeight, 'F');

      // Draw green border
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(2);
      doc.roundedRect(margin, yPosition, contentWidth, boxHeight, 2, 2, 'S');

      doc.setFont('courier', 'normal');
      doc.setFontSize(10);

      let configY = yPosition + 10;

      // Render with syntax highlighting
      const lines = configToUse.split('\n');
      for (const line of lines) {
        if (configY > pageHeight - 30) {
          doc.addPage();
          configY = 20;

          // Draw continuation box on new page
          const continuationHeight = pageHeight - 45;

          // White background
          doc.setFillColor(255, 255, 255);
          doc.rect(margin, 15, contentWidth, continuationHeight, 'F');

          // Green border
          doc.setDrawColor(22, 163, 74);
          doc.setLineWidth(2);
          doc.roundedRect(margin, 15, contentWidth, continuationHeight, 2, 2, 'S');

          doc.setFont('courier', 'normal');
          doc.setFontSize(10);
        }

        // Render each line with syntax highlighting
        renderHighlightedCode(doc, line, margin + 12, configY, contentWidth - 24);
        configY += 7;
      }
    } else {
      // Single page config - use full syntax highlighting
      const configBoxStartY = yPosition;

      doc.setFontSize(10);
      doc.setFont('courier', 'normal');

      const configRenderedHeight = renderHighlightedCode(
        doc,
        configToUse,
        margin + 12,
        yPosition + 10,
        contentWidth - 24
      );

      const actualConfigHeight = configRenderedHeight + 16;

      // Draw white background
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, configBoxStartY, contentWidth, actualConfigHeight, 'F');

      // Redraw the code on top
      renderHighlightedCode(
        doc,
        configToUse,
        margin + 12,
        configBoxStartY + 10,
        contentWidth - 24
      );

      // Draw green border
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(2);
      doc.roundedRect(margin, configBoxStartY, contentWidth, actualConfigHeight, 2, 2, 'S');
    }
  }

  // Footer on last page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...lightGray);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Sentry Config Analyzer - Powered by Claude AI | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `sentry-config-analysis-${sdkType.toLowerCase()}-${timestamp}.pdf`;

  // Save the PDF
  doc.save(filename);
}
