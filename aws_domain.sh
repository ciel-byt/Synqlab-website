#!/usr/bin/env bash
# Point synqlab.ai at the new SynqLab service (instead of the old todo-app).
# The domain already reaches your load balancer; this changes where its routing rule sends traffic.
# Shows the plan first and asks before changing anything. Safe to run again.
#   ./aws_domain.sh
set -euo pipefail
export AWS_REGION="${AWS_REGION:-us-east-1}" AWS_DEFAULT_REGION="${AWS_REGION:-us-east-1}"
NEW_HOST="${NEW_HOST:-sy-3cedb865376e4b788e2a70f4bf83e861.ecs.us-east-1.on.aws}"   # the new service's own address
DOMAIN="${DOMAIN:-synqlab.ai}"

python3 - "$NEW_HOST" "$DOMAIN" <<'PY'
import json, subprocess, sys
new_host, domain = sys.argv[1], sys.argv[2]

def aws(*a):
    return json.loads(subprocess.run(["aws", *a, "--output", "json"], check=True, capture_output=True, text=True).stdout)

def hosts(rule):
    out = []
    for c in rule.get("Conditions", []):
        out += c.get("HostHeaderConfig", {}).get("Values", []) or c.get("Values", [])
    return out

def target(rule):
    for a in rule.get("Actions", []):
        if a.get("TargetGroupArn"): return a["TargetGroupArn"]
        tgs = a.get("ForwardConfig", {}).get("TargetGroups", [])
        if tgs: return tgs[0]["TargetGroupArn"]
    return None

new_tg, old = None, []
for lb in aws("elbv2", "describe-load-balancers")["LoadBalancers"]:
    for ls in aws("elbv2", "describe-listeners", "--load-balancer-arn", lb["LoadBalancerArn"])["Listeners"]:
        for r in aws("elbv2", "describe-rules", "--listener-arn", ls["ListenerArn"])["Rules"]:
            hs = hosts(r)
            if any(h.lower() == new_host.lower() for h in hs): new_tg = target(r)
            if any(domain in h for h in hs): old.append((r["RuleArn"], hs, target(r), ls["ListenerArn"]))

print("New service target group:", new_tg or "NOT FOUND")
print(f"Rules that currently handle {domain}:")
for arn, hs, tg, _ in old: print("  ", arn.split("/")[-1], hs, "->", (tg or "?").split("/")[1] if tg else "?")
if not new_tg:
    sys.exit("Could not find the new service's routing rule. Is the release finished? Paste this output to Claude.")
if not old:
    sys.exit(f"No rule for {domain} found. The domain may point somewhere else (DNS). Paste this output to Claude.")
todo = [(arn, hs) for arn, hs, tg, _ in old if tg != new_tg]
if not todo:
    print(f"\nAlready pointing at the new service. If {domain} still shows the old site, clear your browser cache or try a private window.")
    sys.exit(0)
sys.stdout.write(f"\nSend {domain} traffic to the new service? [y/N] "); sys.stdout.flush()
if open("/dev/tty").readline().strip().lower() != "y":
    sys.exit("Nothing changed.")
for arn, hs in todo:
    subprocess.run(["aws", "elbv2", "modify-rule", "--rule-arn", arn, "--actions", f"Type=forward,TargetGroupArn={new_tg}"],
                   check=True, capture_output=True)
    print("updated rule", arn.split("/")[-1], hs)
print(f"\nDone. Open https://{domain} in a private window (the change is immediate, browsers may cache).")
PY
