/**
 * PipelineConfigForm — auto-generated configuration form from pipeline node schemas.
 *
 * Uses the schema-on-node pattern (Langflow/ComfyUI/Airflow inspired):
 * 1. If a node has embedded `input_schema` → render typed fields with labels,
 *    descriptions, validation constraints, and enum dropdowns.
 * 2. Fallback: if no schema, try matching against YAML registry tools.
 * 3. Last resort: infer types from raw `node.parameters` values.
 *
 * Pipeline-level params (max_rounds, etc.) are rendered in a separate section.
 */

import { useState, useMemo, useCallback } from 'react'
import { Save, Trash2, ChevronDown, Settings2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PipelineNodeDef, NodeFieldSchema } from '@/features/lab/types'
import type { Tool } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────

export interface ConfigField {
  key: string           // Unique key: `nodeId::inputName`
  nodeId: string
  nodeLabel: string
  inputName: string
  inputType: string
  label: string
  description?: string
  defaultValue?: unknown
  isWired: boolean
  wiredFrom?: string
  // Validation metadata from schema
  minimum?: number
  maximum?: number
  required?: boolean
  enumValues?: unknown[]
  enumLabels?: string[]
  section?: string
}

interface ConfigPreset {
  name: string
  values: Record<string, unknown>
  createdAt: string
}

interface PipelineConfigFormProps {
  pipelineId: string
  nodes: PipelineNodeDef[]
  tools: Tool[]
  pipelineParams?: NodeFieldSchema[]
  onRun: (inputs: Record<string, unknown>) => void
  running?: boolean
}

// ── Auto-wire downstream node inputs from upstream outputs ───────────────

/**
 * For each downstream node, check if any of its inputs can be
 * auto-wired from an upstream node's outputs via `depends_on` edges.
 *
 * Matching rules (in priority order):
 *   1. Exact name match — upstream output name === downstream input name
 *   2. Type match      — upstream output type === downstream input type
 *   3. Single-output   — upstream has exactly 1 output, wire it to the
 *                         first un-wired input of matching category
 *
 * Already-wired parameters (containing `{{`) are left untouched.
 * Root nodes (no depends_on) are never modified.
 */
function autoWireNodes(
  nodes: PipelineNodeDef[],
  tools: Tool[],
): PipelineNodeDef[] {
  // Build a map: node_id → list of { name, type }
  const outputMap = new Map<string, { name: string; type: string }[]>()
  for (const node of nodes) {
    const outputs: { name: string; type: string }[] = []
    if (node.output_schema?.length) {
      for (const o of node.output_schema) outputs.push({ name: o.name, type: o.type })
    } else {
      const tool = tools.find(t => t.id === node.tool_name || t.name === node.tool_name)
      if (tool?.outputs) {
        for (const o of tool.outputs) outputs.push({ name: o.name, type: o.type })
      }
    }
    outputMap.set(node.id, outputs)
  }

  return nodes.map(node => {
    if (node.depends_on.length === 0) return node // root node

    // Determine this node's input fields
    const inputs: { name: string; type: string }[] = []
    if (node.input_schema?.length) {
      for (const s of node.input_schema) inputs.push({ name: s.name, type: s.type })
    } else {
      const tool = tools.find(t => t.id === node.tool_name || t.name === node.tool_name)
      if (tool?.inputs) {
        for (const inp of tool.inputs) inputs.push({ name: inp.name, type: inp.type })
      } else if (node.parameters) {
        for (const key of Object.keys(node.parameters)) inputs.push({ name: key, type: 'string' })
      }
    }

    const wiredParams = { ...node.parameters }
    const usedUpstream = new Set<string>() // track used upstream outputs

    for (const input of inputs) {
      // Skip if already wired
      const currentVal = wiredParams[input.name]
      if (typeof currentVal === 'string' && currentVal.includes('{{')) continue
      // Skip object params that are composite wiring (like tool_scores)
      if (typeof currentVal === 'object' && currentVal !== null && !Array.isArray(currentVal)) {
        const stringified = JSON.stringify(currentVal)
        if (stringified.includes('{{')) continue
      }

      // Try each upstream in depends_on order
      let matched = false
      for (const upstreamId of node.depends_on) {
        const upOutputs = outputMap.get(upstreamId) || []
        if (upOutputs.length === 0) continue

        // Priority 1: exact name match
        const nameMatch = upOutputs.find(o => o.name === input.name && !usedUpstream.has(`${upstreamId}.${o.name}`))
        if (nameMatch) {
          wiredParams[input.name] = `{{${upstreamId}.${nameMatch.name}}}`
          usedUpstream.add(`${upstreamId}.${nameMatch.name}`)
          matched = true
          break
        }

        // Priority 2: type match (normalize types)
        const normalizedInputType = normalizeWireType(input.type)
        const typeMatch = upOutputs.find(o =>
          normalizeWireType(o.type) === normalizedInputType
          && !usedUpstream.has(`${upstreamId}.${o.name}`)
        )
        if (typeMatch) {
          wiredParams[input.name] = `{{${upstreamId}.${typeMatch.name}}}`
          usedUpstream.add(`${upstreamId}.${typeMatch.name}`)
          matched = true
          break
        }
      }

      // Priority 3: single-output shortcut (only if single upstream with single output)
      if (!matched && node.depends_on.length === 1) {
        const upOutputs = outputMap.get(node.depends_on[0]) || []
        if (upOutputs.length === 1 && !usedUpstream.has(`${node.depends_on[0]}.${upOutputs[0].name}`)) {
          wiredParams[input.name] = `{{${node.depends_on[0]}.${upOutputs[0].name}}}`
          usedUpstream.add(`${node.depends_on[0]}.${upOutputs[0].name}`)
        }
      }
    }

    return { ...node, parameters: wiredParams }
  })
}

