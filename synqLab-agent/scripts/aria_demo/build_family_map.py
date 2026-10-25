import json, numpy as np, pandas as pd
from sklearn.manifold import TSNE
A="/Users/sepehrbayat/Downloads/SynqLab/SynqLab/aria/"
SEL=A+"outputs/phase1/multi-domain-selection/"
emb=pd.read_parquet(SEL+"family_embeddings.parquet")
if emb.index.name=="pfam_family": emb=emb.reset_index()
cols=[c for c in emb.columns if c.startswith("centroid_")]
X=emb[cols].to_numpy()
xy=TSNE(n_components=2,random_state=0,init="pca",perplexity=30).fit_transform(X)
xy=(xy-xy.min(0))/(xy.max(0)-xy.min(0))
fam=pd.read_csv(SEL+"family_summary.csv")[["pfam_family","n","description"]]
emb=emb[["pfam_family"]].copy() if "pfam_family" in emb.columns else emb
emb["x"],emb["y"]=xy[:,0],xy[:,1]
df=emb.merge(fam,on="pfam_family")
m=pd.read_parquet(A+"embeddings/out/esm2_t6_8M/meta.parquet",columns=["accession","protein_name","organism","sequence","length","mean_plddt","pfam_family"])
TUNED=["PF00416","PF00237","PF00467","PF03652"]
rng=np.random.default_rng(0)
out=[]
samples={}
for pf,g in m[m.pfam_family.isin(df.pfam_family)].groupby("pfam_family"):
    k=8 if pf in TUNED else 3
    g=g.sample(min(k,len(g)),random_state=0)
    samples[pf]=[dict(acc=r.accession,org=r.organism,len=int(r.length),name=r.protein_name,**({"seq":r.sequence,"plddt":round(float(r.mean_plddt),1) if pd.notna(r.mean_plddt) else None} if pf in TUNED else {})) for r in g.itertuples()]
def short(d,n=70): d=str(d); return d if len(d)<=n else d[:n-1]+"…"
for r in df.itertuples():
    out.append([r.pfam_family,short(r.description),int(r.n),round(float(r.x),4),round(float(r.y),4)])
json.dump({"families":out,"samples":samples,"tuned":TUNED},open("aria_families.json","w"),separators=(",",":"),ensure_ascii=False)
import os; print(len(out), os.path.getsize("aria_families.json")//1024,"KB")
for t in TUNED: print(t,[o for o in out if o[0]==t])
