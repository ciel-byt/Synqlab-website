"""Build website/src/ariaExamples.json: three recorded Aria designs next to the natural protein they were asked to match.
NO sequences go in this file (it ships to the public site); only numbers and the request.
Reads the product's own seed (aria_chat/index.json), so numbers equal what the Aria workspace shows after sign-in."""
import json, numpy as np
ROOT = "/Users/sepehrbayat/Downloads/SynqLab/webapp/"
idx = json.load(open(ROOT + "synqLab-agent/synqlab/seed/aria_chat/index.json"))
PICK = [  # (family, scenario, round, design name, natural protein name, function line, plain request)
    ("PF00237", "PF00237-00", "1", "Aria uL22-1"),
    ("PF00467", "PF00467-07", "3", "Aria uL24-1"),
    ("PF03652", "PF03652-07", "1", "Aria YqgF-1"),
]

out = []
for fam, sid, rd, name in PICK:
    s = next(x for x in idx[fam]["scenarios"] if x["id"] == sid)
    r = s["rounds"][rd]; ref = s["reference"]["seq"]
    out.append({"family": fam, "short": idx[fam]["short"], "name": name, "acc": s["reference"]["acc"], "spec": s["spec"],
        "natLen": len(ref), "desLen": len(r["seq"]),
        "plddt": r["plddt"], "tm": r["tm"], "identity": r["identity"], "evalue": r["evalue"],
        "gate": r["gate"], "filter": r["filter"], "hit": r["hit"], "round": int(rd)})
json.dump(out, open(ROOT + "website/src/ariaExamples.json", "w"), indent=1)
for o in out: print(o["name"], o["acc"], o["spec"], o["identity"])