/** Normalize wire types for matching (e.g. 'str' → 'string', 'artifact_path' → 'string'). */
function normalizeWireType(t: string): string {
  const lower = t.toLowerCase().replace(/\s/g, '')
  if (['str', 'string', 'sequence', 'artifact_path'].includes(lower)) return 'string'
  if (['int', 'integer'].includes(lower)) return 'integer'
  if (['float', 'number'].includes(lower)) return 'number'
  if (['bool', 'boolean'].includes(lower)) return 'boolean'
  if (lower.startsWith('list')) return 'list'
  if (lower === 'dict' || lower === 'object') return 'object'
  return lower
}

// ── Derive configurable fields ───────────────────────────────────────────

function deriveConfigFields(
  nodes: PipelineNodeDef[],
  tools: Tool[],
): ConfigField[] {
  // Auto-wire downstream nodes before deriving fields so wired inputs
  // are correctly classified as non-editable.
  const wiredNodes = autoWireNodes(nodes, tools)
  const fields: ConfigField[] = []

  for (const node of wiredNodes) {
    // ── Path 1: Embedded schema (CORE templates + properly configured nodes)
    if (node.input_schema && node.input_schema.length > 0) {
      for (const schemaField of node.input_schema) {
        const paramVal = node.parameters?.[schemaField.name]
        const isPlaceholder = typeof paramVal === 'string' && paramVal.includes('{{')
        const isNestedObj = typeof paramVal === 'object' && paramVal !== null && !Array.isArray(paramVal)
        const isWired = isPlaceholder || isNestedObj

        fields.push({
          key: `${node.id}::${schemaField.name}`,
          nodeId: node.id,
          nodeLabel: node.label || node.tool_name,
          inputName: schemaField.name,
          inputType: schemaField.type,
          label: schemaField.label || schemaField.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: schemaField.description,
          defaultValue: node.parameters?.[schemaField.name] ?? schemaField.default,
          isWired,
          wiredFrom: isWired ? String(paramVal) : undefined,
          minimum: schemaField.minimum,
          maximum: schemaField.maximum,
          required: schemaField.required,
          enumValues: schemaField.enum,
          enumLabels: schemaField.enumLabels,
          section: schemaField.section,
        })
      }
      continue
    }

    // ── Path 2: YAML registry tool lookup (CUSTOM pipelines)
    const tool = tools.find(t => t.id === node.tool_name || t.name === node.tool_name)
    if (tool) {
      for (const input of tool.inputs) {
        const paramVal = node.parameters?.[input.name]
        const isPlaceholder = typeof paramVal === 'string' && paramVal.includes('{{')
        const isNestedObj = typeof paramVal === 'object' && paramVal !== null && !Array.isArray(paramVal)
        const isWired = isPlaceholder || isNestedObj

        fields.push({
          key: `${node.id}::${input.name}`,
          nodeId: node.id,
          nodeLabel: node.label || tool.name,
          inputName: input.name,
          inputType: input.type,
          label: input.description || input.name,
          description: input.description,
          defaultValue: node.parameters?.[input.name] ?? input.default,
          isWired,
          wiredFrom: isWired ? String(paramVal) : undefined,
        })
      }
      continue
    }

    // ── Path 3: Fallback — infer from raw node.parameters
    if (node.parameters && Object.keys(node.parameters).length > 0) {
      for (const [paramName, paramValue] of Object.entries(node.parameters)) {
        const isPlaceholder = typeof paramValue === 'string' && paramValue.includes('{{')
        const isNestedObj = typeof paramValue === 'object' && paramValue !== null && !Array.isArray(paramValue)

        if (isPlaceholder || isNestedObj) {
          fields.push({
            key: `${node.id}::${paramName}`,
            nodeId: node.id,
            nodeLabel: node.label || node.tool_name,
            inputName: paramName,
            inputType: 'string',
            label: paramName,
            defaultValue: paramValue,
            isWired: true,
            wiredFrom: isPlaceholder ? String(paramValue) : 'auto-wired',
          })
          continue
        }

        let inputType = 'string'
        if (typeof paramValue === 'number') inputType = Number.isInteger(paramValue) ? 'integer' : 'number'
        else if (typeof paramValue === 'boolean') inputType = 'boolean'
        else if (Array.isArray(paramValue)) inputType = 'list'

        fields.push({
          key: `${node.id}::${paramName}`,
          nodeId: node.id,
          nodeLabel: node.label || node.tool_name,
          inputName: paramName,
          inputType,
          label: paramName,
          defaultValue: paramValue,
          isWired: false,
        })
      }
    }
  }

  return fields
}

