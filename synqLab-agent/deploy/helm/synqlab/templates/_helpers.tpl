{{/*
SynqLab Helm Chart — Template Helpers
*/}}

{{/* ── Name helpers ─────────────────────────────────────────── */}}

{{- define "synqlab.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "synqlab.fullname" -}}
{{- if .Values.fullnameOverride }}
  {{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
  {{- $name := default .Chart.Name .Values.nameOverride }}
  {{- if contains $name .Release.Name }}
    {{- .Release.Name | trunc 63 | trimSuffix "-" }}
  {{- else }}
    {{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
  {{- end }}
{{- end }}
{{- end }}

{{- define "synqlab.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* ── Label helpers ────────────────────────────────────────── */}}

{{- define "synqlab.labels" -}}
helm.sh/chart: {{ include "synqlab.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: synqlab
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Selector labels for a component.
Usage: {{ include "synqlab.selectorLabels" (dict "component" "app" "root" .) }}
*/}}
{{- define "synqlab.selectorLabels" -}}
app.kubernetes.io/name: {{ include "synqlab.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/* ── Service Account ──────────────────────────────────────── */}}

{{- define "synqlab.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
  {{- default (include "synqlab.fullname" .) .Values.serviceAccount.name }}
{{- else }}
  {{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* ── Image resolution ─────────────────────────────────────── */}}

{{/*
Full image reference for a component.
Usage: {{ include "synqlab.image" (dict "image" .Values.gateway.image "registry" .Values.imageRegistry) }}
*/}}
{{- define "synqlab.image" -}}
{{- $tag := (.image.tag | default "latest" | toString) -}}
{{- if .registry -}}
  {{- printf "%s/%s:%s" .registry .image.repository $tag -}}
{{- else -}}
  {{- printf "%s:%s" .image.repository $tag -}}
{{- end -}}
{{- end }}

{{/* ── Database URL ─────────────────────────────────────────── */}}

{{- define "synqlab.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
  {{- printf "postgresql://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.auth.username "$(POSTGRES_PASSWORD)" (include "synqlab.fullname" .) .Values.postgresql.auth.database }}
{{- else }}
  {{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}

{{/* ── Tool service URL builder (for configmap) ─────────────── */}}

{{/*
Generates the full in-cluster URL for a tool.
Usage: {{ include "synqlab.toolUrl" (dict "name" "protgpt2" "tool" .Values.tools.protgpt2 "root" .) }}
*/}}
{{- define "synqlab.toolUrl" -}}
http://{{ include "synqlab.fullname" .root }}-{{ .name }}:{{ .tool.port }}
{{- end }}

{{/* ── Security context helpers ─────────────────────────────── */}}

{{/*
Pod-level security context (merged with defaults).
Usage: {{ include "synqlab.podSecurityContext" . }}
*/}}
{{- define "synqlab.podSecurityContext" -}}
{{- toYaml .Values.podSecurityDefaults }}
{{- end }}

{{/*
Container-level security context (merged with defaults).
Usage: {{ include "synqlab.containerSecurityContext" . }}
*/}}
{{- define "synqlab.containerSecurityContext" -}}
{{- toYaml .Values.containerSecurityDefaults }}
{{- end }}
