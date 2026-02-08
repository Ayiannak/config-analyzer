import { useState, useRef, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import ReactMarkdown from 'react-markdown'
import { type AnalysisResult } from './services/analyzer'
import {
  analyzeConfigStreaming,
  analyzeConfigEnhanced,
  chatAboutConfig,
  generateFixedConfig,
  type ChatMessage,
  type StreamEvent
} from './services/enhanced-analyzer'
import { maskSensitiveData } from './utils/security'
import { exportToPDF } from './utils/pdfExporter'

function App() {
  const [mode, setMode] = useState<'config' | 'general'>('config')
  const [configCode, setConfigCode] = useState('')
  const [issueContext, setIssueContext] = useState('')
  const [generalQuestion, setGeneralQuestion] = useState('')
  const [generalAnswer, setGeneralAnswer] = useState('')
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [sdkType, setSdkType] = useState('JavaScript')
  const [model, setModel] = useState<'sonnet-4' | 'opus-4.5'>('opus-4.5')
  const [useExtendedThinking, setUseExtendedThinking] = useState(true)
  const [useStreaming, setUseStreaming] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [thinking, setThinking] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [fixedConfig, setFixedConfig] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const chatSectionRef = useRef<HTMLDivElement>(null)
  const fixedConfigSectionRef = useRef<HTMLDivElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string }>>([])
  const [isDragging, setIsDragging] = useState(false)
  const [maskedSecrets, setMaskedSecrets] = useState<Array<{ type: string; count: number }>>([])
  const [showSecurityNotice, setShowSecurityNotice] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Auto-expand chat when results are available
  useEffect(() => {
    if (result && !showChat) {
      setShowChat(true)
    }
  }, [result, showChat])

  // Scroll to chat section
  const scrollToChat = () => {
    chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (!showChat) setShowChat(true)
  }

  // Scroll to fixed config section
  const scrollToFixedConfig = () => {
    fixedConfigSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Mask DSNs in analysis results
  const maskResultDSNs = (result: AnalysisResult): AnalysisResult => {
    // Use the comprehensive masking utility for all secret types
    const maskObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return maskSensitiveData(obj).maskedContent
      }
      if (Array.isArray(obj)) {
        return obj.map(maskObject)
      }
      if (obj && typeof obj === 'object') {
        const masked: any = {}
        for (const key in obj) {
          masked[key] = maskObject(obj[key])
        }
        return masked
      }
      return obj
    }

    return maskObject(result)
  }

  // Update configCode whenever files change
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      const combined = uploadedFiles
        .map((f) => `// File: ${f.name}\n${f.content}`)
        .join('\n\n' + '='.repeat(80) + '\n\n')
      setConfigCode(combined)
    }
  }, [uploadedFiles])

  // Handle multiple file uploads with security masking
  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return

    const startTime = Date.now()
    const fileCount = files.length
    let totalSize = 0
    Array.from(files).forEach(f => totalSize += f.size)

    await Sentry.startSpan(
      {
        name: 'config.file_upload',
        op: 'config.file_upload',
        attributes: {
          'upload.file_count': fileCount,
          'upload.total_size_bytes': totalSize,
        }
      },
      async (span) => {
        const filePromises = Array.from(files).map(file => {
          return new Promise<{ name: string; content: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => {
              const content = e.target?.result as string

              // Mask sensitive data
              const maskingResult = maskSensitiveData(content)

              if (maskingResult.wasMasked) {
                setMaskedSecrets(prev => {
                  const newSecrets = [...prev];
                  maskingResult.detectedSecrets.forEach(detected => {
                    const existing = newSecrets.find(s => s.type === detected.type);
                    if (existing) {
                      existing.count += detected.count;
                    } else {
                      newSecrets.push(detected);
                    }
                  });
                  return newSecrets;
                });
                setShowSecurityNotice(true);
              }

              resolve({ name: file.name, content: maskingResult.maskedContent })
            }
            reader.onerror = reject
            reader.readAsText(file)
          })
        })

        try {
          const loadedFiles = await Promise.all(filePromises)
          setUploadedFiles(prev => [...prev, ...loadedFiles])

          const duration = Date.now() - startTime

          // Mark success
          span.setStatus({ code: 1, message: 'ok' })
          span.setAttribute('upload.success', true)
          span.setAttribute('upload.duration_ms', duration)

          Sentry.metrics.distribution('config.file_upload.duration', duration, {
            unit: 'millisecond',
          })
        } catch (error) {
          console.error('Error reading files:', error)
          alert('Failed to read one or more files')

          span.setStatus({ code: 2, message: 'Upload failed' })
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              operation: 'config.file_upload',
            },
            contexts: {
              upload: {
                file_count: fileCount,
                total_size_bytes: totalSize,
                file_types: Array.from(files).map(f => f.type).join(', '),
              }
            },
            fingerprint: ['file-upload-error']
          })
          throw error
        }
      }
    )
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleClearAllFiles = () => {
    setConfigCode('')
    setUploadedFiles([])
    setMaskedSecrets([])
    setShowSecurityNotice(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle paste/typing with security masking
  const handleConfigCodeChange = (value: string) => {
    const maskingResult = maskSensitiveData(value)

    if (maskingResult.wasMasked) {
      setMaskedSecrets(maskingResult.detectedSecrets)
      setShowSecurityNotice(true)
      setConfigCode(maskingResult.maskedContent)
    } else {
      setConfigCode(value)
    }
  }

  const handleAnalyze = async () => {
    if (!configCode.trim()) {
      alert('Please paste the Sentry.init() code')
      return
    }

    setAnalyzing(true)
    setResult(null)
    setThinking('')
    setStreamingText('')
    setFixedConfig('')
    setAnalysisProgress(0)
    setChatMessages([]) // Clear chat history on new analysis

    // Start Sentry performance tracking for "time to analysis"
    const startTime = Date.now()

    await Sentry.startSpan(
      {
        name: 'config.analysis',
        op: 'config.analyze',
        attributes: {
          'analysis.sdk_type': sdkType,
          'analysis.model': model,
          'analysis.streaming': useStreaming,
          'analysis.extended_thinking': useExtendedThinking,
        }
      },
      async (span) => {
        let analysisResult: AnalysisResult | null = null

        try {
      if (useStreaming) {
        // Streaming mode
        let thinkingText = ''
        let currentLength = 0
        const estimatedTotalLength = 5000

        await analyzeConfigStreaming(
          {
            configCode,
            issueContext,
            sdkType,
            model,
            useExtendedThinking,
          },
          (event: StreamEvent) => {
            switch (event.type) {
              case 'thinking_start':
                setThinking('🤔 Thinking deeply...')
                setAnalysisProgress(10)
                break
              case 'thinking':
                thinkingText += event.content
                setThinking(thinkingText)
                // Progress during thinking: 10% to 30%
                const thinkingProgress = Math.min(30, 10 + (thinkingText.length / 100))
                setAnalysisProgress(thinkingProgress)
                break
              case 'thinking_complete':
                setThinking(prev => prev + '\n\n✅ Analysis complete')
                setAnalysisProgress(35)
                break
              case 'progress':
                // Show progress based on response length
                currentLength = event.length || 0
                setStreamingText(`Receiving response... ${currentLength} characters`)
                const textProgress = Math.min(95, 35 + ((currentLength / estimatedTotalLength) * 60))
                setAnalysisProgress(textProgress)
                break
              case 'complete':
                setAnalysisProgress(100)
                // Server has already validated and parsed the JSON
                try {
                  const parsed = event.result
                  const maskedResult = maskResultDSNs(parsed)
                  analysisResult = maskedResult
                  setResult(maskedResult)
                  if (maskedResult.completeFixedConfig) {
                    setFixedConfig(maskedResult.completeFixedConfig)
                  }
                } catch (e) {
                  console.error('Failed to process result:', e)
                  alert(`Failed to process analysis result: ${e instanceof Error ? e.message : 'Unknown error'}`)
                }
                break
              case 'error':
                alert(`Error: ${event.error}`)
                if (event.rawText) {
                  console.error('Raw response text:', event.rawText)
                }
                break
            }
          }
        )
      } else {
        // Non-streaming mode
        setAnalysisProgress(50)
        const analysis = await analyzeConfigEnhanced({
          configCode,
          issueContext,
          sdkType,
          model,
          useExtendedThinking,
        })

        setAnalysisProgress(100)
        const maskedAnalysis = maskResultDSNs(analysis)
        analysisResult = maskedAnalysis
        setResult(maskedAnalysis)

        if (maskedAnalysis.thinking) {
          setThinking(maskedAnalysis.thinking)
        }

        if (maskedAnalysis.completeFixedConfig) {
          setFixedConfig(maskedAnalysis.completeFixedConfig)
        }
      }

          // Mark span as successful
          span.setStatus({ code: 1, message: 'ok' })
          span.setAttribute('analysis.success', true)

          // Track complexity assessment
          if (analysisResult?.complexityAssessment) {
            span.setAttribute('analysis.requires_human_review', analysisResult.complexityAssessment.requiresHumanReview)

            if (analysisResult.complexityAssessment.requiresHumanReview) {
              // Log complexity warning event
              Sentry.captureMessage('Complex configuration detected - human review recommended', {
                level: 'warning',
                tags: {
                  sdk_type: sdkType,
                  model: model,
                },
                extra: {
                  reason: analysisResult.complexityAssessment.reason,
                  recommended_action: analysisResult.complexityAssessment.recommendedAction,
                  problem_count: analysisResult.problems.length,
                }
              })
            }
          }
        } catch (error) {
          console.error('Analysis error:', error)
          alert(`Error analyzing configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)

          // Mark span as error and capture exception with detailed context
          span.setStatus({ code: 2, message: 'Analysis failed' })
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              operation: 'config.analysis',
              sdk_type: sdkType,
              model: model,
              streaming: useStreaming.toString(),
              extended_thinking: useExtendedThinking.toString(),
            },
            contexts: {
              analysis: {
                config_length: configCode.length,
                has_issue_context: !!issueContext,
              }
            },
            fingerprint: ['config-analysis-error', sdkType, model]
          })
          throw error
        } finally {
          // Calculate and record time to analysis
          const analysisTimeMs = Date.now() - startTime

          // Add timing as span attribute
          span.setAttribute('analysis.duration_ms', analysisTimeMs)

          // Record as custom metric
          Sentry.metrics.distribution('config.analysis.duration', analysisTimeMs, {
            unit: 'millisecond',
          })

          // Add context tags for filtering
          Sentry.setTag('analysis.sdk_type', sdkType)
          Sentry.setTag('analysis.model', model)
          Sentry.setTag('analysis.streaming', useStreaming)

          setAnalyzing(false)
        }
      }
    )
  }

  const handleCopyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(generalAnswer)
      setCopiedAnswer(true)
      setTimeout(() => setCopiedAnswer(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('Failed to copy to clipboard')
    }
  }

  const handleGeneralQuery = async () => {
    if (!generalQuestion.trim()) {
      alert('Please enter a Sentry question')
      return
    }

    setAnalyzing(true)
    setGeneralAnswer('')
    setThinking('')
    setAnalysisProgress(0)

    const startTime = Date.now()

    await Sentry.startSpan(
      {
        name: 'general.query',
        op: 'general.query',
        attributes: {
          'query.sdk_type': sdkType,
          'query.model': model,
          'query.extended_thinking': useExtendedThinking,
        }
      },
      async (span) => {
        try {
          // Streaming general query
          let thinkingText = ''
          let answerText = ''

          const response = await fetch('http://localhost:3001/api/general-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: generalQuestion,
              sdkType,
              model,
              useExtendedThinking,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to process query')
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()

          if (!reader) throw new Error('No response stream')

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6))

                  switch (event.type) {
                    case 'thinking_start':
                      setThinking('🤔 Thinking deeply...')
                      setAnalysisProgress(10)
                      break
                    case 'thinking':
                      thinkingText += event.content
                      setThinking(thinkingText)
                      setAnalysisProgress(Math.min(30, 10 + (thinkingText.length / 100)))
                      break
                    case 'thinking_complete':
                      setThinking(prev => prev + '\n\n✅ Analysis complete')
                      setAnalysisProgress(35)
                      break
                    case 'text':
                      answerText += event.content
                      setGeneralAnswer(answerText)
                      setAnalysisProgress(Math.min(95, 35 + (answerText.length / 50)))
                      break
                    case 'complete':
                      setGeneralAnswer(event.answer)
                      setAnalysisProgress(100)
                      break
                    case 'error':
                      alert(`Error: ${event.error}`)
                      break
                  }
                } catch (e) {
                  console.error('Failed to parse SSE event:', e)
                }
              }
            }
          }

          span.setStatus({ code: 1, message: 'ok' })
          span.setAttribute('query.success', true)
        } catch (error) {
          console.error('Query error:', error)
          alert(`Error processing question: ${error instanceof Error ? error.message : 'Unknown error'}`)

          span.setStatus({ code: 2, message: 'Query failed' })
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              operation: 'general.query',
              sdk_type: sdkType,
              model: model,
              extended_thinking: useExtendedThinking.toString(),
            },
            contexts: {
              query: {
                question_length: generalQuestion.length,
              }
            },
            fingerprint: ['general-query-error', sdkType, model]
          })
          throw error
        } finally {
          const queryTimeMs = Date.now() - startTime
          span.setAttribute('query.duration_ms', queryTimeMs)

          Sentry.metrics.distribution('general.query.duration', queryTimeMs, {
            unit: 'millisecond',
          })

          setAnalyzing(false)
        }
      }
    )
  }

  const handleGenerateFixedConfig = async () => {
    if (!result || !result.problems || result.problems.length === 0) return

    const startTime = Date.now()

    await Sentry.startSpan(
      {
        name: 'config.generate_fixed',
        op: 'config.generate_fixed',
        attributes: {
          'generate.sdk_type': sdkType,
          'generate.model': model,
          'generate.problem_count': result.problems?.length || 0,
        }
      },
      async (span) => {
        try {
          const fixed = await generateFixedConfig(configCode, result.problems, sdkType, model)
          // Mask DSN in the generated fixed config
          const dsnPattern = /https?:\/\/[a-f0-9]{32}@[a-z0-9-]+\.ingest\.[a-z]+\.sentry\.io\/\d+/gi
          const maskedFixed = fixed.replace(dsnPattern, 'https://***MASKED_DSN***@your-org.ingest.sentry.io/***')
          setFixedConfig(maskedFixed)

          // Mark success
          span.setStatus({ code: 1, message: 'ok' })
          span.setAttribute('generate.success', true)
        } catch (error) {
          console.error('Error generating fixed config:', error)
          alert('Failed to generate fixed configuration')

          span.setStatus({ code: 2, message: 'Generation failed' })
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              operation: 'config.generate_fixed',
              sdk_type: sdkType,
              model: model,
            },
            contexts: {
              generation: {
                problem_count: result.problems?.length || 0,
                config_length: configCode.length,
              }
            },
            fingerprint: ['generate-fixed-config-error', model]
          })
          throw error
        } finally {
          const duration = Date.now() - startTime
          span.setAttribute('generate.duration_ms', duration)

          Sentry.metrics.distribution('config.generate_fixed.duration', duration, {
            unit: 'millisecond',
          })
        }
      }
    )
  }

  const handleExportPDF = () => {
    if (!result) return

    const startTime = Date.now()

    Sentry.startSpan(
      {
        name: 'config.export_pdf',
        op: 'config.export_pdf',
        attributes: {
          'export.sdk_type': sdkType,
          'export.model': model,
          'export.problem_count': result.problems?.length || 0,
          'export.has_recommendations': !!result.recommendations,
        }
      },
      (span) => {
        try {
          exportToPDF({
            result,
            sdkType,
            fixedConfig,
            model: model === 'opus-4.5' ? 'Claude Opus 4.5' : 'Claude Sonnet 4',
            originalConfig: configCode
          })

          const duration = Date.now() - startTime

          // Mark success
          span.setStatus({ code: 1, message: 'ok' })
          span.setAttribute('export.success', true)
          span.setAttribute('export.duration_ms', duration)

          Sentry.metrics.distribution('config.export_pdf.duration', duration, {
            unit: 'millisecond',
          })
        } catch (error) {
          span.setStatus({ code: 2, message: 'Export failed' })
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              operation: 'config.export_pdf',
              sdk_type: sdkType,
              model: model,
            },
            contexts: {
              export: {
                problem_count: result.problems?.length || 0,
                has_fixed_config: !!fixedConfig,
              }
            },
            fingerprint: ['export-pdf-error']
          })
          throw error
        }
      }
    )
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !result) return

    const newMessage: ChatMessage = { role: 'user', content: chatInput }
    const updatedMessages = [...chatMessages, newMessage]
    setChatMessages(updatedMessages)
    setChatInput('')
    setSendingMessage(true)

    const startTime = Date.now()

    await Sentry.startSpan(
      {
        name: 'config.chat',
        op: 'config.chat',
        attributes: {
          'chat.sdk_type': sdkType,
          'chat.model': model,
          'chat.message_count': updatedMessages.length,
          'chat.message_length': chatInput.length,
        }
      },
      async (span) => {
        try {
          const response = await chatAboutConfig(updatedMessages, sdkType, configCode, model)
          // Mask DSN in chat responses
          const dsnPattern = /https?:\/\/[a-f0-9]{32}@[a-z0-9-]+\.ingest\.[a-z]+\.sentry\.io\/\d+/gi
          const maskedResponse = response.replace(dsnPattern, 'https://***MASKED_DSN***@your-org.ingest.sentry.io/***')
          setChatMessages([...updatedMessages, { role: 'assistant', content: maskedResponse }])

          const duration = Date.now() - startTime

          // Mark success
          span.setStatus({ code: 1, message: 'ok' })
          span.setAttribute('chat.success', true)
          span.setAttribute('chat.duration_ms', duration)
          span.setAttribute('chat.response_length', maskedResponse.length)

          Sentry.metrics.distribution('config.chat.duration', duration, {
            unit: 'millisecond',
          })
        } catch (error) {
          console.error('Chat error:', error)
          alert('Failed to send message')

          span.setStatus({ code: 2, message: 'Chat failed' })
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              operation: 'config.chat',
              sdk_type: sdkType,
              model: model,
            },
            contexts: {
              chat: {
                message_count: updatedMessages.length,
                message_length: chatInput.length,
                has_previous_context: chatMessages.length > 0,
              }
            },
            fingerprint: ['chat-error', model]
          })
          throw error
        } finally {
          setSendingMessage(false)
        }
      }
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 pb-2 bg-accent-gradient bg-clip-text text-transparent leading-tight">
            Sentry Config Analyzer
          </h1>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="px-4 py-2 bg-purple-600/30 text-purple-300 rounded-full text-base font-semibold border border-purple-500/50">
              📚 Powered by {model === 'opus-4.5' ? 'Opus 4.5' : 'Sonnet 4'} & Sentry Docs
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Expert Sentry troubleshooting and configuration analysis
          </p>

          {/* Mode Selector */}
          <div className="flex justify-center gap-4 mb-4">
            <button
              onClick={() => {
                setMode('config')
                setGeneralAnswer('')
                setGeneralQuestion('')
                setThinking('')
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                mode === 'config'
                  ? 'bg-primary text-gray-900 shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📋 Config Analysis
            </button>
            <button
              onClick={() => {
                setMode('general')
                setResult(null)
                setGeneralAnswer('')
                setThinking('')
                // Clear config-related state to prevent any interference
                setFixedConfig('')
                setChatMessages([])
                setStreamingText('')
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                mode === 'general'
                  ? 'bg-secondary text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              💬 General Q&A
            </button>
          </div>

          <div className="mt-4 flex justify-center gap-2 text-sm text-gray-500">
            <span className="px-3 py-1 bg-primary/20 rounded-full">🚀 Streaming</span>
            <span className="px-3 py-1 bg-secondary/20 rounded-full">🧠 Extended Thinking</span>
            {mode === 'config' && (
              <>
                <span className="px-3 py-1 bg-primary/20 rounded-full">💬 Interactive Chat</span>
                <span className="px-3 py-1 bg-secondary/20 rounded-full">🔧 Auto-Fix Generation</span>
              </>
            )}
          </div>
        </div>

        {/* Security Notice Banner - Only show in Config Analysis mode */}
        {mode === 'config' && (
          <div className="card p-4 mb-6 border-l-4 border-green-500">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-400 mb-2">
                  Your Data is Secure & Private
                </h3>
                <div className="text-gray-300 text-sm space-y-1">
                  <p>✓ <strong>Automatic Masking:</strong> DSNs, API keys, tokens, and secrets are automatically detected and masked before analysis</p>
                  <p>✓ <strong>No Storage:</strong> Your configuration is processed in real-time and never stored on our servers</p>
                  <p>✓ <strong>Direct API:</strong> Analysis is performed directly via Claude API with enterprise-grade security</p>
                  <p>✓ <strong>Client-Side Protection:</strong> Sensitive data is masked in your browser before transmission</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Masked Secrets Alert */}
        {showSecurityNotice && maskedSecrets.length > 0 && (
          <div className="card p-4 mb-6 bg-yellow-500/10 border-l-4 border-yellow-500">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                  Sensitive Data Detected & Masked
                </h3>
                <p className="text-gray-300 text-sm mb-2">
                  We automatically detected and masked the following sensitive information:
                </p>
                <ul className="text-gray-300 text-sm space-y-1">
                  {maskedSecrets.map((secret, i) => (
                    <li key={i}>
                      • <strong>{secret.type}</strong>: {secret.count} instance{secret.count > 1 ? 's' : ''} masked
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowSecurityNotice(false)}
                  className="mt-3 text-xs text-yellow-400 hover:text-yellow-300 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Settings */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">⚙️ AI Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Model Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Claude Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as 'sonnet-4' | 'opus-4.5')}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="sonnet-4">Sonnet 4 (Fast, Cost-Effective)</option>
                <option value="opus-4.5">Opus 4.5 (Most Powerful)</option>
              </select>
            </div>

            {/* Extended Thinking Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Extended Thinking
              </label>
              <button
                onClick={() => setUseExtendedThinking(!useExtendedThinking)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
                  useExtendedThinking
                    ? 'bg-primary text-gray-900'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {useExtendedThinking ? '🧠 Enabled (Deeper Analysis)' : '💡 Disabled'}
              </button>
            </div>

            {/* Streaming Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Streaming Mode
              </label>
              <button
                onClick={() => setUseStreaming(!useStreaming)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
                  useStreaming
                    ? 'bg-secondary text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {useStreaming ? '🚀 Enabled (Real-time)' : '⏱️ Disabled'}
              </button>
            </div>
          </div>
        </div>

        {/* Input Section */}
        {mode === 'config' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left Column: Config Input */}
            <div className="card p-6">
            <h2 className="text-2xl font-semibold mb-4 text-primary">
              📝 Configuration Code
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                SDK Type
              </label>
              <select
                value={sdkType}
                onChange={(e) => setSdkType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option>JavaScript</option>
                <option>Python</option>
                <option>React Native</option>
                <option>Flutter</option>
                <option>iOS</option>
                <option>Android</option>
                <option>Ruby</option>
                <option>PHP</option>
                <option>Java</option>
                <option>Go</option>
                <option>.NET</option>
                <option>Elixir</option>
                <option>Rust</option>
              </select>
            </div>

            {/* File Upload Section */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload Configuration Files
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-600 hover:border-primary/50 hover:bg-gray-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".js,.ts,.py,.rb,.php,.go,.cs,.java,.jsx,.tsx"
                  onChange={handleFileInputChange}
                  multiple
                  className="hidden"
                />
                {uploadedFiles.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">
                        {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleClearAllFiles()
                        }}
                        className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 text-xs"
                      >
                        Clear All
                      </button>
                    </div>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-primary text-xl">📄</span>
                          <span className="text-white text-sm font-medium">{file.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveFile(index)
                          }}
                          className="px-2 py-1 text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <p className="text-gray-500 text-xs pt-2">
                      Click or drop more files to add
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-2">📤</div>
                    <p className="text-gray-300 font-medium mb-1">
                      Drop your config files here or click to browse
                    </p>
                    <p className="text-gray-500 text-sm">
                      Supports .js, .ts, .py, .rb, .php, .go, .cs, .java (multiple files allowed)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Or Paste Sentry.init() Code
                </label>
                {configCode && uploadedFiles.length === 0 && (
                  <button
                    onClick={handleClearAllFiles}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                value={configCode}
                onChange={(e) => handleConfigCodeChange(e.target.value)}
                placeholder={`Sentry.init({
  dsn: "...",
  tracesSampleRate: 1.0,
  // ... paste your full config here
});`}
                className="w-full h-80 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Right Column: Issue Context */}
          <div className="card p-6">
            <h2 className="text-2xl font-semibold mb-4 text-secondary">
              🐛 Issue Context <span className="text-sm text-gray-400 font-normal">(Optional)</span>
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Provide specific issues for targeted troubleshooting, or leave blank for a general config health check and best practices review.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                What problems are you experiencing?
              </label>
              <textarea
                value={issueContext}
                onChange={(e) => setIssueContext(e.target.value)}
                placeholder={`Describe specific issues (optional):
- Not seeing errors from checkout flow
- Source maps aren't loading
- Performance data is missing
- Session replays aren't capturing

Leave empty for general config review`}
                className="w-full h-96 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !configCode.trim()}
              className="w-full px-6 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {analyzing ? '🔍 Analyzing...' : '🚀 Analyze Configuration'}
            </button>

            {/* Progress Bar */}
            {analyzing && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Analysis Progress</span>
                  <span className="text-sm font-semibold text-primary">{Math.round(analysisProgress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {analysisProgress < 10 && 'Initializing...'}
                  {analysisProgress >= 10 && analysisProgress < 35 && '🤔 Claude is thinking...'}
                  {analysisProgress >= 35 && analysisProgress < 95 && '✍️ Generating analysis...'}
                  {analysisProgress >= 95 && '✅ Finalizing...'}
                </div>
              </div>
            )}
          </div>
        </div>
        ) : (
          /* General Q&A Mode */
          <div className="card p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-secondary">
              💬 Ask a General Sentry Question
            </h2>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-blue-300 text-sm">
                ℹ️ <strong>Standalone Q&A Mode:</strong> This mode is completely independent from any config files you may have uploaded.
                Get expert answers about Sentry without needing to provide a config. Ask about features, troubleshooting, best practices, or any Sentry-related topic.
              </p>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Get expert answers about Sentry without needing to provide a config. Ask about features, troubleshooting, best practices, or any Sentry-related topic.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                SDK Type (Optional)
              </label>
              <select
                value={sdkType}
                onChange={(e) => setSdkType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option>JavaScript</option>
                <option>Python</option>
                <option>React Native</option>
                <option>Flutter</option>
                <option>iOS</option>
                <option>Android</option>
                <option>Ruby</option>
                <option>PHP</option>
                <option>Java</option>
                <option>Go</option>
                <option>.NET</option>
                <option>Elixir</option>
                <option>Rust</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Question
              </label>
              <textarea
                value={generalQuestion}
                onChange={(e) => setGeneralQuestion(e.target.value)}
                placeholder={`Ask anything about Sentry:
- How do I set up source maps in Next.js?
- Why aren't my errors showing up in Sentry?
- What's the difference between tracesSampleRate and profilesSampleRate?
- How do I bypass ad-blockers for Sentry?
- What are best practices for sampling in production?
- How do I configure session replay?`}
                className="w-full h-64 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

            <button
              onClick={handleGeneralQuery}
              disabled={analyzing || !generalQuestion.trim()}
              className="w-full px-6 py-3 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {analyzing ? '🔍 Processing...' : '🚀 Get Answer'}
            </button>

            {/* Progress Bar */}
            {analyzing && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Processing</span>
                  <span className="text-sm font-semibold text-secondary">{Math.round(analysisProgress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-secondary to-primary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extended Thinking Display */}
        {thinking && (
          <div className="card p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-primary">🧠</span>
              <span>Claude's Thinking Process</span>
            </h2>
            <div className="bg-black p-4 rounded-lg border border-primary/30">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {thinking}
              </pre>
            </div>
          </div>
        )}

        {/* Streaming Text Display */}
        {streamingText && !result && (
          <div className="card p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-secondary">⚡</span>
              <span>Live Analysis</span>
            </h2>
            <div className="bg-black p-4 rounded-lg border border-secondary/30">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {streamingText}
              </pre>
            </div>
          </div>
        )}

        {/* General Q&A Answer Display */}
        {mode === 'general' && generalAnswer && (
          <div className="card p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-secondary">💡</span>
              <span>Answer</span>
            </h2>
            <div className="bg-black p-6 rounded-lg border border-secondary/30">
              <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => (
                      <a
                        {...props}
                        className="text-blue-400 hover:text-blue-300 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                    code: ({ node, inline, ...props }) => (
                      inline ? (
                        <code className="bg-gray-800 px-2 py-1 rounded text-sm text-purple-300" {...props} />
                      ) : (
                        <code className="block bg-gray-900 p-3 rounded text-sm text-green-300 overflow-x-auto" {...props} />
                      )
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc list-inside space-y-1 my-2" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal list-inside space-y-1 my-2" {...props} />
                    ),
                    h1: ({ node, ...props }) => (
                      <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-xl font-bold mt-3 mb-2" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-lg font-bold mt-2 mb-1" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="mb-3" {...props} />
                    ),
                  }}
                >
                  {generalAnswer}
                </ReactMarkdown>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setGeneralQuestion('')
                  setGeneralAnswer('')
                  setThinking('')
                }}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all"
              >
                Ask Another Question
              </button>
              <button
                onClick={handleCopyAnswer}
                className="px-6 py-2 bg-primary/20 text-primary hover:bg-primary/30 rounded-lg font-semibold transition-all"
              >
                {copiedAnswer ? '✅ Copied!' : '📋 Copy Answer'}
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {mode === 'config' && result && (
          <div className="space-y-6">
            {/* Complexity Warning - Requires Human Review */}
            {result.complexityAssessment?.requiresHumanReview && (
              <div className="card p-6 bg-gradient-to-r from-orange-900/40 to-red-900/40 border-l-4 border-orange-500">
                <div className="flex items-start gap-4">
                  <span className="text-4xl">⚠️</span>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-orange-400 mb-3">
                      Complex Configuration - Human Review Recommended
                    </h3>
                    <p className="text-gray-300 mb-3 text-lg">
                      {result.complexityAssessment.reason}
                    </p>
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-orange-500/30">
                      <p className="text-white font-semibold mb-2">📋 Recommended Action:</p>
                      <p className="text-gray-300">{result.complexityAssessment.recommendedAction}</p>
                    </div>
                    <p className="text-gray-400 text-sm mt-3">
                      💡 While the AI analysis below provides guidance, this configuration requires expertise to implement safely.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Header with Export Button */}
            <div className="card p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-l-4 border-primary">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">📊 Analysis Complete</h2>
                  <p className="text-gray-300">
                    {result.correctConfig?.length || 0} items correct • {result.problems?.length || 0} problems found • {result.suggestions?.length || 0} suggestions
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={scrollToChat}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                  >
                    <span className="text-xl">💬</span>
                    Chat
                  </button>
                  {fixedConfig && (
                    <button
                      onClick={scrollToFixedConfig}
                      className="px-6 py-3 bg-secondary hover:bg-secondary/90 text-white rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                    >
                      <span className="text-xl">🔧</span>
                      See Full Config
                    </button>
                  )}
                  <button
                    onClick={handleExportPDF}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                  >
                    <span className="text-xl">📄</span>
                    Export to PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Correct Configuration */}
            {result.correctConfig.length > 0 && (
              <div className="card p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-green-400">✅</span>
                  <span>What's Configured Correctly</span>
                </h2>
                <ul className="space-y-2">
                  {result.correctConfig.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-300">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Problems Detected */}
            {result.problems && result.problems.length > 0 && (
              <div className="card p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-primary">❌</span>
                  <span>Problems Detected</span>
                </h2>
                <div className="space-y-6">
                  {result.problems.map((problem, i) => {
                    const severityColors = {
                      critical: 'border-red-500 bg-red-900/20',
                      high: 'border-orange-500 bg-orange-900/20',
                      medium: 'border-yellow-500 bg-yellow-900/20',
                      low: 'border-blue-500 bg-blue-900/20'
                    }
                    const severityLabels = {
                      critical: '🔴 CRITICAL',
                      high: '🟠 HIGH',
                      medium: '🟡 MEDIUM',
                      low: '🔵 LOW'
                    }
                    const borderColor = problem.severity ? severityColors[problem.severity] : 'border-primary'
                    const severityLabel = problem.severity ? severityLabels[problem.severity] : null

                    return (
                    <div key={i} className={`border-l-4 pl-4 ${borderColor}`}>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-semibold text-primary">
                          {problem.title}
                        </h3>
                        {severityLabel && (
                          <span className="text-sm font-bold px-3 py-1 rounded-full bg-gray-800/50">
                            {severityLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 mb-3">
                        {problem.description}
                      </p>
                      <div className="bg-black p-4 rounded-lg border border-gray-800">
                        <div className="text-sm text-gray-400 mb-2">🔧 Recommended Fix:</div>
                        <pre className="text-sm text-secondary font-mono overflow-x-auto">
                          {problem.fix}
                        </pre>
                      </div>
                      {problem.githubIssue && (
                        <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400">📌</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <a
                                  href={problem.githubIssue.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-300 hover:text-purple-200 font-semibold underline"
                                >
                                  {problem.githubIssue.title}
                                </a>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  problem.githubIssue.status === 'open'
                                    ? 'bg-green-900/30 text-green-400'
                                    : 'bg-purple-900/30 text-purple-400'
                                }`}>
                                  {problem.githubIssue.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">
                                {problem.githubIssue.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>

                {/* Generate Complete Fixed Config Button */}
                {!fixedConfig && (
                  <button
                    onClick={handleGenerateFixedConfig}
                    className="mt-6 w-full px-6 py-3 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary/90 transition-all"
                  >
                    🔧 Generate Complete Fixed Configuration
                  </button>
                )}
              </div>
            )}

            {/* Complete Fixed Configuration */}
            {fixedConfig && (
              <div ref={fixedConfigSectionRef} className="card p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-secondary">🔧</span>
                  <span>Complete Fixed Configuration</span>
                </h2>
                <div className="bg-black p-4 rounded-lg border border-secondary/30">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-400">Production-ready code with all fixes applied:</div>
                    <button
                      onClick={() => navigator.clipboard.writeText(fixedConfig)}
                      className="px-3 py-1 bg-secondary/20 text-secondary rounded hover:bg-secondary/30 text-sm"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <pre className="text-sm text-secondary font-mono overflow-x-auto">
                    {fixedConfig}
                  </pre>
                </div>
              </div>
            )}

            {/* Additional Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="card p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-secondary">💡</span>
                  <span>Additional Suggestions</span>
                </h2>
                <div className="space-y-4">
                  {result.suggestions.map((suggestion, i) => (
                    <div key={i} className="border-l-4 border-secondary pl-4">
                      <h3 className="text-lg font-semibold text-secondary mb-1">
                        {suggestion.title}
                      </h3>
                      <p className="text-gray-300">
                        {suggestion.description}
                      </p>
                      {suggestion.githubIssue && (
                        <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400">📌</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <a
                                  href={suggestion.githubIssue.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-300 hover:text-purple-200 font-semibold underline"
                                >
                                  {suggestion.githubIssue.title}
                                </a>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  suggestion.githubIssue.status === 'open'
                                    ? 'bg-green-900/30 text-green-400'
                                    : 'bg-purple-900/30 text-purple-400'
                                }`}>
                                  {suggestion.githubIssue.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">
                                {suggestion.githubIssue.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Resources */}
            {result.relatedResources && result.relatedResources.length > 0 && (
              <div className="card p-6 bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-l-4 border-purple-500">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-purple-400">🔗</span>
                  <span>Related GitHub Discussions & Feature Requests</span>
                </h2>
                <div className="space-y-3">
                  {result.relatedResources.map((resource, i) => {
                    const typeEmojis = {
                      'github_issue': '🐛',
                      'github_discussion': '💬',
                      'feature_request': '✨'
                    };
                    const typeLabels = {
                      'github_issue': 'Issue',
                      'github_discussion': 'Discussion',
                      'feature_request': 'Feature Request'
                    };

                    return (
                      <div key={i} className="p-4 bg-gray-800/50 rounded-lg border border-purple-500/20">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{typeEmojis[resource.type]}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                                {typeLabels[resource.type]}
                              </span>
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-300 hover:text-purple-200 font-semibold underline text-lg"
                              >
                                {resource.title}
                              </a>
                            </div>
                            <p className="text-gray-300 text-sm">
                              {resource.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-gray-400 text-sm mt-4">
                  💡 These resources from Sentry's GitHub repositories provide additional context about your configuration or issues you're experiencing.
                </p>
              </div>
            )}

            {/* Interactive Chat */}
            <div ref={chatSectionRef} className="card p-6 ring-2 ring-primary/50 shadow-lg shadow-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <span className="text-primary">💬</span>
                  <span>Ask Claude Follow-up Questions</span>
                </h2>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all"
                >
                  {showChat ? 'Hide Chat' : 'Show Chat'}
                </button>
              </div>

              {showChat && (
                <div>
                  {/* Chat Messages */}
                  <div className="bg-black rounded-lg border border-gray-800 p-4 h-96 overflow-y-auto mb-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        Ask Claude anything about this configuration...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${
                                msg.role === 'user'
                                  ? 'bg-primary text-gray-900'
                                  : 'bg-gray-800 text-gray-200'
                              }`}
                            >
                              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !sendingMessage && handleSendMessage()}
                      placeholder="Ask a question about this configuration..."
                      disabled={sendingMessage}
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !chatInput.trim()}
                      className="px-6 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {sendingMessage ? '⏳' : '📤'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Chat Button - Only show when results exist in config mode */}
        {mode === 'config' && result && (
          <button
            onClick={scrollToChat}
            className="fixed bottom-8 right-8 bg-primary text-gray-900 p-4 rounded-full shadow-lg hover:bg-primary/90 transition-all transform hover:scale-110 z-50 ring-4 ring-primary/30"
            title="Jump to Chat with Claude"
          >
            <span className="text-2xl">💬</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default App
