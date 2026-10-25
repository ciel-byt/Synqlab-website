"""Write backbone-only PDBs for the website's 3D view: the natural protein (as folded in the Aria evaluation)
and the Aria design rotated onto it, so the two overlay. Needs the local Aria data folder (iCloud copy)."""
import json, os, numpy as np
from Bio.PDB import PDBParser
ROOT = "/Users/sepehrbayat/Downloads/SynqLab/webapp/"
REAL = "/Users/sepehrbayat/Library/Mobile Documents/com~apple~CloudDocs/aria/data/dpo15/pdbs_real/"
DES = ROOT + "synqLab-agent/synqlab/seed/aria_chat/pdb/"
idx = json.load(open(ROOT + "synqLab-agent/synqlab/seed/aria_chat/index.json"))
ex = json.load(open(ROOT + "website/src/ariaExamples.json"))
import hashlib
from build_site_examples_align import align

def ca(path):
    s = PDBParser(QUIET=True).get_structure("x", path)
    return np.array([r["CA"].coord for r in s.get_residues() if "CA" in r])

def kabsch(P, Q):  # rotate/translate P onto Q (both N x 3)
    pc, qc = P.mean(0), Q.mean(0); H = (P - pc).T @ (Q - qc)
    U, _, Vt = np.linalg.svd(H); d = np.sign(np.linalg.det(Vt.T @ U.T))
    R = Vt.T @ np.diag([1, 1, d]) @ U.T
    return R, qc - R @ pc

def backbone_pdb(src, dst, R=None, t=None):
    out = []
    for l in open(src):
        if not l.startswith("ATOM") or l[12:16].strip() not in ("N", "CA", "C", "O"): continue
        if R is not None:
            x = np.array([float(l[30:38]), float(l[38:46]), float(l[46:54])]); x = R @ x + t
            l = l[:30] + "%8.3f%8.3f%8.3f" % tuple(x) + l[54:]
        l = l[:17] + "ALA" + l[20:]  # residue names removed: the public file must not spell out the sequence
        out.append(l.rstrip("\n"))
    open(dst, "w").write("\n".join(out) + "\nEND\n")

for e in ex:
    s = next(x for x in idx[e["family"]]["scenarios"] if x["reference"]["acc"] == e["acc"] and x["rounds"][str(e["round"])]["identity"] == e["identity"])
    ref = s["reference"]["seq"]; r = s["rounds"][str(e["round"])]
    nat_pdb = REAL + hashlib.sha256(ref.encode()).hexdigest()[:16] + ".pdb"; des_pdb = DES + r["pdb"] + ".pdb"
    N, D = ca(nat_pdb), ca(des_pdb); assert len(N) == len(ref) and len(D) == len(r["seq"]), (len(N), len(ref), len(D), len(r["seq"]))
    # residue pairs from the sequence alignment already computed for the page
    pairs, i, j = [], 0, 0
    nat_al, des_al = align(ref, r["seq"])
    for a, b in zip(nat_al, des_al):
        if a != "-" and b != "-": pairs.append((i, j))
        i += a != "-"; j += b != "-"
    pi = np.array(pairs)
    for it in range(8):  # refine on the residues that already sit close together
        R, t = kabsch(D[pi[:, 1]], N[pi[:, 0]])
        dist = np.linalg.norm((D @ R.T + t)[pi[:, 1]] - N[pi[:, 0]], axis=1)
        keep = dist < 6.0
        if keep.sum() < 15: break
        pi = pi[keep]
    R, t = kabsch(D[pi[:, 1]], N[pi[:, 0]])
    rms = float(np.sqrt(((D[pi[:, 1]] @ R.T + t - N[pi[:, 0]]) ** 2).sum(1).mean()))
    key = e["family"].lower()
    backbone_pdb(nat_pdb, ROOT + f"website/public/structures/{key}-natural.pdb")
    backbone_pdb(des_pdb, ROOT + f"website/public/structures/{key}-aria.pdb", R, t)
    print(e["name"], "pairs kept", len(pi), "of", len(pairs), "rmsd %.2f A" % rms, "natural", len(N), "design", len(D))
