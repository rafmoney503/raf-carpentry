import type { Board } from './quote-sums';

/* Egger boards Raf can buy cut and edged from Cworkshop (cworkshop.co.uk), for the Quotes' "finished board, colour
   matched" option. 18 mm, 2800 x 2070 sheets; prices before VAT as Cworkshop's own pages showed them on 2 Nov 2026
   (the 18 mm price: a board page without its script shows the 8 mm one first). Only boards whose 18 mm price could
   be read are here: W980 SM Platinum White, U727, U763, U960, U999 ST7, U222, H1334, H1146 and H3734 weren't, so
   Premium White stands in for the inside. Raf can put his own price on any board in the Job Kit (Quotes, Prices).
   Feelwood oaks (ST28, ST37) are 18.5 mm. Offers end 30 Nov 2026; the normal prices there are worked out (the offer
   is 10% off), not read. The colour (hex) is only a swatch for the screen, picked by eye. Check the prices again
   now and then: BOARDS_CHECKED says when they were read. */

export const BOARDS_CHECKED = '2026-11-02';
export const CUT_CHARGE = 47.3; // Cworkshop's charge a sheet when it goes on the cutting list, 18 mm, before VAT
export const CWORKSHOP_URL = 'https://cworkshop.co.uk';
export const CWORKSHOP_CUTLIST = 'https://app.cworkshop.co.uk/cutlist';

const u = (slug: string, t = '18mm') => `https://cworkshop.co.uk/sheet-materials/egger/${slug}-chipboard-2800-x-2070mm/${t ? `${t}/` : ''}`;

