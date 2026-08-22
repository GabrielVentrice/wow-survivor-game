"use strict";
/* =========================================================================
   MINIONS — tuning e visual dos demonios. O efeito `summon` referencia por
   `kind`; qualquer numero declarado no efeito sobrescreve o default daqui.
   ========================================================================= */

Object.assign(MINIONS, {
  imp:          { radius: 8,  color: "#ff8a3c", ai: "ranged", speed: 220, range: 300, attackInterval: 1.1, orbitRadius: 70, duration: 10 },
  wildImp:      { radius: 7,  color: "#ffb04a", ai: "ranged", speed: 250, range: 280, attackInterval: 0.75, orbitRadius: 88, duration: 8 },
  dreadstalker: { radius: 11, color: "#8a4cff", ai: "chase",  speed: 285, range: 460, attackInterval: 0.85, duration: 14 },
  felguard:     { radius: 14, color: "#ff5a3c", ai: "anchor", speed: 270, range: 210, attackInterval: 0.8,  orbitRadius: 52, duration: 20 },
  voidwalker:   { radius: 13, color: "#5a7cff", ai: "orbit",  orbitRadius: 88, orbitSpeed: 1.25, attackInterval: 0.35, duration: 20 },
  felhunter:    { radius: 11, color: "#4ad2ff", ai: "hunter", speed: 300, range: 480, attackInterval: 0.9, duration: 14 },
  vilefiend:    { radius: 10, color: "#9fdc4a", ai: "chase",  speed: 380, range: 400, attackInterval: 0.55, duration: 12 },
  infernal:     { radius: 20, color: "#ff4020", ai: "turret", range: 300, attackInterval: 0.65, duration: 16 },
  portal:       { radius: 16, color: "#b23cff", ai: "turret", range: 360, attackInterval: 1.3, duration: 14 },
  tyrant:       { radius: 24, color: "#ffd24a", ai: "anchor", speed: 235, range: 360, attackInterval: 0.55, orbitRadius: 58, duration: 22 },
  darkglare:    { radius: 15, color: "#c850ff", ai: "turret", range: 440, attackInterval: 1.0, duration: 12 },
});