// ── Widget map ───────────────────────────────────────────────────────────

function normalizeType(t: string): string {
  const lower = t.toLowerCase().replace(/\s/g, '')
  if (['str', 'string', 'sequence'].includes(lower)) return 'string'
  if (['int', 'integer'].includes(lower)) return 'integer'
  if (['float', 'number'].includes(lower)) return 'number'
  if (['bool', 'boolean'].includes(lower)) return 'boolean'
  if (lower.startsWith('list') || lower.startsWith('array')) return 'list'
  if (lower === 'enum') return 'enum'
  return 'string'
}

function FieldWidget({
  field,
  value,
  onChange,
}: {
  field: ConfigField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const type = normalizeType(field.inputType)

  // Enum → dropdown select
  if (type === 'enum' && field.enumValues?.length) {
    return (
      <select
        value={String(value ?? field.defaultValue ?? '')}
        onChange={e => onChange(e.target.value)}
        className="h-8 w-full rounded-md border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {field.enumValues.map((v, i) => (
          <option key={i} value={String(v)}>
            {field.enumLabels?.[i] ?? String(v)}
          </option>
        ))}
      </select>
    )
  }

  if (type === 'boolean') {
    return (
      <Toggle
        checked={!!value}
        onChange={v => onChange(v)}
        label={value ? 'On' : 'Off'}
        className="h-8"
      />
    )
  }

  if (type === 'integer') {
    return (
      <Input
        type="number"
        step={1}
        min={field.minimum}
        max={field.maximum}
        value={value != null ? String(value) : ''}
        onChange={e => onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
        className="h-8 text-xs font-mono"
      />
    )
  }

  if (type === 'number') {
    return (
      <Input
        type="number"
        step={0.1}
        min={field.minimum}
        max={field.maximum}
        value={value != null ? String(value) : ''}
        onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
        className="h-8 text-xs font-mono"
      />
    )
  }

  if (type === 'list') {
    const listVal = Array.isArray(value) ? value.join('\n') : String(value ?? '')
    return (
      <textarea
        value={listVal}
        onChange={e => onChange(e.target.value.split('\n').filter(Boolean))}
        className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="One item per line"
      />
    )
  }

  // Default: string
  return (
    <Input
      type="text"
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      className="h-8 text-xs font-mono"
    />
  )
}

