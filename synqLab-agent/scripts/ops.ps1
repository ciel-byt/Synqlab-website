# SynqLab Operations CLI
# Usage: .\ops.ps1 <command>

param(
    [Parameter(Position = 0)]
    [string]$Command,

    [Parameter(Position = 1, ValueFromRemainingArguments)]
    [string[]]$ExtraArgs
)

# -- Config -----------------------------------------------------------
$NAMESPACE     = "synqlab"
$RELEASE       = "synqlab"
$CHART_PATH    = Join-Path (Split-Path $PSScriptRoot) "deploy\helm\synqlab"
$GATEWAY_PORT  = 8000

# GCP config
$GCP_PROJECT   = "project-41f6f4ea-8a21-4190-a8a"
$GCP_REGION    = "us-central1"
$GKE_CLUSTER   = "synqlab-cluster-dev"
$AR_REGISTRY   = "$GCP_REGION-docker.pkg.dev"

$SERVICES = @{
    gateway   = @{ svc = "svc/synqlab-gateway";  local = 8000; remote = 8000 }
    protgpt2  = @{ svc = "svc/synqlab-protgpt2"; local = 8001; remote = 8001 }
    omegafold = @{ svc = "svc/synqlab-omegafold"; local = 8002; remote = 8002 }
    foldx     = @{ svc = "svc/synqlab-foldx";     local = 8003; remote = 8003 }
    reranker  = @{ svc = "svc/synqlab-reranker";   local = 8004; remote = 8004 }
}

# -- Helpers ----------------------------------------------------------
function Write-Header($text) {
    Write-Host ""
    Write-Host "  ================================================" -ForegroundColor DarkCyan
    Write-Host "   $text" -ForegroundColor Cyan
    Write-Host "  ================================================" -ForegroundColor DarkCyan
    Write-Host ""
}

function Assert-Kubectl {
    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
        Write-Host "  [X] kubectl not found. Install it first." -ForegroundColor Red
        exit 1
    }
}

function Assert-Helm {
    if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
        Write-Host "  [X] helm not found. Install it first." -ForegroundColor Red
        exit 1
    }
}

# -- Commands ---------------------------------------------------------

function Invoke-Login {
    Write-Header "GCP Login & Cluster Auth"

    # [1] Check gcloud is installed
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Host "  [X] gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
        exit 1
    }

    # [2] Authenticate with Google Cloud
    Write-Host "  [1/4] Authenticating with GCP..." -ForegroundColor Yellow
    gcloud auth login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [X] gcloud auth login failed." -ForegroundColor Red
        return
    }
    Write-Host "        [OK] Authenticated." -ForegroundColor Green

    # [3] Set project
    Write-Host "  [2/4] Setting project to $GCP_PROJECT..." -ForegroundColor Yellow
    gcloud config set project $GCP_PROJECT
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [X] Failed to set project." -ForegroundColor Red
        return
    }
    Write-Host "        [OK] Project set." -ForegroundColor Green

    # [4] Get GKE credentials (configures kubectl)
    Write-Host "  [3/4] Fetching GKE credentials for $GKE_CLUSTER..." -ForegroundColor Yellow
    gcloud container clusters get-credentials $GKE_CLUSTER --region $GCP_REGION --project $GCP_PROJECT
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [X] Failed to get cluster credentials." -ForegroundColor Red
        return
    }
    Write-Host "        [OK] kubectl configured for $GKE_CLUSTER." -ForegroundColor Green

    # [5] Configure Docker for Artifact Registry
    Write-Host "  [4/4] Configuring Docker for Artifact Registry ($AR_REGISTRY)..." -ForegroundColor Yellow
    gcloud auth configure-docker $AR_REGISTRY --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [X] Docker auth config failed." -ForegroundColor Red
        return
    }
    Write-Host "        [OK] Docker configured." -ForegroundColor Green

    # Summary
    Write-Host ""
    Write-Host "  All done! Current context:" -ForegroundColor Cyan
    kubectl config current-context
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Cyan
    Write-Host "    .\ops.ps1 status       -- check cluster status" -ForegroundColor White
    Write-Host "    .\ops.ps1 dashboard    -- open Headlamp" -ForegroundColor White
    Write-Host "    .\ops.ps1 install      -- deploy SynqLab stack" -ForegroundColor White
}

