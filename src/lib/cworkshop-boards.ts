import data from '../../content/cworkshop.json' with { type: 'json' };
import { DEFAULT_PRICES, type Board, type PriceKey, type Prices } from './quote-sums';

/* Cworkshop (cworkshop.co.uk): the decors Raf can buy cut and edged, and what their services cost, for the Job Kit's
   Cworkshop screen and the Quotes' finished-board option (4 Nov 2026, Raf: 'can we create section where you will
   check Cworkshop decor finishes find prices and in quotes laminated project finish based on one or two boards ...
   and also add edge banding prices, cutting and other extra services they add').
   Everything is in content/cworkshop.json, so the weekly check (scripts/CWORKSHOP.md) changes one data file and
   nothing else. Boards: 18 mm (18.5 mm for Feelwood and some woodgrains), 2800 x 2070 sheets, the price before VAT
   that Cworkshop's own pages showed on the board's 'checked' day. A board page without its script shows the 8 mm
   price first, so a price is only taken from the page for the right thickness or from a listing page (which shows
   the 18 mm one). Services: cutting is on their pages (a sheet costs £47.30 more on the cutting list); edging,
   drilling and delivery aren't (priced live in their cutting list app), so those start as guesses until Raf types
   his own. The colour (hex) is only a swatch for the screen, picked by eye. */

export type Service = { key: PriceKey; label: string; unit: string; price: number; published: boolean; from: string; checked?: string };
export type Change = { at: string; text: string };
type Data = { checked: string; checkedBy: string; services: Service[]; leadTimes: string[]; edging: string; changes: Change[]; boards: Board[] };

export const CW = data as unknown as Data;
export const BOARDS: Board[] = CW.boards;
export const BOARDS_CHECKED = CW.checked;
export const SERVICES: Service[] = CW.services;
export const CHANGES: Change[] = CW.changes;
export const CWORKSHOP_URL = 'https://cworkshop.co.uk';
export const CWORKSHOP_CUTLIST = 'https://app.cworkshop.co.uk/cutlist';
export const CWORKSHOP_PHONE = '0208 236 2313';

const service = (k: PriceKey) => SERVICES.find((s) => s.key === k);
export const CUT_CHARGE = service('cutEdgeSheet')?.price ?? DEFAULT_PRICES.cutEdgeSheet; // a sheet on the cutting list, 18 mm, before VAT

/* Raf's price list starts from these: his own prices, with Cworkshop's service prices from the data file, so a price
   Cworkshop changes reaches every quote unless he has typed his own. */
export const PRICE_BASE: Prices = { ...DEFAULT_PRICES, ...Object.fromEntries(SERVICES.map((s) => [s.key, s.price])), boards: {} };

/* The usual inside: white unless Raf picks otherwise. */
export const INSIDE_DEFAULT = 'W1000 ST9';

/* Families in the order the screens show them. */
export const FAMILY_ORDER = ['white', 'plain', 'colour', 'stone', 'light oak', 'warm oak', 'grey oak', 'dark oak', 'walnut'];
export const FAMILY_NAME: Record<string, string> = {
  white: 'Whites',
  plain: 'Plain colours',
  colour: 'Colours',
  stone: 'Stone and marble',
  'light oak': 'Light oak',
  'warm oak': 'Warm oak',
  'grey oak': 'Grey oak',
  'dark oak': 'Dark oak',
  walnut: 'Walnut',
};
