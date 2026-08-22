#!/usr/bin/env bash
# As dez formas do warlock, como ARGUMENTOS e nao como texto colado.
#
# Um .md com os prompts prontos envelheceria calado: se a PAL mudar, o arquivo
# continua pedindo cores que o jogo nao tem mais. Aqui o prompt e regerado da
# PAL viva a cada execucao — mesmo argumento do proprio make_sprite_prompt.py.
#
#   bash tools/warlock-forms.sh              # as dez, na ordem
#   bash tools/warlock-forms.sh colheita     # so uma
#   bash tools/warlock-forms.sh --silhouette # a rodada de silhueta, que vem antes
#
# ALTURA E CONTRATO. PIXEL_UNIT 3 e raio 16 obrigam step 1 para todo mundo, e
# dai sai scale = 0.1875 x linhas. 18 linhas -> 3.375, 19 -> 3.5625, 20 -> 3.75.
# Largura e de graca: nao entra na conta do degrau.
#
# AURA NAO ESTA NA REFERENCIA, e e de proposito. Fogo em volta, alma verde,
# rastro de voo: isso e VfxLayer no canvas, na cor da forma. Brilho pedido ao
# modelo vaza para fora da silhueta e apaga a unica coisa que a imagem tinha
# para dar — onde a criatura termina. O que a imagem entrega e CORPO e POSE.
# Voo, esse sim, e pose: a forma que flutua nao tem perna no chao, e `findLegs`
# cai sozinho no balanco em vez do passo.
set -euo pipefail
cd "$(dirname "$0")/.."
GEN=(python3 tools/make_sprite_prompt.py)
SIL=""; [ "${1:-}" = "--silhouette" ] && { SIL="--silhouette"; shift; }
ONLY="${1:-}"

IDLE="IDLE — standing still, weight even on both feet flat on the baseline, arms hanging low and held clear of the torso, hands open and visible"
FLOAT="IDLE — floating, both feet clearly OFF the baseline and held together, legs closed inside the robe as one hanging mass, arms low and clear of the torso"
CAST="CAST — both arms raised in front of the chest and spread apart, palms turned outward, fingers open and separated, head up, torso leaning back a little. This is the gesture of PULLING power out, not of throwing a punch: elbows stay wide and the two hands stay far apart. The hands must not overlap the head or each other"

form() { # form <slug> <grid> <ramp> <second> <accent> <ink> <living|-> <name> [poses...]
  local slug=$1 grid=$2 ramp=$3 second=$4 accent=$5 ink=$6 living=$7 name=$8; shift 8
  [ -n "$ONLY" ] && [ "$ONLY" != "$slug" ] && return 0
  printf '\n\n========== %s  (%s)  ==========\n\n' "$slug" "$grid"
  local args=(--name "$name" --grid "$grid" --view front --ramp "$ramp" \
              --second "$second" --accent "$accent" --ink "$ink")
  [ "$living" = "living" ] && args+=(--living)
  if [ -n "$SIL" ]; then
    "${GEN[@]}" --silhouette --name "$name" --grid "$grid" --view front \
      --vary "the outer contour, the distribution of mass and the stance ONLY — do not add a horn, a wing or any appendage the description did not ask for"
  else
    for p in "$@"; do args+=(--pose "$p"); done
    "${GEN[@]}" "${args[@]}"
  fi
}

# ---- as duas formas humanas -------------------------------------------------

form aprendiz 12x18 vio1 meat0 fel1 deep living \
  "a young human warlock apprentice: plain hooded robe, the human face still uncovered and visible under the hood, no horns, no demonic feature at all — this is the before" \
  "$IDLE" "$CAST"

form experiente 13x19 vio1 bone0 fel1 deep living \
  "a veteran human warlock: the robe torn and fel-scorched at the hem, two short blunt bone horns just breaking through the brow, one forearm flayed down to the bone, the face still human but sunken" \
  "$IDLE" "$CAST"

# ---- uma por capstone -------------------------------------------------------

form colheita 22x20 rot1 bone0 fel2 warm - \
  "a plague-reaper warlock: the robe has rotted into hanging roots and thick vines, the ribcage is split wide open and hollow, a broad bone scythe blade is fused along the whole length of one forearm" \
  "$IDLE" "$CAST" \
  "UNLEASH — arms flung wide open and low, the split ribcage yawning fully open and facing the viewer, the root-hem of the robe fanned out flat"

form tirania 20x20 vio1 gold0 arc2 deep - \
  "a warlock tyrant: a heavy iron crown of thick spikes, enormous gilded pauldrons wider than the head, thick chains hanging from both wrists, no legs visible — the long robe closes into a single trailing mass" \
  "$FLOAT" "$CAST" \
  "UNLEASH — one arm extended out to the side and down, hand open in a flat gesture of command, crown held high, both chains pulled taut and horizontal"

form nihilam 20x20 emb0 stone0 pyr2 warm - \
  "a warlock burned down to a cracked husk: half the skull exposed through the charred face, the torso split from throat to waist by a wide open fissure, both forearms are cooled slag with hard blocky edges" \
  "$IDLE" "$CAST" \
  "UNLEASH — both fists brought together in front of the chest, the torso fissure gaping at its widest, head thrown back"

form ceifador 20x20 vio1 bone0 fel1 deep - \
  "a gaunt towering warlock reaper: a deep hood with a bare skull face inside it, small imp skulls hung around the hem of the robe, very long thin arms ending in heavy hooked claws" \
  "$IDLE" "$CAST" \
  "UNLEASH — one long arm sweeping low across the front of the body, hood tipped down, the other hand open and turned upward in offering"

form chamador 20x20 emb0 steel0 pyr1 warm - \
  "a warlock bell-caller: a heavy cracked iron bell hanging on the chest as big as the head, a crown of blackened iron spikes, both arms are ember-lit charcoal with wide splits across them" \
  "$IDLE" "$CAST" \
  "UNLEASH — both arms raised gripping the bell by its rim, head bowed down into it, shoulders hunched up"

form diabolista 22x20 void1 gold0 arc1 cold - \
  "a scholarly warlock diabolist: a horned brass mask covering the whole face, a large flat brass seal disc floating behind the shoulders like a halo, thick rolled contract scrolls chained to the belt, no legs visible — the robe closes into a single trailing mass" \
  "$FLOAT" "$CAST" \
  "UNLEASH — arms folded across the chest, the seal disc swung around to the FRONT of the body and centred on it, mask tilted up"

form voraz 20x20 meat0 bone0 fel1 warm - \
  "a bloated devourer warlock: the whole torso has split open into a vertical fanged maw running from collarbone to waist, the head's jaw hangs unhinged, both arms are long and grasping with oversized hands" \
  "$IDLE" "$CAST" \
  "UNLEASH — the torso maw gaping at its widest, both arms hauled back and outward, head thrown back"

form enxame 22x20 vio1 bone0 arc1 deep - \
  "a hollow warlock husk: chest and shoulders have split open into deep honeycomb hive cells, thick chitin plates strapped over both arms, a mantle of folded insect wings closed against the back" \
  "$IDLE" "$CAST" \
  "UNLEASH — the hive cells of chest and shoulders cracked wide open, arms spread low, the wing mantle unfurled to both sides"
