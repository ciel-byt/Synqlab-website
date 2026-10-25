import json, numpy as np, pandas as pd
A="/Users/sepehrbayat/Downloads/SynqLab/SynqLab/aria/"
fam=set(pd.read_csv(A+"outputs/phase1/multi-domain-selection/family_summary.csv").pfam_family)
m=pd.read_parquet(A+"embeddings/out/esm2_t6_8M/meta.parquet",columns=["pfam_family","organism","ec_class","go_function","length","charge_ph74","gravy","cysteine_count","has_transmembrane","has_signal_peptide","mean_plddt"])
m=m[m.pfam_family.isin(fam)]
def sp(o):
    if not isinstance(o,str): return None
    w=o.split("(")[0].strip().split()
    return " ".join(w[:2]) if w else None
m["species"]=m.organism.map(sp)
def top(s,k=5):
    s=s.dropna()
    if len(s)==0: return []
    vc=s.value_counts().head(k)
    return [[str(i),round(100*c/len(s),1)] for i,c in vc.items()]
out={}
for pf,g in m.groupby("pfam_family"):
    L=g.length.to_numpy()
    h,_=np.histogram(L,bins=10,range=(float(L.min()),float(L.max())+1e-9))
    out[pf]={"n":int(len(g)),
      "len":{"min":int(L.min()),"p50":int(np.median(L)),"max":int(L.max()),"hist":[int(x) for x in h]},
      "species":top(g.species),"n_species":int(g.species.nunique()),
      "ec":{"annotated":round(100*g.ec_class.notna().mean(),1),"top":top(g.ec_class,3)},
      "go":{"annotated":round(100*g.go_function.notna().mean(),1),"top":top(g.go_function,5)},
      "props":{"charge":round(float(g.charge_ph74.median()),1),"gravy":round(float(g.gravy.median()),2),"cys":int(g.cysteine_count.median()),
               "tm":round(100*(g.has_transmembrane=="yes").mean(),1),"signal":round(100*(g.has_signal_peptide=="yes").mean(),1),
               "plddt":round(float(g.mean_plddt.mean()),1) if g.mean_plddt.notna().any() else None}}
json.dump(out,open("/Users/sepehrbayat/Downloads/SynqLab/webapp/synqLab-agent/synqlab/seed/aria_family_stats.json","w"),separators=(",",":"),ensure_ascii=False)
import os; print(len(out), os.path.getsize("/Users/sepehrbayat/Downloads/SynqLab/webapp/synqLab-agent/synqlab/seed/aria_family_stats.json")//1024,"KB"); print(json.dumps(out["PF00467"])[:600])
