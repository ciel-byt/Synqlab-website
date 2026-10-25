import json, os, re, hashlib, shutil, pandas as pd, numpy as np
A="/Users/sepehrbayat/Downloads/SynqLab/SynqLab/aria/outputs/phase1/multi-domain-selection/"
OUT="/Users/sepehrbayat/Downloads/SynqLab/webapp/synqLab-agent/synqlab/seed/aria_chat/"
shutil.rmtree(OUT,ignore_errors=True); os.makedirs(OUT+"pdb")
meta=pd.read_parquet("/Users/sepehrbayat/Downloads/SynqLab/SynqLab/aria/embeddings/out/esm2_t6_8M/meta.parquet",columns=["accession","sequence"]).set_index("accession").sequence
tm=pd.read_csv(A+"tm_score/own_domain_tm_detail.csv").set_index(["domain","label","accession"])
hit=pd.read_csv(A+"domain_hit/own_domain_hit_detail.csv").set_index(["domain","label","accession"])
def ident(a,b):
    # global alignment identity (match=1, mismatch=-1, gap=-2); identity over aligned columns of the shorter sequence
    n,m=len(a),len(b); S=np.zeros((n+1,m+1),int)
    S[:,0]=-2*np.arange(n+1); S[0,:]=-2*np.arange(m+1)
    for i in range(1,n+1):
        for j in range(1,m+1):
            S[i,j]=max(S[i-1,j-1]+(1 if a[i-1]==b[j-1] else -1),S[i-1,j]-2,S[i,j-1]-2)
    i,j,match=n,m,0
    while i>0 and j>0:
        if S[i,j]==S[i-1,j-1]+(1 if a[i-1]==b[j-1] else -1): match+=a[i-1]==b[j-1]; i-=1; j-=1
        elif S[i,j]==S[i-1,j]-2: i-=1
        else: j-=1
    return round(100*match/min(n,m),1)
def strip(src,dst):
    keep=[l for l in open(src) if l.startswith("ATOM") and l[12:16].strip() in ("N","CA","C","O")]
    open(dst,"w").write("".join(keep)+"END\n")
def spec(prompt):
    d={}
    for l in prompt.splitlines():
        m=re.match(r"- ([^:]+): (.+)",l)
        if m: d[m.group(1)]=m.group(2)
    return d
def label(sp):
    parts=[]
    if "Length" in sp: parts.append(sp["Length"].replace(" residues"," aa"))
    if "Net charge at pH 7.4" in sp: parts.append(f"charge {sp['Net charge at pH 7.4']}")
    if "Hydrophobicity" in sp: parts.append(f"{sp['Hydrophobicity']} hydrophobicity")
    if "Aggregation propensity" in sp: parts.append(f"{sp['Aggregation propensity']} aggregation")
    if "Stability" in sp: parts.append(f"{sp['Stability']}")
    return " · ".join(parts[:4])
names={"PF00237":"uL22","PF00467":"uL24","PF03652":"YqgF"}
data={}
for pf in names:
    base=A+f"training/{pf.lower()}_seed1001/eval/final_test/"
    rounds={}
    for r,lab in enumerate(["sft","iter1","iter2","iter3"]):
        rows=[json.loads(l) for l in open(base+f"{lab}_eval.jsonl")]
        rounds[r]={(x["prompt"],x["accession"]):x for x in rows}
    common=[k for k in rounds[0] if all(k in rounds[r] and rounds[r][k].get("pdb_path") and os.path.exists(base+rounds[r][k]["pdb_path"]) and rounds[r][k].get("sequence") for r in range(4))]
    common.sort(key=lambda k:k[1])
    pick=[common[int(i*len(common)/12)] for i in range(12)] if len(common)>=12 else common
    sc=[]
    for si,k in enumerate(pick):
        prompt,acc=k; sp=spec(prompt); ref=meta.get(acc)
        res={}
        for r,lab in enumerate(["sft","iter1","iter2","iter3"]):
            x=rounds[r][k]; seq=x["sequence"]
            pid=hashlib.sha1((pf+str(si)+lab).encode()).hexdigest()[:12]
            strip(base+x["pdb_path"],OUT+f"pdb/{pid}.pdb")
            t=tm.loc[(pf.lower(),lab,acc)] if (pf.lower(),lab,acc) in tm.index else None
            h=hit.loc[(pf.lower(),lab,acc)] if (pf.lower(),lab,acc) in hit.index else None
            if isinstance(t,pd.DataFrame): t=t.iloc[0]
            if isinstance(h,pd.DataFrame): h=h.iloc[0]
            res[str(r)]={"seq":seq,"plddt":x["plddt"],"gate":bool(x["gate_pass"]),"filter":bool(x["filter_pass"]),"reasons":x.get("gate_reasons",[]),"score":x.get("constraint_score"),
              "tm":(round(float(t.tm_score),3) if t is not None else None),"hit":(bool(h.hit) if h is not None else None),"evalue":(None if h is None or str(h.evalue)=="NA" else str(h.evalue)),
              "identity":(ident(seq,ref) if ref else None),"pdb":pid}
        sc.append({"id":f"{pf}-{si:02d}","prompt":prompt,"spec":sp,"label":label(sp),"reference":{"acc":acc,"seq":ref},"rounds":res})
    data[pf]={"short":names[pf],"scenarios":sc}
    print(pf,len(common),len(sc))
json.dump(data,open(OUT+"index.json","w"),separators=(",",":"))
print(os.path.getsize(OUT+"index.json")//1024,"KB", sum(os.path.getsize(OUT+"pdb/"+f) for f in os.listdir(OUT+"pdb"))//1024,"KB pdb", len(os.listdir(OUT+"pdb")))
print(json.dumps(data["PF00467"]["scenarios"][0]["rounds"]["3"])[:500]); print(data["PF00467"]["scenarios"][0]["label"])
