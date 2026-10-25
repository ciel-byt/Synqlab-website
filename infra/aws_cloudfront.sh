#!/usr/bin/env bash
# Put CloudFront in front of the SynqLab service so www.synqlab.ai no longer depends on
# hand-edited load balancer rules. Safe to run again: reuses the distribution if it exists.
#   ./infra/aws_cloudfront.sh
set -euo pipefail
export AWS_REGION="us-east-1" AWS_DEFAULT_REGION="us-east-1"   # CloudFront certificates must live here
ORIGIN="${ORIGIN:-sy-3cedb865376e4b788e2a70f4bf83e861.ecs.us-east-1.on.aws}"   # the service's own address
ALIAS="${ALIAS:-www.synqlab.ai}"

python3 - "$ORIGIN" "$ALIAS" <<'PY'
import json, subprocess, sys, time, tempfile
origin, alias = sys.argv[1], sys.argv[2]

def aws(*a):
    r = subprocess.run(["aws", *a, "--output", "json"], capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr.strip())
    return json.loads(r.stdout) if r.stdout.strip() else {}

# 1. Already created?
for d in (aws("cloudfront", "list-distributions").get("DistributionList", {}).get("Items") or []):
    if alias in (d.get("Aliases", {}).get("Items") or []):
        print(f"Distribution already exists: {d['Id']}  ({d['Status']})")
        print(f"\nIn GoDaddy, make the CNAME  www  point to:  {d['DomainName']}")
        sys.exit(0)

# 2. Certificate for the domain (issued, in us-east-1)
cert = None
for c in aws("acm", "list-certificates", "--certificate-statuses", "ISSUED")["CertificateSummaryList"]:
    names = [c["DomainName"]] + c.get("SubjectAlternativeNameSummaries", [])
    if any(n == alias or (n.startswith("*.") and alias.endswith(n[1:])) for n in names):
        cert = c["CertificateArn"]; break
if not cert:
    sys.exit(f"No issued certificate covering {alias} in us-east-1. Request one in ACM (us-east-1), validate it, then run again.")
print("Using certificate:", cert.split("/")[-1])

def managed(kind, name):
    """Look up an AWS-managed policy id by name (ids differ from what is documented in places)."""
    items = aws("cloudfront", f"list-{kind}-policies", "--type", "managed")[f"{'Cache' if kind == 'cache' else 'OriginRequest'}PolicyList"]["Items"]
    for i in items:
        p = i[f"{'Cache' if kind == 'cache' else 'OriginRequest'}Policy"]
        if p[f"{'Cache' if kind == 'cache' else 'OriginRequest'}PolicyConfig"]["Name"] == name: return p["Id"]
    sys.exit(f"Managed policy {name} not found.")

# 3. Create the distribution: no caching (login and API must be live), forward everything except Host.
cfg = {
    "CallerReference": f"synqlab-{int(time.time())}",
    "Comment": "SynqLab www",
    "Enabled": True,
    "Aliases": {"Quantity": 1, "Items": [alias]},
    "HttpVersion": "http2and3",
    "Origins": {"Quantity": 1, "Items": [{
        "Id": "synqlab-service",
        "DomainName": origin,
        "CustomOriginConfig": {
            "HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "https-only",
            "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
            "OriginReadTimeout": 60, "OriginKeepaliveTimeout": 5,
        },
    }]},
    "DefaultCacheBehavior": {
        "TargetOriginId": "synqlab-service",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {"Quantity": 7, "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
                           "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
        "Compress": True,
        "CachePolicyId": managed("cache", "Managed-CachingDisabled"),
        "OriginRequestPolicyId": managed("origin-request", "Managed-AllViewerExceptHostHeader"),
    },
    "ViewerCertificate": {"ACMCertificateArn": cert, "SSLSupportMethod": "sni-only", "MinimumProtocolVersion": "TLSv1.2_2021"},
    "PriceClass": "PriceClass_100",
}
with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
    json.dump(cfg, f); path = f.name
d = aws("cloudfront", "create-distribution", "--distribution-config", f"file://{path}")["Distribution"]
print(f"Created distribution {d['Id']}. It takes about 5-10 minutes to deploy.")
print(f"""
Next, in GoDaddy (DNS):
  1. Edit the CNAME record  www  (today it points at the old load balancer).
  2. Set its value to:  {d['DomainName']}
  3. Save.

Check it works first (before changing DNS), once the status is Deployed:
  curl -sI https://{d['DomainName']}/api/health | head -1      # expect 200
""")
PY
