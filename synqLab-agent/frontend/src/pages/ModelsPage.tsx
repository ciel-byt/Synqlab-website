/**
 * ModelsPage — Upload training data and manage brightness models.
 *
 * Uses platform shadcn components: Card, Badge, Button, Input, Label,
 * Select, PageHeader, Progress.
 *
 * Flow: Upload CSV/XLSX → Preview columns → Train → Deploy
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Upload, FileSpreadsheet, Play, CheckCircle2, XCircle,
  Loader2, Beaker, Sparkles, RotateCcw, Rocket, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'

/* ── Types ────────────────────────────────────────────────────── */

interface UploadResult {
  dataset_id: string
  filename: string
  path: string
  columns: string[]
  n_rows: number
  detected_sequence_column: string | null
  detected_label_column: string | null
}

interface TrainingJob {
  job_id: string
  status: 'running' | 'completed' | 'failed'
  progress: string
  model_version: string | null
  metrics: Record<string, unknown> | null
  error: string | null
}

interface ModelVersion {
  version: string
  feature_mode: string
  tau: number | null
  n_train: number | null
  trained_at: string | null
  path: string
  is_active: boolean
}

/* ── Constants ────────────────────────────────────────────────── */

const FEATURE_MODES = [
  { value: 'one_hot', label: 'One-Hot', desc: 'Fast, no GPU needed' },
  { value: 'embedding', label: 'ESM-2 Embedding', desc: 'Best accuracy, needs GPU' },
  { value: 'hybrid', label: 'Hybrid', desc: 'ESM-2 + structural features' },
] as const

/* ── Component ────────────────────────────────────────────────── */