export const BOARDS: Board[] = [
  // whites
  { code: 'W1000 ST9', name: 'Premium White', family: 'white', describe: 'bright neutral white, smooth soft matt', exVat: 87.07, url: u('w1000-st9-premium-white'), hex: '#f3f2ee' },
  { code: 'W1100 ST9', name: 'Alpine White', family: 'white', describe: 'very bright, slightly cool white, smooth matt', exVat: 87.07, url: u('w1100-st9-alpine-white'), hex: '#f7f8f8' },
  { code: 'W1000 ST40', name: 'Premium White Woodgrain', family: 'white', describe: 'white with a raised woodgrain, like painted timber', exVat: 109.89, url: u('w1000-st40-premium-white-woodgrain'), hex: '#f1efe9' },
  // plain colours
  { code: 'U216 ST9', name: 'Camè Beige', family: 'plain', describe: 'soft warm cream, smooth matt', exVat: 78.71, url: u('u216-st9-came-beige'), hex: '#e8dfcb' },
  { code: 'U156 ST9', name: 'Sand Beige', family: 'plain', describe: 'pale warm sandy beige, smooth matt', exVat: 78.71, url: u('u156-st9-sand-beige'), hex: '#dcd0b9' },
  { code: 'U115 ST9', name: 'Carat Beige', family: 'plain', describe: 'light beige, smooth matt', exVat: 87.07, url: u('u115-st9-carat-beige'), hex: '#d4c8b2' },
  { code: 'U250 ST9', name: 'Caramel Beige', family: 'plain', describe: 'warm mid beige brown, smooth matt', exVat: 86.22, normalExVat: 95.8, offerEnds: '2026-11-30', url: u('u250-st9-caramel-beige', ''), hex: '#b89a77' },
  { code: 'U702 ST9', name: 'Cashmere Grey', family: 'plain', describe: 'light warm grey beige (greige), smooth matt', exVat: 87.07, url: u('u702-st9-cashmere-grey'), hex: '#cdc6bb' },
  { code: 'U705 ST9', name: 'Angora Grey', family: 'plain', describe: 'light warm grey, a shade deeper than Cashmere', exVat: 87.07, url: u('u705-st9-angora-grey'), hex: '#bdb6ab' },
  { code: 'U963 ST9', name: 'Diamond Grey', family: 'plain', describe: 'mid to dark neutral grey, smooth matt', exVat: 97.91, url: u('u963-st9-diamond-grey', ''), hex: '#76787b' },
  { code: 'U767 ST9', name: 'Cubanit Grey', family: 'plain', describe: 'dark warm grey, smooth matt', exVat: 87.07, url: u('u767-st9-cubanit-grey', ''), hex: '#6c6863' },
  { code: 'U999 ST19', name: 'Black Woodgrain', family: 'plain', describe: 'deep black with a fine woodgrain texture', exVat: 104.5, url: u('u999-st19-black-woodgrain'), hex: '#262626' },
  { code: 'U638 ST9', name: 'Sage Green', family: 'colour', describe: 'soft pale sage green, smooth matt', exVat: 87.07, url: u('u638-st9-sage-green', ''), hex: '#a8b49f' },
  { code: 'U636 ST9', name: 'Fjord Green', family: 'colour', describe: 'muted grey green, smooth matt', exVat: 97.91, url: u('u636-st9-fjord-green'), hex: '#6e7d72' },
  { code: 'U502 ST9', name: 'Misty Blue', family: 'colour', describe: 'pale grey blue, smooth matt', exVat: 87.07, url: u('u502-st9-misty-blue'), hex: '#a7b6c0' },
  { code: 'U540 ST9', name: 'Denim', family: 'colour', describe: 'muted mid blue, smooth matt', exVat: 87.07, url: u('u540-st9-denim', ''), hex: '#5e7288' },
  { code: 'F186 ST9', name: 'Light Grey Chicago Concrete', family: 'stone', describe: 'light grey concrete look with soft clouding', exVat: 107.25, url: u('f186-st9-light-grey-chicago-concrete'), hex: '#b6b4b0' },
  // light oak
  { code: 'H1145 ST10', name: 'Natural Bardolino Oak', family: 'light oak', describe: 'light natural rustic oak with small knots', exVat: 104.5, url: u('h1145-st10-natural-bardolino-oak'), hex: '#c69c6e' },
  { code: 'H3303 ST10', name: 'Natural Hamilton Oak', family: 'light oak', describe: 'light to mid natural oak with a lively grain', exVat: 104.5, url: u('h3303-st10-natural-hamilton-oak'), hex: '#b98f61' },
  // warm oak
  { code: 'H3368 ST9', name: 'Natural Lancaster Oak', family: 'warm oak', describe: 'warm natural mid oak, calm straight grain, smooth', exVat: 95.8, url: u('h3368-st9-natural-lancaster-oak'), hex: '#c29b6c' },
  { code: 'H3170 ST12', name: 'Natural Kendal Oak', family: 'warm oak', describe: 'natural mid oak with knots and cracks, open grain', exVat: 104.5, url: u('h3170-st12-natural-kendal-oak'), hex: '#b8915e' },
  { code: 'H3171 ST12', name: 'Oiled Kendal Oak', family: 'warm oak', describe: 'warm honey oiled oak with knots and cracks', exVat: 104.5, url: u('h3171-st12-oiled-kendal-oak'), hex: '#b07e47' },
  { code: 'H1180 ST37', name: 'Natural Halifax Oak', family: 'warm oak', describe: 'mid oak with saw marks and knots you can feel (18.5 mm)', exVat: 128.27, url: u('h1180-st37-natural-halifax-oak', '18.5mm'), hex: '#ab8358' },
  // dark oak
  { code: 'H1313 ST10', name: 'Grey-Brown Whiteriver Oak', family: 'dark oak', describe: 'weathered grey brown oak', exVat: 104.5, url: u('h1313-st10-grey-brown-whiteriver-oak'), hex: '#8a7a68' },
  { code: 'H3325 ST28', name: 'Tobacco Gladstone Oak', family: 'dark oak', describe: 'dark tobacco brown rustic oak, grain you can feel (18.5 mm)', exVat: 115.44, normalExVat: 128.27, offerEnds: '2026-11-30', url: u('h3325-st28-tobacco-gladstone-oak', '18.5mm'), hex: '#6a4a32' },
  { code: 'H1181 ST37', name: 'Tobacco Halifax Oak', family: 'dark oak', describe: 'dark tobacco oak with saw marks and knots (18.5 mm)', exVat: 128.27, url: u('h1181-st37-tobacco-halifax-oak', '18.5mm'), hex: '#5d4330' },
  { code: 'H3133 ST12', name: 'Truffle Brown Davos Oak', family: 'dark oak', describe: 'dark truffle brown oak, open grain', exVat: 104.5, url: u('h3133-st12-truffle-brown-davos-oak'), hex: '#5a4535' },
  // walnut
  { code: 'H3700 ST10', name: 'Natural Pacific Walnut', family: 'walnut', describe: 'mid brown natural walnut with a lively grain', exVat: 104.5, url: u('h3700-st10-natural-pacific-walnut'), hex: '#7c593d' },
  { code: 'H3710 ST12', name: 'Natural Carini Walnut', family: 'walnut', describe: 'warm mid walnut, straight grain', exVat: 104.5, url: u('h3710-st12-natural-carini-walnut'), hex: '#795438' },
  { code: 'H3702 ST10', name: 'Tobacco Pacific Walnut', family: 'walnut', describe: 'dark tobacco walnut with a lively grain', exVat: 104.5, url: u('h3702-st10-tobacco-pacific-walnut'), hex: '#5a3f2f' },
];

/* The usual inside: white unless Raf picks otherwise. */
export const INSIDE_DEFAULT = 'W1000 ST9';
