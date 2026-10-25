#!/usr/bin/env python3
"""SynqLab Operations CLI — cross-platform (Windows / macOS / Linux).

Usage:  python ops.py <command> [args...]

This is a 1:1 clone of ops.ps1.
"""

from __future__ import annotations

import json
import os
import platform
import signal
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────

NAMESPACE = "synqlab"
RELEASE = "synqlab"
SCRIPT_DIR = Path(__file__).resolve().parent
CHART_PATH = SCRIPT_DIR.parent / "deploy" / "helm" / "synqlab"
GATEWAY_PORT = 8000

# GCP config
GCP_PROJECT = "project-41f6f4ea-8a21-4190-a8a"
GCP_REGION = "us-central1"
GKE_CLUSTER = "synqlab-cluster-dev"
AR_REGISTRY = f"{GCP_REGION}-docker.pkg.dev"

SERVICES: dict[str, dict] = {
    "gateway":      {"svc": "svc/synqlab-gateway",      "local": 8000, "remote": 8000},
    "protgpt2":     {"svc": "svc/synqlab-protgpt2",     "local": 8001, "remote": 8001},
    "omegafold":    {"svc": "svc/synqlab-omegafold",    "local": 8002, "remote": 8002},
    "foldx":        {"svc": "svc/synqlab-foldx",        "local": 8003, "remote": 8003},
    "reranker":     {"svc": "svc/synqlab-reranker",     "local": 8004, "remote": 8004},
    "esmfold":      {"svc": "svc/synqlab-esmfold",      "local": 8005, "remote": 8005},
    "proteinmpnn":  {"svc": "svc/synqlab-proteinmpnn",  "local": 8006, "remote": 8006},
}

# PID file for tracking background port-forward processes
_PID_FILE = SCRIPT_DIR / ".ops_pids.json"

# ── Helpers ─────────────────────────────────────────────────────────────

IS_WINDOWS = platform.system() == "Windows"


class _C:
    """ANSI colour codes (disabled on Windows CMD without VT support)."""
    RESET = "\033[0m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    DARK_CYAN = "\033[36m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"


def _enable_ansi_windows() -> None:
    """Enable ANSI VT100 escape sequences on Windows 10+."""
    if not IS_WINDOWS:
        return
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_ulong()
        kernel32.GetConsoleMode(handle, ctypes.byref(mode))
        kernel32.SetConsoleMode(handle, mode.value | 0x0004)  # ENABLE_VIRTUAL_TERMINAL_PROCESSING
    except Exception:
        pass


def header(text: str) -> None:
    print()
    print(f"  {_C.DARK_CYAN}================================================{_C.RESET}")
    print(f"   {_C.CYAN}{text}{_C.RESET}")
    print(f"  {_C.DARK_CYAN}================================================{_C.RESET}")
    print()


def ok(msg: str) -> None:
    print(f"  {_C.GREEN}{msg}{_C.RESET}")


def warn(msg: str) -> None:
    print(f"  {_C.YELLOW}{msg}{_C.RESET}")


def err(msg: str) -> None:
    print(f"  {_C.RED}{msg}{_C.RESET}")


def info(msg: str) -> None:
    print(f"  {_C.WHITE}{msg}{_C.RESET}")


def gray(msg: str) -> None:
    print(f"  {_C.GRAY}{msg}{_C.RESET}")


def which(cmd: str) -> bool:
    """Check if a CLI tool is on PATH."""
    import shutil
    return shutil.which(cmd) is not None


def assert_cmd(cmd: str, hint: str = "") -> None:
    if not which(cmd):
        err(f"[X] {cmd} not found.{(' ' + hint) if hint else ''}")
        sys.exit(1)


def run(args: list[str], capture: bool = False, check: bool = False, quiet: bool = False) -> subprocess.CompletedProcess:
    """Run a subprocess, inheriting stdio unless capture=True.

    On Windows, shell=True is needed so that .cmd/.bat wrappers
    (e.g. gcloud.cmd, helm.cmd) are resolved by the shell.
    """
    stderr_target = subprocess.DEVNULL if quiet else (subprocess.PIPE if capture else None)
    stdout_target = subprocess.PIPE if capture else None
    result = subprocess.run(args, stdout=stdout_target, stderr=stderr_target, text=True, shell=IS_WINDOWS)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(args)}")
    return result