export function ModelsPage() {
  // Upload state
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Column mapping
  const [seqColumn, setSeqColumn] = useState('')
  const [labelColumn, setLabelColumn] = useState('')

  // Training state
  const [featureMode, setFeatureMode] = useState<string>('one_hot')
  const [trainingJob, setTrainingJob] = useState<TrainingJob | null>(null)
  const [isTraining, setIsTraining] = useState(false)

  // Models list
  const [models, setModels] = useState<ModelVersion[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // Load models on mount
  useEffect(() => { fetchModels() }, [])

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const models = await api.trainingListModels()
      setModels(models)
    } catch { /* ignore */ }
    setLoadingModels(false)
  }

  // ── Upload handler ──────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true)
    try {
      const data: UploadResult = await api.trainingUpload(file)
      setUploadResult(data)
      setSeqColumn(data.detected_sequence_column || '')
      setLabelColumn(data.detected_label_column || '')
    } catch (err) {
      console.error('Upload error:', err)
    }
    setIsUploading(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  // ── Train handler ───────────────────────────────────────────
  const handleTrain = async () => {
    if (!uploadResult) return
    setIsTraining(true)
    try {
      const data = await api.trainingTrain({
        dataset_path: uploadResult.path,
        sequence_column: seqColumn,
        label_column: labelColumn,
        feature_mode: featureMode,
      })
      const jobId = data.job_id

      // Poll for completion
      const poll = async () => {
        const job = { ...(await api.trainingStatus(jobId)), job_id: jobId } as TrainingJob
        setTrainingJob(job)
        if (job.status === 'running') {
          setTimeout(poll, 2000)
        } else {
          setIsTraining(false)
          fetchModels()
        }
      }
      poll()
    } catch (err) {
      setIsTraining(false)
      console.error('Training error:', err)
    }
  }

  // ── Deploy handler ──────────────────────────────────────────
  const handleDeploy = async (version: string) => {
    try {
      await api.trainingDeploy(version)
      fetchModels()
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Brightness Model"
        description="Train and deploy GFP11 brightness prediction models"
        actions={
          <Badge variant="info">
            <Beaker className="h-3 w-3 mr-1" />
            Fine-Tune
          </Badge>
        }
      />

      {/* ── Upload Section ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <CardTitle>Training Data</CardTitle>
        </CardHeader>
        <CardContent>
          {!uploadResult ? (
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                dragOver
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:border-border/80 hover:bg-muted/10'
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                }}
              />
              {isUploading ? (
                <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
              ) : (
                <>
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Drop your CSV or Excel file here
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Expected columns: sequence + brightness label
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <FileSpreadsheet className="h-5 w-5 text-status-ok flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{uploadResult.filename}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {uploadResult.n_rows} rows · {uploadResult.columns.length} columns
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setUploadResult(null); setTrainingJob(null) }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Column mapping */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="seq-col">Sequence Column</Label>
                  <div className="relative">
                    <select
                      id="seq-col"
                      value={seqColumn}
                      onChange={(e) => setSeqColumn(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 pr-8 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
                    >
                      <option value="">Auto-detect</option>
                      {uploadResult.columns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="label-col">Brightness Column</Label>
                  <div className="relative">
                    <select
                      id="label-col"
                      value={labelColumn}
                      onChange={(e) => setLabelColumn(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 pr-8 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
                    >
                      <option value="">Auto-detect</option>
                      {uploadResult.columns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Feature mode */}
              <div className="space-y-2">
                <Label>Feature Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FEATURE_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setFeatureMode(m.value)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg px-3 py-2.5 text-center transition-all border',
                        featureMode === m.value
                          ? 'border-primary bg-primary/5 depth-1'
                          : 'border-border bg-muted/10 hover:border-border/80'
                      )}
                    >
                      <span className="text-[11px] font-semibold">{m.label}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Train button */}
              <Button
                onClick={handleTrain}
                disabled={isTraining}
                className="w-full gap-2"
              >
                {isTraining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isTraining ? 'Training…' : 'Train Model'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Training Progress ──────────────────────────────── */}
      {trainingJob && (
        <Card>
          <CardHeader>
            <Sparkles className="h-3.5 w-3.5 text-status-warn" />
            <CardTitle>Training Progress</CardTitle>
            <Badge
              variant={
                trainingJob.status === 'completed' ? 'success' :
                trainingJob.status === 'failed' ? 'error' : 'info'
              }
              className="ml-auto"
            >
              {trainingJob.status.toUpperCase()}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              {trainingJob.status === 'running' && (
                <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
              )}
              {trainingJob.status === 'completed' && (
                <CheckCircle2 className="h-5 w-5 text-status-ok flex-shrink-0" />
              )}
              {trainingJob.status === 'failed' && (
                <XCircle className="h-5 w-5 text-status-err flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">{trainingJob.progress}</div>
                {trainingJob.error && (
                  <div className="text-xs text-status-err mt-1">{trainingJob.error}</div>
                )}
              </div>
            </div>

            {trainingJob.status === 'running' && (
              <Progress value={undefined} className="h-1.5" />
            )}

            {/* CV Metrics */}
            {trainingJob.metrics && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {trainingJob.metrics.spearman_rho_mean != null && (
                  <MetricCard label="Spearman ρ" value={(trainingJob.metrics.spearman_rho_mean as number).toFixed(3)} />
                )}
                {trainingJob.metrics.auc_mean != null && (
                  <MetricCard label="AUC" value={(trainingJob.metrics.auc_mean as number).toFixed(3)} />
                )}
                {trainingJob.metrics.brier_mean != null && (
                  <MetricCard label="Brier Score" value={(trainingJob.metrics.brier_mean as number).toFixed(3)} />
                )}
                {trainingJob.metrics.n_samples != null && (
                  <MetricCard label="Training Samples" value={String(trainingJob.metrics.n_samples)} />
                )}
                {trainingJob.metrics.tau != null && (
                  <MetricCard label="Threshold τ" value={(trainingJob.metrics.tau as number).toFixed(2)} />
                )}
                {trainingJob.metrics.k_folds != null && (
                  <MetricCard label="K-Folds" value={String(trainingJob.metrics.k_folds)} />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Models Registry ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <Beaker className="h-3.5 w-3.5 text-muted-foreground" />
          <CardTitle>Model Registry</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={fetchModels}>
            <RotateCcw className={cn("h-3 w-3", loadingModels && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No trained models yet. Upload a dataset to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((m) => (
                <div
                  key={m.version}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    m.is_active
                      ? 'border-status-ok/30 bg-status-ok-bg'
                      : 'border-border bg-muted/5 hover:bg-muted/10'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{m.version}</span>
                      {m.is_active && (
                        <Badge variant="success">ACTIVE</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-3">
                      <span>{m.feature_mode}</span>
                      {m.n_train && <span>{m.n_train} samples</span>}
                      {m.tau && <span>τ={m.tau.toFixed(2)}</span>}
                      {m.trained_at && (
                        <span>{new Date(m.trained_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {!m.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => handleDeploy(m.version)}
                    >
                      <Rocket className="h-3 w-3" />
                      Deploy
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ── Subcomponent ─────────────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-center">
      <div className="text-lg font-semibold text-foreground/90">{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  )
}