function Invoke-Dashboard {
    Assert-Kubectl
    Write-Header "Headlamp Dashboard"

    # Kill any stale port-forward and start fresh
    $existing = Get-NetTCPConnection -LocalPort 4466 -ErrorAction SilentlyContinue
    if ($existing) {
        $proc = Get-Process -Id $existing.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "kubectl") {
            Write-Host "  [OK] Port 4466 already forwarded, reusing." -ForegroundColor Green
        } else {
            # Stale connection — kill and re-forward
            if ($proc) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
            Start-Sleep 1
            $job = Start-Job -ScriptBlock {
                kubectl port-forward svc/headlamp 4466:80 -n headlamp
            }
            Write-Host "  [OK] Headlamp re-forwarded at http://localhost:4466 (job $($job.Id))" -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
    } else {
        $job = Start-Job -ScriptBlock {
            kubectl port-forward svc/headlamp 4466:80 -n headlamp
        }
        Write-Host "  [OK] Headlamp forwarded at http://localhost:4466 (job $($job.Id))" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }

    # Generate token and copy to clipboard
    Write-Host ""
    Write-Host "  Generating auth token..." -ForegroundColor Yellow
    $token = kubectl create token headlamp --namespace headlamp 2>$null
    if (-not $token) {
        # Fallback: try default SA
        $token = kubectl create token default --namespace headlamp 2>$null
    }
    if ($token) {
        Set-Clipboard -Value $token
        Write-Host "  [OK] Token copied to clipboard! Paste it in the login screen." -ForegroundColor Green
    } else {
        Write-Host "  [!] Could not generate token. You may need to create a ServiceAccount." -ForegroundColor Yellow
    }

    Write-Host ""
    Start-Process "http://localhost:4466"
    Write-Host "  To stop:  .\ops.ps1 stop" -ForegroundColor DarkGray
}