def port_in_use(port: int) -> bool:
    """Check if a local TCP port is in use (cross-platform)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def clipboard_copy(text: str) -> bool:
    """Copy text to clipboard (cross-platform)."""
    try:
        if IS_WINDOWS:
            subprocess.run(["clip"], input=text.encode(), check=True)
        elif platform.system() == "Darwin":
            subprocess.run(["pbcopy"], input=text.encode(), check=True)
        else:
            # Linux — try xclip, then xsel
            try:
                subprocess.run(["xclip", "-selection", "clipboard"], input=text.encode(), check=True)
            except FileNotFoundError:
                subprocess.run(["xsel", "--clipboard", "--input"], input=text.encode(), check=True)
        return True
    except Exception:
        return False


def open_url(url: str) -> None:
    """Open a URL in the default browser (cross-platform)."""
    webbrowser.open(url)


def _load_pids() -> dict[str, int]:
    if _PID_FILE.exists():
        try:
            return json.loads(_PID_FILE.read_text())
        except Exception:
            pass
    return {}


def _save_pids(pids: dict[str, int]) -> None:
    _PID_FILE.write_text(json.dumps(pids, indent=2))


def _kill_pid(pid: int) -> bool:
    """Kill a process by PID (cross-platform)."""
    try:
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            os.kill(pid, signal.SIGTERM)
        return True
    except (ProcessLookupError, PermissionError, OSError):
        return False


def _pid_alive(pid: int) -> bool:
    """Check if a process is still running."""
    try:
        if IS_WINDOWS:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}"],
                capture_output=True, text=True,
            )
            return str(pid) in result.stdout
        else:
            os.kill(pid, 0)  # signal 0 = existence check
            return True
    except (ProcessLookupError, PermissionError, OSError):
        return False


def _start_port_forward(svc_target: str, local_port: int, remote_port: int, label: str, ns: str = NAMESPACE) -> None:
    """Start a background kubectl port-forward and track its PID."""
    if port_in_use(local_port):
        # Check if it's one of our tracked PIDs
        pids = _load_pids()
        tracked_pid = pids.get(label)
        if tracked_pid and _pid_alive(tracked_pid):
            ok(f"[OK] {label:<12} http://localhost:{local_port}  (reusing, pid {tracked_pid})")
            return
        # Port is in use by something else — skip
        warn(f"[!]  {label:<12} port {local_port} already in use, skipping")
        return

    cmd = ["kubectl", "port-forward", svc_target, f"{local_port}:{remote_port}", "-n", ns]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, shell=IS_WINDOWS)

    # Give kubectl a moment to bind or fail
    time.sleep(2)

    if port_in_use(local_port):
        pids = _load_pids()
        pids[label] = proc.pid
        _save_pids(pids)
        ok(f"[OK] {label:<12} http://localhost:{local_port}  (pid {proc.pid})")
    else:
        # Port-forward likely failed — check if process exited
        ret = proc.poll()
        if ret is not None:
            stderr_out = proc.stderr.read() if proc.stderr else ""
            err(f"[X]  {label:<12} port-forward failed (exit {ret})")
            if stderr_out:
                gray(f"     {stderr_out.strip()}")
        else:
            # Process running but port not bound yet — give more time
            time.sleep(3)
            if port_in_use(local_port):
                pids = _load_pids()
                pids[label] = proc.pid
                _save_pids(pids)
                ok(f"[OK] {label:<12} http://localhost:{local_port}  (pid {proc.pid})")
            else:
                err(f"[X]  {label:<12} port-forward started but port {local_port} not reachable")


# ── Commands ────────────────────────────────────────────────────────────

def cmd_login() -> None:
    assert_cmd("gcloud", "Install: https://cloud.google.com/sdk/docs/install")
    header("GCP Login & Cluster Auth")

    # [1] Authenticate
    warn("[1/4] Authenticating with GCP...")
    r = run(["gcloud", "auth", "login"])
    if r.returncode != 0:
        err("[X] gcloud auth login failed.")
        return
    ok("      [OK] Authenticated.")

    # [2] Set project
    warn(f"[2/4] Setting project to {GCP_PROJECT}...")
    r = run(["gcloud", "config", "set", "project", GCP_PROJECT])
    if r.returncode != 0:
        err("[X] Failed to set project.")
        return
    ok("      [OK] Project set.")

    # [3] GKE credentials
    warn(f"[3/4] Fetching GKE credentials for {GKE_CLUSTER}...")
    r = run(["gcloud", "container", "clusters", "get-credentials",
             GKE_CLUSTER, "--region", GCP_REGION, "--project", GCP_PROJECT])
    if r.returncode != 0:
        err("[X] Failed to get cluster credentials.")
        return
    ok(f"      [OK] kubectl configured for {GKE_CLUSTER}.")

    # [4] Docker Artifact Registry
    warn(f"[4/4] Configuring Docker for Artifact Registry ({AR_REGISTRY})...")
    r = run(["gcloud", "auth", "configure-docker", AR_REGISTRY, "--quiet"])
    if r.returncode != 0:
        err("[X] Docker auth config failed.")
        return
    ok("      [OK] Docker configured.")

    # Summary
    print()
    print(f"  {_C.CYAN}All done! Current context:{_C.RESET}")
    run(["kubectl", "config", "current-context"])
    print()
    print(f"  {_C.CYAN}Next steps:{_C.RESET}")
    info("  python ops.py status       -- check cluster status")
    info("  python ops.py dashboard    -- open Headlamp")
    info("  python ops.py install      -- deploy SynqLab stack")


def cmd_dashboard() -> None:
    assert_cmd("kubectl")
    header("Headlamp Dashboard")

    _start_port_forward("svc/headlamp", 4466, 80, "headlamp", ns="headlamp")
    time.sleep(2)

    # Generate token
    warn("Generating auth token...")
    r = run(["kubectl", "create", "token", "headlamp", "--namespace", "headlamp"],
            capture=True, quiet=True)
    token = r.stdout.strip() if r.returncode == 0 else ""
    if not token:
        r = run(["kubectl", "create", "token", "default", "--namespace", "headlamp"],
                capture=True, quiet=True)
        token = r.stdout.strip() if r.returncode == 0 else ""

    if token:
        if clipboard_copy(token):
            ok("[OK] Token copied to clipboard! Paste it in the login screen.")
        else:
            ok("[OK] Token generated (clipboard not available):")
            print(f"      {token[:40]}...")
    else:
        warn("[!] Could not generate token. You may need to create a ServiceAccount.")

    print()
    open_url("http://localhost:4466")
    gray("To stop:  python ops.py stop")


def cmd_install() -> None:
    assert_cmd("kubectl")
    assert_cmd("helm")
    header("Install SynqLab Stack")

    # [1] Headlamp
    warn("[1/3] Installing Headlamp dashboard...")
    r = run(["kubectl", "get", "ns", "headlamp", "-o", "name"], capture=True, quiet=True)
    if r.returncode != 0:
        run(["kubectl", "create", "namespace", "headlamp"], capture=True)

    r = run(["helm", "list", "-n", "headlamp", "-q"], capture=True, quiet=True)
    if r.returncode == 0 and "headlamp" in (r.stdout or ""):
        gray("      Headlamp already installed, skipping.")
    else:
        run(["helm", "repo", "add", "headlamp", "https://headlamp-k8s.github.io/headlamp/"],
            capture=True, quiet=True)
        run(["helm", "repo", "update", "headlamp"], capture=True, quiet=True)
        r = run(["helm", "install", "headlamp", "headlamp/headlamp", "--namespace", "headlamp",
                 "--set", "clusterRoleBinding.create=true",
                 "--set", "serviceAccount.create=true"])
        if r.returncode == 0:
            ok("      [OK] Headlamp installed.")
        else:
            err("      [X] Headlamp install failed.")

    # [2] Namespace
    warn(f"[2/3] Creating namespace {NAMESPACE}...")
    r = run(["kubectl", "get", "ns", NAMESPACE, "-o", "name"], capture=True, quiet=True)
    if r.returncode != 0:
        run(["kubectl", "create", "namespace", NAMESPACE], capture=True)
        ok("      [OK] Namespace created.")
    else:
        gray("      Already exists, skipping.")

    # [3] Helm chart
    warn("[3/3] Installing SynqLab Helm chart...")
    info(f"      Chart: {CHART_PATH}")
    r = run(["helm", "upgrade", "--install", RELEASE, str(CHART_PATH),
             "-n", NAMESPACE, "--create-namespace"])
    if r.returncode == 0:
        ok("      [OK] SynqLab deployed!")
    else:
        err(f"      [X] Deploy failed (exit {r.returncode})")

    print()
    print(f"  {_C.CYAN}Next steps:{_C.RESET}")
    info("  python ops.py dashboard    -- open Headlamp")
    info("  python ops.py status       -- check pod status")


def cmd_forward() -> None:
    assert_cmd("kubectl")
    header("Port Forward -- Gateway")
    _start_port_forward("svc/synqlab-gateway", 8000, 8000, "gateway")
    print()
    gray("To stop:  python ops.py stop")
    open_url("http://localhost:8000")


def cmd_forward_all() -> None:
    assert_cmd("kubectl")
    header("Port Forward -- All Services")

    for name, svc in SERVICES.items():
        _start_port_forward(svc["svc"], svc["local"], svc["remote"], name)

    print()
    gray("To stop:  python ops.py stop")
    open_url("http://localhost:8000")


def cmd_upgrade() -> None:
    assert_cmd("helm")
    header("Helm Upgrade")

    info(f"Chart:     {CHART_PATH}")
    info(f"Release:   {RELEASE}")
    info(f"Namespace: {NAMESPACE}")
    print()

    r = run(["helm", "upgrade", RELEASE, str(CHART_PATH), "-n", NAMESPACE, "--reset-values"])
    print()
    if r.returncode == 0:
        ok("[OK] Upgrade complete!")
    else:
        err(f"[X] Upgrade failed (exit {r.returncode})")


def cmd_status() -> None:
    assert_cmd("kubectl")
    header("Cluster Status")

    warn("-- Pods --")
    run(["kubectl", "get", "pods", "-n", NAMESPACE, "-o", "wide"])
    print()
    warn("-- Services --")
    run(["kubectl", "get", "svc", "-n", NAMESPACE])
    print()
    warn("-- Ingress --")
    run(["kubectl", "get", "ingress", "-n", NAMESPACE])
    print()
    warn("-- PVCs --")
    run(["kubectl", "get", "pvc", "-n", NAMESPACE])
    print()
    warn("-- Nodes --")
    run(["kubectl", "get", "nodes", "-o", "wide"])


def cmd_logs(extra_args: list[str]) -> None:
    assert_cmd("kubectl")

    if not extra_args:
        warn("Usage: python ops.py logs <service>")
        gray("Services: gateway, protgpt2, omegafold, foldx, reranker, postgresql")
        return

    svc_name = extra_args[0]
    header(f"Logs -- {svc_name}")

    if svc_name == "postgresql":
        run(["kubectl", "logs", "-l", "app.kubernetes.io/name=postgresql",
             "-n", NAMESPACE, "--tail=100", "-f"])
    else:
        run(["kubectl", "logs", "-l", f"app.kubernetes.io/component={svc_name}",
             "-n", NAMESPACE, "--tail=100", "-f"])


def cmd_stop() -> None:
    header("Stopping Background Jobs")

    pids = _load_pids()
    if not pids:
        gray("No tracked background jobs.")
        return

    for label, pid in list(pids.items()):
        if _pid_alive(pid):
            _kill_pid(pid)
            ok(f"[OK] Stopped {label} (pid {pid})")
        else:
            gray(f"     {label} (pid {pid}) already stopped")
        del pids[label]

    _save_pids(pids)
    if _PID_FILE.exists():
        _PID_FILE.unlink()


def cmd_ip() -> None:
    assert_cmd("kubectl")
    header("Ingress IP")

    jsonpath = "{.status.loadBalancer.ingress[0].ip}"
    r = run(["kubectl", "get", "ingress", "synqlab-gateway", "-n", NAMESPACE,
             "-o", f"jsonpath={jsonpath}"], capture=True, quiet=True)
    ip = r.stdout.strip() if r.returncode == 0 else ""
    if ip:
        ok(f"External IP: {ip}")
        info(f"URL:         http://{ip}")
    else:
        warn("No external IP yet (ingress may still be provisioning)")


def cmd_grafana() -> None:
    assert_cmd("kubectl")
    header("Grafana Dashboard")

    _start_port_forward("svc/prometheus-stack-grafana", 3000, 80, "grafana", ns="monitoring")
    print()
    info("  Login:     http://localhost:3000")
    info("  Username:  admin")
    info("  Password:  synqlab2026")
    print()
    open_url("http://localhost:3000")
    gray("To stop:  python ops.py stop")


def cmd_token() -> None:
    assert_cmd("kubectl")
    header("Headlamp Token")

    r = run(["kubectl", "create", "token", "headlamp", "--namespace", "headlamp"],
            capture=True, quiet=True)
    token = r.stdout.strip() if r.returncode == 0 else ""
    if not token:
        r = run(["kubectl", "create", "token", "default", "--namespace", "headlamp"],
                capture=True, quiet=True)
        token = r.stdout.strip() if r.returncode == 0 else ""

    if token:
        if clipboard_copy(token):
            ok("[OK] Token copied to clipboard!")
        else:
            ok("[OK] Token (clipboard not available, printing):")
            print(f"      {token}")
    else:
        err("[X] Could not generate token.")


def show_help() -> None:
    header("SynqLab Ops CLI")
    info("Usage: python ops.py <command>")
    print()
    warn("Commands:")
    info("  login           GCP auth + GKE credentials + Docker registry")
    info("  install         Install Headlamp + SynqLab Helm chart")
    info("  dashboard       Open Kubernetes dashboard")
    info("  forward         Port-forward gateway (background)")
    info("  forward-all     Port-forward all services (background)")
    info("  upgrade         Helm upgrade synqlab release")
    info("  status          Pod, service, ingress, PVC status")
    info("  logs <svc>      Tail logs for a service")
    info("  grafana         Open Grafana monitoring dashboard")
    info("  stop            Stop all background port-forwards")
    info("  ip              Get ingress external IP")
    info("  token           Generate Headlamp token (clipboard)")
    print()


# ── Router ──────────────────────────────────────────────────────────────

COMMANDS: dict[str, object] = {
    "login":       cmd_login,
    "install":     cmd_install,
    "dashboard":   cmd_dashboard,
    "forward":     cmd_forward,
    "forward-all": cmd_forward_all,
    "upgrade":     cmd_upgrade,
    "status":      cmd_status,
    "logs":        cmd_logs,
    "stop":        cmd_stop,
    "ip":          cmd_ip,
    "grafana":     cmd_grafana,
    "token":       cmd_token,
}


def main() -> None:
    _enable_ansi_windows()

    args = sys.argv[1:]
    command = args[0] if args else ""
    extra_args = args[1:]

    handler = COMMANDS.get(command)
    if handler is None:
        show_help()
        return

    # The `logs` command needs extra_args
    import inspect
    sig = inspect.signature(handler)  # type: ignore[arg-type]
    if sig.parameters:
        handler(extra_args)  # type: ignore[operator]
    else:
        handler()  # type: ignore[operator]


if __name__ == "__main__":
    main()
