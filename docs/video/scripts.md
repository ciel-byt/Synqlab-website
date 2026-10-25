# Video scripts: SynqLab and Aria

Drafts, 2026-10-24. Two product videos for the website (Home/Platform and Aria). Plain language, no jargon, about 90 and 80 seconds.
Scenarios used in the demos are in [`../demo-scenarios.md`](../demo-scenarios.md).

## Ground rules
- Real screens only. AI tools are for the voice, captions and editing, not for generating visuals.
- Honesty captions: on SynqLab screens show **"Demo data"**; on Aria screens show **"Recorded results"** (the Aria workspace replays recorded evaluations from our paper).
- The voiceover never says "GFP". Call it "a protein" or "a protein design request". Note: the product screens do show the GFP11 wording of the scenario. If you do not want that on the public site, crop or blur that line, or change the scenario text first.
- Captions burned in (website videos autoplay muted). No background music, or very low.
- End card on both: **synqlab.ai · Book a call**.

## Before recording
1. `./start.sh` (http://localhost:8010). Use a **separate demo account**, not your own.
2. Browser 1920×1080, zoom 110%, hide bookmarks and extensions, light theme, mouse cursor visible.
3. Demo account state:
   - SynqLab: an organization with 2 projects and 3 members (for the workspace shot); no existing agent sessions.
   - Aria: no models yet for the Aria video (you will create one on camera), or one finished model for the table shot.
4. Rehearse once. Record each scene as its own clip, 5 seconds of slack at the start and end.

---

# Video 1: SynqLab (about 90 seconds)

Message: one workspace where a team and AI agents design, test and track every step.

| Time | Picture | Voiceover | On-screen text |
| --- | --- | --- | --- |
| 0:00–0:08 | Website → Platform page. The animated architecture (goal → agent → tools → record). | "Designing new proteins and medicines is messy. The work lives in separate tools, spreadsheets, and people's heads." | – |
| 0:08–0:16 | Animation continues; cut to the Home hero. | "SynqLab is an AI lab for biology. One workspace where your team and AI agents design, test, and track every step." | **SynqLab: an AI lab for biology** |
| 0:16–0:26 | Product: sidebar → Workspace → Projects. Hover the projects, teams and members. | "Your team works in projects, with the right people and the right access." | Projects · Teams · Members |
| 0:26–0:38 | Lab → SynqLab agent → New chat. Click the scenario chip. The agent's steps appear: reasoning, checking literature, scanning tools. | "To start, you tell the SynqLab agent what you want. Here: a protein design request, using our own measured data." | Demo data |
| 0:38–0:48 | Agent asks for the dataset. Click Upload → Upload. Dataset tab: 113 rows, quality check passed. | "You bring your data. The agent checks it first, so the work starts on solid ground." | – |
| 0:48–0:58 | Agent analysis, then the recommended pipeline card (6 nodes, 3 rounds). Click **Approve & build**. | "It proposes a plan: a generator, structure prediction, checks for stability and binding, and a ranker. You approve it." | Human approval |
| 0:58–1:16 | Run page: **Start run**. Film the run and speed it up 2×. Pipeline nodes light up, log streams, funnel narrows, improvement bars rise round by round. | "Then it runs in rounds. Each round, the weak candidates drop out, and what the agent learns goes into the next one. By round three, the shortlist is much stronger." | Round 1 → 2 → 3 |
| 1:16–1:24 | KPI cards and the top picks; then the round report. | "The best five are ready for the lab. And every step is saved: what ran, on which data, with which model, and who approved it." | Saved and traceable |
| 1:24–1:32 | Back to the website: Products menu showing SynqLab, Aria, Lyra. End card. | "Specialist agents, like Aria for proteins, plug into the same platform. SynqLab: an AI lab for biology. Book a call to see it on your project." | **Book a call** |

Voiceover (continuous, about 200 words):
"Designing new proteins and medicines is messy. The work lives in separate tools, spreadsheets, and people's heads. SynqLab is an AI lab for biology. One workspace where your team and AI agents design, test, and track every step. Your team works in projects, with the right people and the right access. To start, you tell the SynqLab agent what you want. Here: a protein design request, using our own measured data. You bring your data. The agent checks it first, so the work starts on solid ground. It proposes a plan: a generator, structure prediction, checks for stability and binding, and a ranker. You approve it. Then it runs in rounds. Each round, the weak candidates drop out, and what the agent learns goes into the next one. By round three, the shortlist is much stronger. The best five are ready for the lab. And every step is saved: what ran, on which data, with which model, and who approved it. Specialist agents, like Aria for proteins, plug into the same platform. SynqLab: an AI lab for biology. Book a call to see it on your project."

Shot notes
- The run page replay takes about 60 seconds. Record all of it, then speed to 2×.
- Slow the cursor; pause 1 second on each result before moving on.
- The architecture animation on the Platform page loops by itself; record one full pass (about 20 seconds) and use the part you need.

---

# Video 2: Aria (about 80 seconds)

Message: Aria is AI that designs proteins, and gets better with every round. You can build versions, compare them, and use them.

| Time | Picture | Voiceover | On-screen text |
| --- | --- | --- | --- |
| 0:00–0:10 | Website → Aria page. The four-step loop (Ask, Propose, Check, Learn) highlights in turn. | "AI can write protein sequences. Getting the protein you actually need is the hard part. Aria is AI that designs proteins, and gets better with every round." | **Aria** |
| 0:10–0:24 | Product: Lab → Aria → Models → New model. Zoom into the family map; click uL24. Family statistics appear. | "Start with a protein family from our collection of more than two thousand, or upload your own data. Aria shows what the family looks like: how long the proteins are, which species, and what they do." | Our data · Your data |
| 0:24–0:42 | Set rounds to 3 → **Train**. The chart climbs, tags turn Queued → In progress → Done, green gains count up. | "Choose how many rounds, and train. Each round, Aria proposes proteins, checks them, and learns from what worked. Watch it improve: the share of proteins that belong to the requested family rises from 28 to 74 percent." | Recorded results |
| 0:42–0:54 | Models table: three versions with green gains. Show the Used in drop-down; open a row. | "Every version is saved with its performance. Compare them, and use any version on its own, or hand it to the SynqLab agent." | v1 · v2 · v3 |
| 0:54–1:10 | **Use models** tab → New chat → click a scenario chip. Steps run (reading, generating, predicting, scoring). The result card: sequence, rotating 3D structure, checks. | "Then use it. Ask for a protein, and Aria returns the sequence, its predicted 3D structure, and whether it follows your request." | – |
| 1:10–1:18 | Set Model 2 to v2, send the same request: two cards side by side. | "Compare two versions on the same request, and see the difference." | – |
| 1:18–1:26 | End card over the Aria page. | "Your data. Your models. You own them. Book a call to try Aria on your target." | **Book a call** |

Voiceover (continuous, about 175 words):
"AI can write protein sequences. Getting the protein you actually need is the hard part. Aria is AI that designs proteins, and gets better with every round. Start with a protein family from our collection of more than two thousand, or upload your own data. Aria shows what the family looks like: how long the proteins are, which species, and what they do. Choose how many rounds, and train. Each round, Aria proposes proteins, checks them, and learns from what worked. Watch it improve: the share of proteins that belong to the requested family rises from 28 to 74 percent. Every version is saved with its performance. Compare them, and use any version on its own, or hand it to the SynqLab agent. Then use it. Ask for a protein, and Aria returns the sequence, its predicted 3D structure, and whether it follows your request. Compare two versions on the same request, and see the difference. Your data. Your models. You own them. Book a call to try Aria on your target."

Numbers on screen (uL24 / PF00467, 3 rounds, from the recorded evaluation): family recovery 28.4% → 74.0% (+45.6), structure match 0.389 → 0.655, passes all checks 13.7% → 34.6%. They differ slightly from the checkpoints quoted in the paper (72.0% at the chosen checkpoint). Keep the caption "Recorded results".

Shot notes
- Zoom the map with the scroll wheel; click the labelled dot (uL24). Pause on the statistics.
- Training takes about 7 seconds; keep it real-time.
- In the chat, wait for the four-step progress (about 4 seconds) before the card appears; let the structure rotate for 2 seconds.

---

## Production plan
1. Record the voiceover first (ElevenLabs from this script, or your own voice). Aim for 150 words per minute.
2. Record the screen clips to match the timings above (Screen Studio, 1920×1080).
3. Assemble in Descript or CapCut: clips, voiceover, burned-in captions, end card.
4. Export 1080p MP4, under 25 MB per video; also a short silent loop of the architecture animation for the Home hero if wanted.
5. Host unlisted on YouTube or Vimeo, and put the link into the video slots (`VideoSlot` on Home, Platform and Aria).
