import type { BodyKey } from '../ephemeris/types.js';
import type { StyleTexts } from './types.js';

/**
 * Archetype introductions, shown when a body is selected — user test 1,
 * finding F5 ("I'm not familiar with Eris — how do we interpret that
 * psychologically?"). Written per style; the unfamiliar bodies carry
 * the most detail. AI-drafted; curation pending (stage-1c pipeline).
 */
export const BODY_INTRO: Record<BodyKey, StyleTexts> = {
  sun: {
    jungian: 'The Sun is the centre of conscious identity — the "I" that chooses, and the life-purpose that keeps recruiting the rest of the psyche. Its sign shows how becoming yourself is done; its house shows where.',
    mundane: 'The Sun marks what you organise your life around: vitality, visible identity, the roles where you must be someone rather than do something.',
    energy: 'The Sun is the system’s power source — the current every other circuit ultimately draws on. Its condition sets the whole chart’s baseline amplitude.',
    minimal: 'Core identity and purpose. Everything else orbits this.',
  },
  moon: {
    jungian: 'The Moon is the feeling nature and the inner child: what safety felt like first, and what the psyche still reaches for under stress. It runs on memory, not argument.',
    mundane: 'The Moon is daily emotional weather — moods, appetites, home habits, who and what feels comforting. It shows what you need, as distinct from what you want.',
    energy: 'The Moon is the fastest-moving current: intake, tide, replenishment. Its sign shows how the system refuels; its aspects show what interferes with refuelling.',
    minimal: 'Needs, moods, comfort. Non-negotiable, pre-rational.',
  },
  mercury: {
    jungian: 'Mercury is the messenger function — how experience gets named, connected and told. It carries the psyche’s translations between inner and outer.',
    mundane: 'Mercury covers speech, writing, learning, errands, siblings, and the everyday exchange of information.',
    energy: 'Mercury is the signal layer: bandwidth, routing, noise. Aspects to it change what gets through and how distorted.',
    minimal: 'Thinking and communicating. The interface.',
  },
  venus: {
    jungian: 'Venus is the valuing function: what the psyche finds beautiful, worthy and worth drawing close. In relationship it shows how affection is offered and recognised.',
    mundane: 'Venus covers love, taste, pleasure, money-as-enjoyment, and the manners of relating — how you attract and what you appreciate.',
    energy: 'Venus is the attracting current — it pulls rather than pushes. Its condition sets how easily the system draws in what it values.',
    minimal: 'Attraction, values, affection. What you say yes to.',
  },
  mars: {
    jungian: 'Mars is the will in action: desire that moves, anger that defends, the courage to separate and to want. Undeveloped, it either erupts or goes limp; developed, it is clean assertion.',
    mundane: 'Mars covers drive, competition, conflict style, physical energy and how you go after what you want.',
    energy: 'Mars is the discharge current — bursts, thrust, ignition. Its aspects show whether output fires cleanly or backfires.',
    minimal: 'Drive and aggression. How you push.',
  },
  jupiter: {
    jungian: 'Jupiter is the principle of meaning and growth — the inner teacher that says life is larger than this. It shows where faith comes naturally and where excess does too.',
    mundane: 'Jupiter covers opportunity, luck, travel, education, publishing and everything that expands your world — including waistlines and budgets.',
    energy: 'Jupiter is the amplifier: whatever current it touches, it turns up. Generosity and overreach are the same dial.',
    minimal: 'Growth, optimism, excess. Where more happens.',
  },
  saturn: {
    jungian: 'Saturn is the reality principle and the inner elder: limit, consequence, earned authority. What it touches matures late and lasts. Its lessons repeat until taken personally.',
    mundane: 'Saturn covers duty, structure, career ceilings and floors, delays that turn out to be curricula, and the rewards of sticking at things.',
    energy: 'Saturn is impedance and containment — it narrows current to deepen it. Pressure here is load-bearing strength being built.',
    minimal: 'Limits, discipline, time. Where the work is.',
  },
  uranus: {
    jungian: 'Uranus is the awakener: the part of the psyche that must be free and true even at the cost of belonging. It breaks what has become automatic.',
    mundane: 'Uranus covers sudden change, technology, rebellion, and the places life refuses to stay settled.',
    energy: 'Uranus is high-frequency interruption — surges, static, lightning. It resets circuits that have rusted closed.',
    minimal: 'Disruption and freedom. Where you won’t comply.',
  },
  neptune: {
    jungian: 'Neptune dissolves the ego’s boundaries: imagination, longing for the infinite, compassion — and equally glamour, fog and self-deception. It shows where you idealise.',
    mundane: 'Neptune covers dreams, art, spirituality, escapism, and areas of life that stay chronically hard to pin down.',
    energy: 'Neptune is diffusion: current spreading into mist. What it touches gains atmosphere and loses edges.',
    minimal: 'Imagination and fog. Where edges blur.',
  },
  pluto: {
    jungian: 'Pluto is the depths: buried material, compulsion, power and the psyche’s capacity to die into a truer form. What it touches cannot stay superficial.',
    mundane: 'Pluto covers crises that transform, power struggles, shared resources, and the areas of life that go through death-and-rebirth cycles.',
    energy: 'Pluto is the deep reservoir current — slow, immense pressure that periodically forces total renewal of the channel.',
    minimal: 'Depth, power, transformation. All or nothing.',
  },
  chiron: {
    jungian: 'Chiron is the wounded healer: an early injury that never fully closes, which becomes — precisely through conscious tending — the place you can guide others. Wound, coping, gift: that arc.',
    mundane: 'Chiron shows a sore spot that keeps resurfacing as real situations, and the mentoring or healing role that eventually grows there.',
    energy: 'Chiron is a lesion in the field that the system keeps routing around — each conscious pass lays down stronger tissue than unbroken wire would have.',
    minimal: 'The recurring wound and the skill it teaches.',
  },
  ceres: {
    jungian: 'Ceres is the archetype of nurture and of loss: how care was given and taken away, and the grief-and-return cycle (Demeter’s myth) written into how you feed and are fed.',
    mundane: 'Ceres covers food, caregiving, parenting styles, and separations from what one nurtures — including the workplace versions.',
    energy: 'Ceres is the nourishment cycle: provisioning, depletion, recovery. Its aspects show where the cycle sticks.',
    minimal: 'Nurture, food, loss and recovery.',
  },
  pallas: {
    jungian: 'Pallas Athene is pattern-wisdom: strategy born whole from the head, creative intelligence that sees the design in the chaos — often carrying a theme of talent in a father’s world.',
    mundane: 'Pallas covers strategy, problem-solving, crafts and politics — where you win by seeing the pattern first.',
    energy: 'Pallas is the pattern-recognition circuit: it converts noise into design. Aspects show what feeds or jams it.',
    minimal: 'Strategy and pattern-seeing.',
  },
  juno: {
    jungian: 'Juno is the committed-partnership archetype: what the psyche needs a bond to be — and the rage when the contract is betrayed. It shows the shape of "marriage" whatever its legal form.',
    mundane: 'Juno covers long-term partnership terms: loyalty, fairness, what you must have honoured to stay.',
    energy: 'Juno is the binding current between two systems — the standing commitment that persists between encounters.',
    minimal: 'Commitment terms. What the bond must honour.',
  },
  vesta: {
    jungian: 'Vesta is the hearth-keeper: devotion, focus, the sacred flame tended in privacy. It shows where wholeness comes from dedication rather than relationship.',
    mundane: 'Vesta covers focused work, service, and the practices kept up faithfully — the desk, the studio, the altar.',
    energy: 'Vesta is the pilot light: a small, constant, protected flame the rest of the system relies on.',
    minimal: 'Devotion and focus. The tended flame.',
  },
  eris: {
    jungian: 'Eris is the uninvited goddess: the excluded voice that overturns the table rather than stay unseen. In the psyche she marks where being left out turned into disruptive strength — discord in service of truth. She asks: who was not given a seat, inside you and around you?',
    mundane: 'Eris shows where exclusion and unfairness are life themes — being the outsider, naming what the group won’t — and where principled troublemaking gets results.',
    energy: 'Eris is the pressure of the unacknowledged: a slow build in whatever the system refuses to admit, released as disruption that re-orders the whole field.',
    minimal: 'The excluded voice. Disruption where something was denied a seat.',
  },
  meanNode: {
    jungian: 'The North Node is not a body but a direction: the unfamiliar quality the psyche is growing toward this lifetime (modern usage). Its opposite point, the South Node, is the over-rehearsed past.',
    mundane: 'The North Node marks the life areas that feel unfamiliar but keep rewarding effort — the direction things work out when you lean in.',
    energy: 'The Node is the system’s gradient: the slope the whole field flows along when nothing blocks it.',
    minimal: 'Growth direction (modern usage). Lean this way.',
  },
  lilith: {
    jungian: 'Black Moon Lilith (the lunar apogee) is the untamed feminine instinct: what was exiled for being too much — rage, desire, refusal — and returns with authority when reclaimed.',
    mundane: 'Lilith shows where you won’t submit, where shame was applied, and where reclaiming the banished thing changes your standing.',
    energy: 'Lilith is the far point of the lunar cycle: the instinctual current at maximum distance from domestication.',
    minimal: 'The refused, untamed part. Reclaim it or meet it as sabotage.',
  },
};
