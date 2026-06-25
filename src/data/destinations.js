/*
 * The Classic 8 destinations of Sri Lanka.
 * Map positions (u,v) are merged at runtime from /terrain/meta.json, which
 * derived them from each place's real latitude/longitude — so every marker
 * lands on the correct spot of the island.
 */
export const CATEGORIES = {
  cultural: { label: 'Cultural Triangle', color: '#c8932f' },
  hills: { label: 'Hill Country', color: '#6f9c54' },
  wildlife: { label: 'Wild Sri Lanka', color: '#b9722a' },
  coast: { label: 'Southern Coast', color: '#2f8a93' },
}

export const DESTINATIONS = [
  {
    id: 'anuradhapura',
    name: 'Anuradhapura',
    category: 'cultural',
    eyebrow: 'The Sacred City',
    region: 'North Central · 90m',
    image: '/destinations/anuradhapura.jpg',
    description:
      'The first great capital of the island, founded over two millennia ago. Colossal white dagobas rise above the plain, and the Sri Maha Bodhi — grown from a cutting of the tree under which the Buddha found enlightenment — has been tended here without pause for 2,300 years.',
  },
  {
    id: 'sigiriya',
    name: 'Sigiriya',
    category: 'cultural',
    eyebrow: 'The Lion Rock',
    region: 'Cultural Triangle · 370m',
    image: '/destinations/sigiriya.jpg',
    model: { url: '/models/sigiriya.glb', scale: 0.72, sink: -0.3 },
    description:
      'A sheer column of rock crowned by the ruins of a fifth-century sky palace. Climb past the mirror wall and the celestial frescoes, through the giant lion’s paws, to a summit garden suspended 200 metres above the jungle canopy.',
  },
  {
    id: 'kandy',
    name: 'Kandy',
    category: 'cultural',
    eyebrow: 'The Last Kingdom',
    region: 'Central Highlands · 500m',
    image: '/destinations/kandy.jpg',
    description:
      'Cradled in the hills around a misted lake, the last royal capital of Sri Lanka guards the Temple of the Sacred Tooth Relic. Each evening drums echo across the water, and once a year the Esala Perahera fills the streets with fire and elephants.',
  },
  {
    id: 'nuwaraeliya',
    name: 'Nuwara Eliya',
    category: 'hills',
    eyebrow: 'Tea Country',
    region: 'Central Highlands · 1,868m',
    image: '/destinations/nuwaraeliya.jpg',
    description:
      '“Little England” in the clouds — a hill station of mock-Tudor bungalows and clipped lawns wrapped in an emerald sea of tea. The cool air at nearly 1,900 metres has been drawing planters and pilgrims to Ceylon’s finest single-origin estates for a century and a half.',
  },
  {
    id: 'ella',
    name: 'Ella',
    category: 'hills',
    eyebrow: 'The Misty Gap',
    region: 'Uva Highlands · 1,040m',
    image: '/destinations/ella.jpg',
    description:
      'A village perched in a notch of the highlands where the land falls away to the southern plains. Walk the Nine Arches Bridge as the blue train curls through the tea, then climb Little Adam’s Peak for a dawn that pours light through the Ella Gap.',
  },
  {
    id: 'yala',
    name: 'Yala',
    category: 'wildlife',
    eyebrow: 'Leopard Country',
    region: 'South-East · sea level',
    image: '/destinations/yala.jpg',
    description:
      'Where the dry-zone forest meets the Indian Ocean, Yala holds one of the highest densities of leopard on earth. Track them past lagoons crowded with elephant, crocodile and painted stork, through a wilderness of granite and scrub.',
  },
  {
    id: 'galle',
    name: 'Galle',
    category: 'coast',
    eyebrow: 'The Dutch Fort',
    region: 'South Coast · sea level',
    image: '/destinations/galle.jpg',
    description:
      'A walled colonial port jutting into the sea, where Dutch ramparts shelter a maze of boutique-lined streets, churches and the lighthouse. The best-preserved European fortress in Asia, and the most beguiling place on the island to watch the sun fall into the ocean.',
  },
  {
    id: 'mirissa',
    name: 'Mirissa',
    category: 'coast',
    eyebrow: 'Whales & Palms',
    region: 'South Coast · sea level',
    image: '/destinations/mirissa.jpg',
    description:
      'A crescent of golden sand under leaning palms, and the launch point for the great migration: a few miles offshore lies the year-round feeding ground of the blue whale, the largest animal that has ever lived.',
  },
]
