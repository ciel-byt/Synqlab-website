# Shared — Training Frameworks

Common training/fine-tuning infrastructure used by **all** SynqLab generative agents (Aria, Phoenix, and future agents). Agent-specific phase docs link here instead of redefining frameworks.

> Scope: this doc covers *how* we train (frameworks, configs, hardware patterns). For *what* methodology (SFT → DPO) see [`method-sft-dpo.md`](method-sft-dpo.md). For scoring/eval tools see [`scoring-tools.md`](scoring-tools.md).

---

## Framework stack

| Tool | Use | Version pin | URL |
| ---- | --- | ----------- | --- |
| **Axolotl** | Primary SFT + DPO orchestration (YAML-config driven) | `>=0.4.1` | [axolotl-org/axolotl](https://github.com/axolotl-org/axolotl) |
| **TRL** | DPO/RLHF trainer used under Axolotl, or standalone for custom loops | `>=0.9` | [huggingface/trl](https://github.com/huggingface/trl) |
| **PEFT / LoRA** | Parameter-efficient fine-tuning (adapters, not full weights) | `>=0.11` | [huggingface/peft](https://github.com/huggingface/peft) |
| **unsloth** | 2–3x faster LoRA training, lower VRAM (optional speed path) | latest | [unslothai/unsloth](https://github.com/unslothai/unsloth) |
| **DeepSpeed** | Multi-GPU sharding (ZeRO-2/3) when model + batch exceed single-GPU VRAM | `>=0.14` | [microsoft/DeepSpeed](https://github.com/microsoft/DeepSpeed) |

**Default choice:** Axolotl + LoRA. Drop to unsloth only when single-GPU throughput is the bottleneck; add DeepSpeed ZeRO-3 only when a model does not fit on one GPU.

---

## Canonical base models

| Model | Use | URL |
| ----- | --- | --- |
| **Llama-3.1-8B-Instruct** | Default base for all sequence/SMILES generators | [meta-llama/Meta-Llama-3.1-8B-Instruct](https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct) |
| Qwen2.5-7B-Instruct | Alternative base (license / multilingual reasons) | [Qwen/Qwen2.5-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct) |

Rationale: instruction-tuned base lets us use natural-language property prompts directly (the SmileyLlama approach), instead of training a protein-native tokenizer from scratch.

---

## Reference LoRA config (SFT)

This is the SmileyLlama config (`Codes/SmileyLlama/sft/cf_lora.yml`), the canonical starting point for every agent's V1 SFT. Copy and override the dataset path + special tokens per agent.

| Setting | Value | Notes |
| ------- | ----- | ----- |
| `base_model` | `meta-llama/Llama-3.1-8B-Instruct` | see above |
| `adapter` | `lora` | LoRA, not full fine-tune |
| `load_in_8bit` | `true` | 8-bit base; `load_in_4bit: false` |
| `lora_r` | `32` | rank |
| `lora_alpha` | `16` | |
| `lora_dropout` | `0.05` | |
| `lora_target_linear` | `true` | adapt all linear layers |
| `sequence_len` | `2048` | raise only if prompts+sequences overflow |
| `sample_packing` | `true` | pack short samples for throughput |
| `micro_batch_size` | `4` | per-device |
| `gradient_accumulation_steps` | `4` | effective batch = 16 |
| `num_epochs` | `1` | start at 1; increase only if under-fit |
| `optimizer` | `adamw_bnb_8bit` | 8-bit Adam |
| `lr_scheduler` | `cosine` | |
| `learning_rate` | `0.0002` | |
| `train_on_inputs` | `false` | mask the prompt, train on response only |
| `bf16` | `auto` | |
| `flash_attention` | `true` | |
| `warmup_steps` | `10` | |
| `special_tokens.pad_token` | `<\|finetune_right_pad_id\|>` | Llama-3.1 pad token |

For DPO, switch the trainer block to TRL DPO (`rl: dpo`) and supply a preference dataset — see [`method-sft-dpo.md`](method-sft-dpo.md).

---

## Hardware patterns

| Job | Hardware | Notes |
| --- | -------- | ----- |
| SFT (8B, LoRA, 8-bit) | 1–2× A100 80GB | fits on one A100 80GB with the config above |
| DPO (8B, LoRA) | 1–2× A100 80GB | preference data is smaller; bottleneck is scoring, not training |
| Full fine-tune (8B) | 4–8× A100 + DeepSpeed ZeRO-3 | avoid unless LoRA underperforms measurably |

---

## Experiment tracking

- Log every run to **Weights & Biases** (or MLflow) with: base model, config hash, dataset version, git SHA.
- Every produced model writes a **lineage record** to the Knowledge Store: `{model_version, base_model, dataset_version, config, parent_version, eval_scores}`.
- A model with no lineage record is not allowed into the agent registry.
