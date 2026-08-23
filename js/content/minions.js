"use strict";
/* =========================================================================
   MINIONS — tuning e visual dos demonios. O efeito `summon` referencia por
   `kind`; qualquer numero declarado no efeito sobrescreve o default daqui.

   `sprite` aponta para SPRITE_DATA, `scale` e a altura desenhada em raios e
   `gait` diz como o bicho se mexe parado: walk (pisa), float (paira) ou
   static (plantado). Kind sem `sprite` cai no orbe generico do render.

   The `scale` values are exact on purpose: with the pixel grid, a grid can
   only show up at 1, 2 or 3 cells per row of art, and nothing in between. Half
   of these demons were being drawn SMALLER than their own grid — the 14-row
   imp was squeezed into 29 pixels, meaning the game threw away one row out of
   every two. They show up whole now. If one ended up too big for the job it
   does in the field, the fix is shrinking the GRID, not turning the scale into
   a fraction: a fraction does not shrink a drawing, it erases part of it.
   ========================================================================= */

Object.assign(MINIONS, {
  imp:          { radius: 8,  color: "#ff8a3c", sprite: "imp",          scale: 5.25, gait: "walk",   ai: "ranged", speed: 220, range: 300, attackInterval: 1.1, orbitRadius: 70, duration: 10 },
  wildImp:      { radius: 7,  color: "#ffb04a", sprite: "wildImp",      scale: 5.14, gait: "walk",   ai: "ranged", speed: 250, range: 280, attackInterval: 0.75, orbitRadius: 88, duration: 8 },
  dreadstalker: { radius: 11, color: "#8a4cff", sprite: "dreadstalker", scale: 4.36, gait: "walk",   ai: "chase",  speed: 285, range: 460, attackInterval: 0.85, duration: 14 },
  felguard:     { radius: 14, color: "#ff5a3c", sprite: "felguard",     scale: 3.64, gait: "walk",   ai: "anchor", speed: 270, range: 210, attackInterval: 0.8,  orbitRadius: 52, duration: 20 },
  voidwalker:   { radius: 13, color: "#5a7cff", sprite: "voidwalker",   scale: 3.92, gait: "float",  ai: "orbit",  orbitRadius: 88, orbitSpeed: 1.25, attackInterval: 0.35, duration: 20 },
  felhunter:    { radius: 11, color: "#4ad2ff", sprite: "felhunter",    scale: 4.09, gait: "walk",   ai: "hunter", speed: 300, range: 480, attackInterval: 0.9, duration: 14 },
  vilefiend:    { radius: 10, color: "#9fdc4a", sprite: "vilefiend",    scale: 3.30, gait: "walk",   ai: "chase",  speed: 380, range: 400, attackInterval: 0.55, duration: 12 },
  infernal:     { radius: 20, color: "#ff4020", sprite: "infernal",     scale: 2.85, gait: "static", ai: "turret", range: 300, attackInterval: 0.65, duration: 16 },
  portal:       { radius: 16, color: "#b23cff", sprite: "portal",       scale: 3.75, gait: "static", ai: "turret", range: 360, attackInterval: 1.3, duration: 14 },
  tyrant:       { radius: 24, color: "#ffd24a", sprite: "tyrant",       scale: 2.50, gait: "walk",   ai: "anchor", speed: 235, range: 360, attackInterval: 0.55, orbitRadius: 58, duration: 22 },
  darkglare:    { radius: 15, color: "#c850ff", sprite: "darkglare",    scale: 3.00, gait: "float",  ai: "turret", range: 440, attackInterval: 1.0, duration: 12 },

  /* --- hunter -------------------------------------------------------------
     `scale` 3.0 sobre raio 11 da 33 unidades desenhadas, que e 11 linhas x
     PIXEL_UNIT: degrau 1, o mesmo do resto do elenco. Nao e um numero
     arredondado — e o unico que nao poe o lobo em outra resolucao. */
  wolf:         { radius: 11, color: "#e0b833", sprite: "wolf",          scale: 3.00, gait: "walk",   ai: "flank",  speed: 320, range: 440, attackInterval: 0.7, orbitRadius: 84, duration: 14 },
});
