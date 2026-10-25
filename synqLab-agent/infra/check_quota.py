import json, subprocess
out = subprocess.check_output(["gcloud","compute","project-info","describe","--project=project-41f6f4ea-8a21-4190-a8a","--format=json"], text=True)
data = json.loads(out)
for q in data["quotas"]:
    if "CPU" in q["metric"] or "SSD" in q["metric"] or "INSTANCE" in q["metric"]:
        print(f"{q['metric']:30s}  usage={q.get('usage',0):>6.0f}  limit={q['limit']:>6.0f}")
