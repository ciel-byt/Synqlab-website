import json, urllib.request, urllib.parse, time
titles = [
"Analysis of Quantized and Efficiently Adapted Protein Language Models",
"CRISPR RNA-independent activation of Cas12a",
"Minimal Data Maximal Insight (MDMI): A Structure-guided Pipeline for Discovering Functional Alternatives in Peptide-Protein Interfaces",
"International multisite implementation of distributed cell-free protein biomanufacturing to advance health and research equity",
"Numerical Investigation of an Active Micromixer Utilizing Alternating Rotating Obstacles for Non-Newtonian Fluids at Ultra-low Reynolds Numbers",
"Automated Cell-free Protein Synthesis for Distributed Biomanufacturing",
"International multi-site implementation of local cell-free protein biomanufacturing to advance health and research equity",
"RAPID: Evaluation of Cas12a Protospacer Nicking and Chimeric Reporters for PAM-independent RNA and DNA diagnostics",
"Minimal-Data Peptide Design and Accessible Protein Language Models for Protein Engineering",
"Probing Functional Plasticity in Peptide-Protein Interaction with Minimal Data",
"Assessing Quantization and Efficient Fine-Tuning for Protein Language Models",
"From Minimal Data To Maximal Insight: A Machine Learning Guided Platform For Peptide Discovery",
"Design to implementation study for development and patient validation of paper-based toehold switch diagnostics",
"Advances in passively driven microfluidics and lab-on-chip devices: a comprehensive literature review and patent analysis",
"Study of Pulsatile Flow in Common Carotid Artery with Different Stenosis' Shapes within Various Wall Conditions",
"Microfluidic curved-channel centrifuge for solution exchange of target microparticles and their simultaneous separation from bacteria",
"Miniaturized Sensors and Actuators for Biological Studies on Small Model Organisms of Disease",
"Semi-empirical estimation of dean flow velocity in curved microchannels",
"Microfluidic devices and their applications",
]
def inv(ii):
    if not ii: return ""
    w=[]
    for k,pos in ii.items():
        for p in pos: w.append((p,k))
    return " ".join(k for _,k in sorted(w))
out=[]
for t in titles:
    q=urllib.parse.urlencode({"search":t,"per-page":3,"select":"id,title,doi,publication_year,type,open_access,primary_location,authorships,abstract_inverted_index,cited_by_count"})
    try:
        d=json.load(urllib.request.urlopen("https://api.openalex.org/works?"+q,timeout=20))
    except Exception as e:
        out.append({"q":t,"err":str(e)}); continue
    best=None
    for r in d.get("results",[]):
        a=(r.get("title") or "").lower()[:40]
        if a and a[:30] in t.lower().replace("–","-"): best=r; break
    if not best and d.get("results"): best=d["results"][0]; flag="weak"
    else: flag="ok"
    if best:
        loc=(best.get("primary_location") or {})
        out.append({"q":t,"flag":flag,"title":best.get("title"),"doi":best.get("doi"),"year":best.get("publication_year"),"type":best.get("type"),"oa":(best.get("open_access") or {}).get("is_oa"),"landing":loc.get("landing_page_url"),"venue":((loc.get("source") or {}).get("display_name")),"authors":[a["author"]["display_name"] for a in best.get("authorships",[])],"abstract":inv(best.get("abstract_inverted_index"))})
    else: out.append({"q":t,"flag":"none"})
    time.sleep(0.3)
json.dump(out,open("openalex.json","w"),indent=1)
for o in out: print(o.get("flag"),"|",o["q"][:50],"|",(o.get("title") or "")[:50],"|",o.get("doi"),"|",o.get("oa"),"|",len(o.get("abstract","")),"|",len(o.get("authors",[])))