function Invoke-Install {
    Assert-Kubectl
    Assert-Helm
    Write-Header "Install SynqLab Stack"

    # --- Headlamp dashboard ---
    Write-Host "  [1/3] Installing Headlamp dashboard..." -ForegroundColor Yellow
    $hlNs = kubectl get ns headlamp -o name 2>$null
    if (-not $hlNs) {
        kubectl create namespace headlamp | Out-Null
    }
    $hlRelease = helm list -n headlamp -q 2>$null | Select-String "headlamp"
    if ($hlRelease) {
        Write-Host "        Headlamp already installed, skipping." -ForegroundColor DarkGray
    } else {
        helm repo add headlamp https://headlamp-k8s.github.io/headlamp/ 2>$null
        helm repo update headlamp 2>$null
        helm install headlamp headlamp/headlamp --namespace headlamp `
            --set clusterRoleBinding.create=true `
            --set serviceAccount.create=true
        if ($LASTEXITCODE -eq 0) {
            Write-Host "        [OK] Headlamp installed." -ForegroundColor Green
        } else {
            Write-Host "        [X] Headlamp install failed." -ForegroundColor Red
        }
    }

    # --- SynqLab namespace ---
    Write-Host "  [2/3] Creating namespace $NAMESPACE..." -ForegroundColor Yellow
    $slNs = kubectl get ns $NAMESPACE -o name 2>$null
    if (-not $slNs) {
        kubectl create namespace $NAMESPACE | Out-Null
        Write-Host "        [OK] Namespace created." -ForegroundColor Green
    } else {
        Write-Host "        Already exists, skipping." -ForegroundColor DarkGray
    }

    # --- SynqLab Helm chart ---
    Write-Host "  [3/3] Installing SynqLab Helm chart..." -ForegroundColor Yellow
    Write-Host "        Chart: $CHART_PATH" -ForegroundColor White
    helm upgrade --install $RELEASE $CHART_PATH -n $NAMESPACE --create-namespace
    if ($LASTEXITCODE -eq 0) {
        Write-Host "        [OK] SynqLab deployed!" -ForegroundColor Green
    } else {
        Write-Host "        [X] Deploy failed (exit $LASTEXITCODE)" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Cyan
    Write-Host "    .\ops.ps1 dashboard    -- open Headlamp" -ForegroundColor White
    Write-Host "    .\ops.ps1 status       -- check pod status" -ForegroundColor White
}

function Invoke-Forward {
    Assert-Kubectl
    Write-Header "Port Forward -- Gateway"

    $existing = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    if ($existing) {
        $proc = Get-Process -Id $existing.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "kubectl") {
            Write-Host "  [OK] Gateway already forwarded at http://localhost:8000, reusing." -ForegroundColor Green
        } else {
            if ($proc) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
            Start-Sleep 1
            $job = Start-Job -ScriptBlock {
                param($ns) kubectl port-forward svc/synqlab-gateway 8000:8000 -n $ns
            } -ArgumentList $NAMESPACE
            Write-Host "  [OK] Gateway re-forwarded at http://localhost:8000 (job $($job.Id))" -ForegroundColor Green
        }
    } else {
        $job = Start-Job -ScriptBlock {
            param($ns) kubectl port-forward svc/synqlab-gateway 8000:8000 -n $ns
        } -ArgumentList $NAMESPACE
        Write-Host "  [OK] Gateway forwarded at http://localhost:8000 (job $($job.Id))" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  To stop:  .\ops.ps1 stop" -ForegroundColor DarkGray
    Start-Process "http://localhost:8000"
}

function Invoke-ForwardAll {
    Assert-Kubectl
    Write-Header "Port Forward -- All Services"

    foreach ($name in $SERVICES.Keys) {
        $svc = $SERVICES[$name]
        $localPort  = $svc.local
        $remotePort = $svc.remote
        $svcTarget  = $svc.svc
        $label = $name.PadRight(12)

        $existing = Get-NetTCPConnection -LocalPort $localPort -ErrorAction SilentlyContinue
        if ($existing) {
            $proc = Get-Process -Id $existing.OwningProcess -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "kubectl") {
                Write-Host "  [OK] $label http://localhost:$localPort  (reusing)" -ForegroundColor Green
                continue
            } else {
                if ($proc) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
                Start-Sleep -Milliseconds 500
            }
        }

        $job = Start-Job -ScriptBlock {
            param($s, $lp, $rp, $ns)
            kubectl port-forward $s "${lp}:${rp}" -n $ns
        } -ArgumentList $svcTarget, $localPort, $remotePort, $NAMESPACE

        Write-Host "  [OK] $label http://localhost:$localPort  (job $($job.Id))" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  To stop:  .\ops.ps1 stop" -ForegroundColor DarkGray
    Start-Process "http://localhost:8000"
}

function Invoke-Upgrade {
    Assert-Helm
    Write-Header "Helm Upgrade"

    Write-Host "  Chart:     $CHART_PATH" -ForegroundColor White
    Write-Host "  Release:   $RELEASE" -ForegroundColor White
    Write-Host "  Namespace: $NAMESPACE" -ForegroundColor White
    Write-Host ""

    helm upgrade $RELEASE $CHART_PATH -n $NAMESPACE

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  [OK] Upgrade complete!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  [X] Upgrade failed (exit $LASTEXITCODE)" -ForegroundColor Red
    }
}

function Invoke-Status {
    Assert-Kubectl
    Write-Header "Cluster Status"

    Write-Host "  -- Pods --" -ForegroundColor Yellow
    kubectl get pods -n $NAMESPACE -o wide
    Write-Host ""
    Write-Host "  -- Services --" -ForegroundColor Yellow
    kubectl get svc -n $NAMESPACE
    Write-Host ""
    Write-Host "  -- Ingress --" -ForegroundColor Yellow
    kubectl get ingress -n $NAMESPACE
    Write-Host ""
    Write-Host "  -- PVCs --" -ForegroundColor Yellow
    kubectl get pvc -n $NAMESPACE
    Write-Host ""
    Write-Host "  -- Nodes --" -ForegroundColor Yellow
    kubectl get nodes -o wide
}

