import json, pandas as pd, numpy as np
A="/Users/sepehrbayat/Downloads/SynqLab/SynqLab/aria/outputs/phase1/multi-domain-selection/"
def load(kind, seed):
    suf="_seed2002" if seed else ""
    return pd.read_csv(A+f"domain_hit/own_domain_hit{suf}_detail.csv"), pd.read_csv(A+f"tm_score/own_domain_tm{suf}_detail.csv")
order={"sft":0,"iter1":1,"iter2":2,"iter3":3}
info={"PF00237":("uL22","Large ribosomal subunit protein uL22",89),"PF00467":("uL24","Large ribosomal subunit protein uL24",211),"PF03652":("YqgF","Putative pre-16S rRNA nuclease",60)}
fams={}
for pf,(short,name,ho) in info.items():
    per={r:[] for r in order.values()}
    for seed in (0,1):
        hit,tm=load("own",seed)
        for lab,ri in order.items():
            h=hit[(hit.domain==pf.lower())&(hit.label==lab)]; t=tm[(tm.domain==pf.lower())&(tm.label==lab)]
            if len(h)==0: continue
            def pct(s): return float(s.astype(bool).mean()*100)
            per[ri].append({"recovery":pct(h.hit),"tm":float(t.tm_score.mean()),"tm50":float((t.tm_score>=0.5).mean()*100),
              "confidence":float(h.plddt.mean()),"follows":pct(h.gate_pass),"filters":pct(h.filter_pass),"checks":pct(h.pass_both_and_folds)})
    rounds={}
    for ri,l in per.items():
        rounds[str(ri)]={k:round(float(np.mean([x[k] for x in l])),3 if k=="tm" else 1) for k in l[0]}
    fams[pf]={"short":short,"name":name,"held_out":ho,"max_rounds":3,"seeds":2,"rounds":rounds}
fams["PF00416"]={"short":"uS13","name":"Small ribosomal subunit protein uS13","held_out":260,"max_rounds":1,"seeds":1,"rounds":{"0":{"confidence":49.4,"follows":16.9,"filters":88.5,"checks":0.4},"1":{"confidence":57.6,"follows":25.8,"filters":96.5,"checks":7.3}}}
M=lambda k,l,u,d,h,g:{"key":k,"label":l,"unit":u,"dec":d,"help":h,"group":g}
metrics=[
 M("recovery","Family recovery","%",1,"Generated proteins that belong to the requested protein family","tuning"),
 M("tm","Structure match","TM",3,"Mean TM-score of predicted structures against natural family members","tuning"),
 M("tm50","Fold match","%",1,"Generated proteins whose predicted structure matches a natural member (TM-score at least 0.5)","tuning"),
 M("confidence","Confidence","/100",1,"Mean predicted structure confidence (pLDDT)","tuning"),
 M("follows","Follows request","%",1,"Generated proteins that pass the specification gate","tuning"),
 M("filters","Quality filters","%",1,"Generated proteins that pass the sequence filters","tuning"),
 M("checks","Passes all","%",1,"Pass the gate, the filters and reach confidence 70 or more","tuning"),
 M("len10","Length ±10%","%",1,"Sequences within 10% of the requested length","control"),
 M("hydro","Hydrophobicity","%",1,"Sequences matching the requested hydrophobicity","control"),
 M("stab","Stability","%",1,"Sequences matching the requested stability","control"),
 M("aggr","Aggregation","%",1,"Sequences matching the requested aggregation level","control"),
 M("cys","Cysteine count","%",1,"Sequences with exactly the requested cysteine count","control"),
 M("chg","Charge (MCC)","MCC",2,"Matthews correlation for requested charge","control"),
 M("tmh","Transmembrane (MCC)","MCC",2,"Matthews correlation for requested transmembrane helices","control"),
 M("sig","Signal peptide (MCC)","MCC",2,"Matthews correlation for requested signal peptide","control"),
]
control={"general":{"name":"General AI","note":"An unadapted general-purpose model","values":{"len10":11.6,"hydro":62.4,"stab":52.9,"aggr":42.0,"cys":23.3,"chg":0.26,"tmh":0.28,"sig":0.07}},
         "aria":{"name":"Aria base","note":"Supervised Aria, before family tuning","values":{"len10":88.8,"hydro":86.9,"stab":72.2,"aggr":75.0,"cys":68.9,"chg":0.89,"tmh":0.87,"sig":0.74}}}
out={"metrics":metrics,"families":fams,"control":control,"source":"Aria paper (NeurIPS 2026). Control metrics: held-out evaluation of the supervised model. Tuning metrics: recorded per-round within-family evaluation, mean of two seeds where shown; round 0 is the supervised Aria base."}
json.dump(out,open("/Users/sepehrbayat/Downloads/SynqLab/webapp/synqLab-agent/synqlab/seed/aria_runs.json","w"),indent=1)
for k,v in fams.items():
    print(k); 
    for r,x in v["rounds"].items(): print(" ",r,x)
