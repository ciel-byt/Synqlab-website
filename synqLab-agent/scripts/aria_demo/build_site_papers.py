import json, re
oa={x["q"][:30]:x for x in json.load(open("openalex.json"))}
def O(prefix): 
    for k,v in oa.items():
        if k.startswith(prefix[:30]): return v
    raise KeyError(prefix)
def authors(x,n=6):
    a=x["authors"]; s=", ".join(a[:n]); return s+(" et al." if len(a)>n else "")
def slug(t): return re.sub(r"[^a-z0-9]+","-",t.lower()).strip("-")[:60]
SCHOLAR="https://scholar.google.com/citations?user=Lx8-mlMAAAAJ&hl=en"
rows=[]
def add(title,year,kind,topic,venue,authors_text,url=None,doi=None,abstract=None,body=None,limits=None,slug_=None,sort=0):
    rows.append(dict(slug=slug_ or slug(title),title=title,year=year,kind=kind,topic=topic,venue=venue,authors=authors_text,url=url,doi=doi,abstract=abstract,body=body,limits=limits,sort=sort))
def oadd(prefix,title,year,kind,topic,venue=None,use_abstract=True,url=None,**kw):
    x=O(prefix); doi=x.get("doi"); u=url or x.get("landing") or doi
    ab=x["abstract"] if (use_abstract and x.get("oa") and x["abstract"]) else None
    add(title,year,kind,topic,venue or x.get("venue"),authors(x),u,doi.replace("https://doi.org/","") if doi else None,ab,**kw)

# --- existing site papers (kept as written from the papers) ---
old=json.load(open("old_papers.json"))
for p in old:
    add(p["title"],p["year"],p["kind"],"Protein AI",p["venue"],p["authors"],None,None,p["summary"],body=p["body"],limits=p["limits"],slug_=p["slug"],sort=1)
rows[0]["kind"]="Paper"; rows[1]["kind"]="Paper"
rows[1]["venue"]="NeurIPS 2025 Workshop on AI Virtual Cells and Instruments (AI4D3), spotlight"

P="Protein AI"; D="Diagnostics and biomanufacturing"; M="Microfluidics"
oadd("Analysis of Quantized","Analysis of Quantized and Efficiently Adapted Protein Language Models",2026,"Preprint",P,"arXiv")
oadd("Minimal Data Maximal","Minimal Data · Maximal Insight (MDMI): A Structure-guided Pipeline for Discovering Functional Alternatives in Peptide-Protein Interfaces",2026,"Preprint",P,"bioRxiv")
add("Assessing Quantization and Efficient Fine-Tuning for Protein Language Models",2025,"Paper",P,"ICLR 2025 Workshop on Generative and Experimental Perspectives for Biomolecular Design","S. Clancy, I. Y. Zeisler, P. Bayat, M. Xie, V. White, S. Perkins, S. Bayat et al.",None)
add("From Minimal Data To Maximal Insight: A Machine Learning Guided Platform For Peptide Discovery",2025,"Paper",P,"ICLR 2025 Workshop on Generative and Experimental Perspectives for Biomolecular Design","P. Bayat, S. Perkins, S. Clancy, S. S. Patel, R. F. Yin, K. Bozovičar, I. Iwe et al.",None)
oadd("Minimal-Data Peptide","Minimal-Data Peptide Design and Accessible Protein Language Models for Protein Engineering",2025,"Thesis",P,"University of Toronto (PhD thesis)")
oadd("International multisite","International multisite implementation of distributed cell-free protein biomanufacturing to advance health and research equity",2026,"Paper",D)
oadd("International multi-site","International multi-site implementation of local cell-free protein biomanufacturing to advance health and research equity",2025,"Preprint",D,"medRxiv")
oadd("Automated Cell-free","Automated Cell-free Protein Synthesis for Distributed Biomanufacturing",2025,"Preprint",D,"medRxiv")
oadd("RAPID: Evaluation","RAPID: Evaluation of Cas12a Protospacer Nicking and Chimeric Reporters for PAM-independent RNA and DNA diagnostics",2026,"Paper",D)
oadd("CRISPR RNA-independent","CRISPR RNA-independent activation of Cas12a",2026,"Preprint",D,"Research Square / medRxiv")
oadd("Design to implementation","Design to implementation study for development and patient validation of paper-based toehold switch diagnostics",2022,"Paper",D,"Journal of Visualized Experiments (JoVE)")
oadd("Numerical Investigation","Numerical Investigation of an Active Micromixer Utilizing Alternating Rotating Obstacles for Non-Newtonian Fluids at Ultra-low Reynolds Numbers",2026,"Paper",M,"Journal of Applied Fluid Mechanics")
oadd("Advances in passively","Advances in passively driven microfluidics and lab-on-chip devices: a comprehensive literature review and patent analysis",2020,"Paper",M,"RSC Advances")
oadd("Study of Pulsatile","Study of Pulsatile Flow in Common Carotid Artery with Different Stenosis' Shapes within Various Wall Conditions",2019,"Paper",M,"Journal of Applied Fluid Mechanics")
oadd("Microfluidic curved","Microfluidic curved-channel centrifuge for solution exchange of target microparticles and their simultaneous separation from bacteria",2018,"Paper",M,"Soft Matter")
add("Systems, devices and methods of performing magnetophoretic separation and solution exchange in curved fluidic channel",2018,"Patent",M,"US Patent Application 16/015,617","P. Rezai, P. Bayat")
add("Microfluidic centrifuge device and method for performing solution exchange and separation",2018,"Patent",M,"US Patent Application 16/015,591","P. Rezai, P. Bayat")
add("Environmental, Chemical and Medical Sensors",2018,"Book",M,"Springer","K. Youssef, P. Bayat, A. R. Peimani, S. Dibaji, P. Rezai")
oadd("Miniaturized Sensors","Miniaturized Sensors and Actuators for Biological Studies on Small Model Organisms of Disease",2017,"Chapter",M,"Environmental, Chemical and Medical Sensors (Springer)")
oadd("Semi-empirical","Semi-empirical estimation of dean flow velocity in curved microchannels",2017,"Paper",M,"Scientific Reports")
add("Investigation of Secondary (Dean) Flows in Curved Microchannels and Application to Microparticle Sample Preparation",2017,"Thesis",M,"Thesis","P. Bayat")
add("Springer Handbook of Nanotechnology",2017,"Book",M,"Springer","A. Aryasomayajula, P. Bayat, P. Rezai, P. R. Selvaganapathy")
oadd("Microfluidic devices","Microfluidic devices and their applications",2017,"Chapter",M,"Springer Handbook of Nanotechnology")
for i,r in enumerate(rows): r["sort"]=i
json.dump(rows,open("/Users/sepehrbayat/Downloads/SynqLab/webapp/synqLab-agent/synqlab/seed/site_papers.json","w"),indent=1,ensure_ascii=False)
for r in rows: print(r["year"],r["kind"],"|",r["title"][:55],"|",r["venue"][:30] if r["venue"] else None,"|",bool(r["abstract"]),"|",r["doi"] or r["url"])