function Invoke-Logs {
    Assert-Kubectl
    $svcName = $ExtraArgs[0]

    if (-not $svcName) {
        Write-Host "  Usage: .\ops.ps1 logs <service>" -ForegroundColor Yellow
        Write-Host "  Services: gateway, protgpt2, omegafold, foldx, reranker, postgresql" -ForegroundColor DarkGray
        return
    }

    Write-Header "Logs -- $svcName"

    if ($svcName -eq "postgresql") {
        kubectl logs -l app.kubernetes.io/name=postgresql -n $NAMESPACE --tail=100 -f
    } else {
        kubectl logs -l app.kubernetes.io/component=$svcName -n $NAMESPACE --tail=100 -f
    }
}

function Invoke-Stop {
    Write-Header "Stopping Background Jobs"

    $jobs = Get-Job | Where-Object { $_.State -eq "Running" }
    if ($jobs.Count -eq 0) {
        Write-Host "  No running background jobs." -ForegroundColor DarkGray
        return
    }

    foreach ($job in $jobs) {
        Stop-Job -Id $job.Id
        Remove-Job -Id $job.Id
        Write-Host "  [OK] Stopped job $($job.Id)" -ForegroundColor Green
    }
}

function Invoke-IP {
    Assert-Kubectl
    Write-Header "Ingress IP"

    $jsonpath = "{.status.loadBalancer.ingress[0].ip}"
    $ip = kubectl get ingress synqlab-gateway -n $NAMESPACE -o jsonpath=$jsonpath 2>$null
    if ($ip) {
        Write-Host "  External IP: $ip" -ForegroundColor Green
        Write-Host "  URL:         http://$ip" -ForegroundColor White
    } else {
        Write-Host "  No external IP yet (ingress may still be provisioning)" -ForegroundColor Yellow
    }
}

function Invoke-Token {
    Assert-Kubectl
    Write-Header "Headlamp Token"

    $token = kubectl create token headlamp --namespace headlamp 2>$null
    if (-not $token) {
        $token = kubectl create token default --namespace headlamp 2>$null
    }
    if ($token) {
        Set-Clipboard -Value $token
        Write-Host "  [OK] Token copied to clipboard!" -ForegroundColor Green
    } else {
        Write-Host "  [X] Could not generate token." -ForegroundColor Red
    }
}

function Show-Help {
    Write-Header "SynqLab Ops CLI"
    Write-Host "  Usage: .\ops.ps1 <command>" -ForegroundColor White
    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor Yellow
    Write-Host "    login           GCP auth + GKE credentials + Docker registry" -ForegroundColor White
    Write-Host "    install         Install Headlamp + SynqLab Helm chart" -ForegroundColor White
    Write-Host "    dashboard       Open Kubernetes dashboard" -ForegroundColor White
    Write-Host "    forward         Port-forward gateway (background)" -ForegroundColor White
    Write-Host "    forward-all     Port-forward all services (background)" -ForegroundColor White
    Write-Host "    upgrade         Helm upgrade synqlab release" -ForegroundColor White
    Write-Host "    status          Pod, service, ingress, PVC status" -ForegroundColor White
    Write-Host "    logs <svc>      Tail logs for a service" -ForegroundColor White
    Write-Host "    stop            Stop all background port-forwards" -ForegroundColor White
    Write-Host "    ip              Get ingress external IP" -ForegroundColor White
    Write-Host "    token           Generate Headlamp token (clipboard)" -ForegroundColor White
    Write-Host ""
}

# -- Router -----------------------------------------------------------
switch ($Command) {
    "login"       { Invoke-Login }
    "install"     { Invoke-Install }
    "dashboard"   { Invoke-Dashboard }
    "forward"     { Invoke-Forward }
    "forward-all" { Invoke-ForwardAll }
    "upgrade"     { Invoke-Upgrade }
    "status"      { Invoke-Status }
    "logs"        { Invoke-Logs }
    "stop"        { Invoke-Stop }
    "ip"          { Invoke-IP }
    "token"       { Invoke-Token }
    default       { Show-Help }
}