// ── Preset management ────────────────────────────────────────────────────

function getPresets(pipelineId: string): ConfigPreset[] {
  try {
    const raw = localStorage.getItem(`synqlab:pipeline-presets:${pipelineId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePreset(pipelineId: string, preset: ConfigPreset) {
  const presets = getPresets(pipelineId)
  presets.push(preset)
  localStorage.setItem(`synqlab:pipeline-presets:${pipelineId}`, JSON.stringify(presets))
}

function deletePreset(pipelineId: string, name: string) {
  const presets = getPresets(pipelineId).filter(p => p.name !== name)
  localStorage.setItem(`synqlab:pipeline-presets:${pipelineId}`, JSON.stringify(presets))
}

// ── Main component ───────────────────────────────────────────────────────

export function PipelineConfigForm({
  pipelineId,
  nodes,
  tools,
  pipelineParams,
  onRun,
  running,
}: PipelineConfigFormProps) {
  const fields = useMemo(() => deriveConfigFields(nodes, tools), [nodes, tools])
  const userFields = useMemo(() => fields.filter(f => !f.isWired), [fields])
  const wiredFields = useMemo(() => fields.filter(f => f.isWired), [fields])

  // Pipeline-level param fields
  const pipelineFields = useMemo<ConfigField[]>(() => {
    if (!pipelineParams?.length) return []
    return pipelineParams.map(p => ({
      key: p.name,
      nodeId: '__pipeline__',
      nodeLabel: 'Pipeline',
      inputName: p.name,
      inputType: p.type,
      label: p.label || p.name,
      description: p.description,
      defaultValue: p.default,
      isWired: false,
      minimum: p.minimum,
      maximum: p.maximum,
      required: p.required,
      enumValues: p.enum,
      enumLabels: p.enumLabels,
      section: p.section,
    }))
  }, [pipelineParams])

  // Group user fields by node
  const groupedFields = useMemo(() => {
    const groups = new Map<string, { label: string; fields: ConfigField[] }>()
    for (const f of userFields) {
      const existing = groups.get(f.nodeId)
      if (existing) {
        existing.fields.push(f)
      } else {
        groups.set(f.nodeId, { label: f.nodeLabel, fields: [f] })
      }
    }
    return groups
  }, [userFields])

  // Initialize node-level values from defaults
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const f of userFields) {
      if (f.defaultValue != null) init[f.key] = f.defaultValue
    }
    return init
  })

  // Initialize pipeline-level values from defaults
  const [pipelineValues, setPipelineValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const f of pipelineFields) {
      if (f.defaultValue != null) init[f.key] = f.defaultValue
    }
    return init
  })

  const [presets, setPresets] = useState(() => getPresets(pipelineId))
  const [showPresets, setShowPresets] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateValue = useCallback((key: string, val: unknown) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }, [])

  const updatePipelineValue = useCallback((key: string, val: unknown) => {
    setPipelineValues(prev => ({ ...prev, [key]: val }))
  }, [])

  const handleRun = useCallback(() => {
    // Send node-scoped keys ("propose::n") so backend can route to correct node
    const inputs: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(values)) {
      if (val != null) inputs[key] = val
    }
    // Pipeline-level params (flat keys like "max_rounds")
    for (const [key, val] of Object.entries(pipelineValues)) {
      if (val != null) inputs[key] = val
    }
    onRun(inputs)
  }, [values, pipelineValues, onRun])

  const handleSavePreset = useCallback(() => {
    const name = prompt('Preset name:')
    if (!name?.trim()) return
    const preset: ConfigPreset = {
      name: name.trim(),
      values: { ...values, ...pipelineValues },
      createdAt: new Date().toISOString(),
    }
    savePreset(pipelineId, preset)
    setPresets(getPresets(pipelineId))
  }, [pipelineId, values, pipelineValues])

  const handleLoadPreset = useCallback((preset: ConfigPreset) => {
    // Split preset values into node vs pipeline
    const nodeVals: Record<string, unknown> = {}
    const pipVals: Record<string, unknown> = {}
    const pipKeys = new Set(pipelineFields.map(f => f.key))
    for (const [key, val] of Object.entries(preset.values)) {
      if (pipKeys.has(key)) pipVals[key] = val
      else nodeVals[key] = val
    }
    setValues(nodeVals)
    setPipelineValues(pipVals)
    setShowPresets(false)
  }, [pipelineFields])

  const handleDeletePreset = useCallback((name: string) => {
    deletePreset(pipelineId, name)
    setPresets(getPresets(pipelineId))
  }, [pipelineId])

  // Separate advanced pipeline fields from regular ones
  const advancedFields = pipelineFields.filter(f => f.section === 'Advanced')
  const hasAdvanced = advancedFields.length > 0

  if (userFields.length === 0 && pipelineFields.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-[12px] text-muted-foreground">
          This pipeline has no user-configurable inputs — all parameters are auto-wired.
        </div>
        {wiredFields.length > 0 && (
          <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-green" />
            {wiredFields.length} input{wiredFields.length !== 1 ? 's' : ''} auto-wired from upstream nodes
          </div>
        )}
        <Button
          onClick={() => onRun({})}
          disabled={running}
          className="gap-1.5"
        >
          {running ? (
            <>
              <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>▶ Run Pipeline</>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Presets bar */}
      {presets.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Presets ({presets.length})</span>
            <ChevronDown size={11} className={cn('transition-transform', showPresets && 'rotate-180')} />
          </button>
          {showPresets && (
            <div className="absolute z-10 mt-1 w-56 rounded-md border border-border bg-card shadow-lg py-1">
              {presets.map(p => (
                <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50">
                  <button
                    type="button"
                    onClick={() => handleLoadPreset(p)}
                    className="flex-1 text-left text-[11px] text-foreground truncate"
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(p.name)}
                    className="text-muted-foreground/50 hover:text-status-red"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Field groups by node */}
      {Array.from(groupedFields.entries()).map(([nodeId, group]) => (
        <div key={nodeId} className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {group.label}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.fields.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-[11px] font-medium text-foreground">
                  {f.label}
                  {f.required && <span className="text-status-red ml-0.5">*</span>}
                </label>
                {f.description && (
                  <p className="text-[10px] text-muted-foreground/70 leading-snug">{f.description}</p>
                )}
                <FieldWidget
                  field={f}
                  value={values[f.key]}
                  onChange={v => updateValue(f.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Pipeline-level Advanced settings */}
      {hasAdvanced && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <Settings2 size={11} />
            <span>Advanced</span>
            <ChevronDown size={10} className={cn('transition-transform', showAdvanced && 'rotate-180')} />
          </button>
          {showAdvanced && (
            <div className="grid gap-3 sm:grid-cols-2 pl-4 border-l-2 border-border">
              {advancedFields.map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">
                    {f.label}
                  </label>
                  {f.description && (
                    <p className="text-[10px] text-muted-foreground/70 leading-snug">{f.description}</p>
                  )}
                  <FieldWidget
                    field={f}
                    value={pipelineValues[f.key]}
                    onChange={v => updatePipelineValue(f.key, v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wired fields indicator */}
      {wiredFields.length > 0 && (
        <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-status-green" />
          {wiredFields.length} input{wiredFields.length !== 1 ? 's' : ''} auto-wired from upstream nodes
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          onClick={handleRun}
          disabled={running}
          className="gap-1.5"
        >
          {running ? (
            <>
              <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>▶ Run Pipeline</>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSavePreset}
          className="gap-1.5 text-[11px]"
        >
          <Save size={12} /> Save Preset
        </Button>
      </div>
    </div>
  )
}
