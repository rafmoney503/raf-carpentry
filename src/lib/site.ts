/* One place for the details that appear across the site. */

export const SITE_URL = 'https://www.rafalsolutions.co.uk';
export const COMPANY = 'Rafal Solutions Ltd';
export const COMPANY_NO = '13645392';
export const VAT_NO = '521 4613 26';
export const ADDRESS = '14 Kings Road, Wood Green, London N22 5SN';

export const PHONE_DISPLAY = '07792 860221';
export const PHONE_HREF = 'tel:+447792860221';
/* Change to 'hello@rafalsolutions.co.uk' once that alias is set up on the Microsoft 365 mailbox (see README). */
export const EMAIL = 'info@rafcarpentry.com';
export const WHATSAPP_NUMBER = '447792860221';

export const whatsappUrl = (text?: string) => `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/* Photos and screenshots, served from rafcarpentry.com (see next.config.ts). */
export const IMG = {
  cabinetosBuild: 'https://www.rafcarpentry.com/images/cabinetos/screens/build-computer.webp',
  cabinetosPhone: 'https://www.rafcarpentry.com/images/cabinetos/screens/optimise-phone.webp',
  cabinetos3d: 'https://www.rafcarpentry.com/images/cabinetos/screens/3d-computer.webp',
  planner: 'https://www.rafcarpentry.com/images/tools/wardrobe-planner-525a18cc.jpg',
  rafAtWork: 'https://www.rafcarpentry.com/images/raf-at-work.jpg',
  wardrobe: 'https://www.rafcarpentry.com/images/projects/IMG_8405.jpg',
};

export const CABINETOS_URL = 'https://www.cabinetos.co.uk';
export const RAFCARPENTRY_URL = 'https://www.rafcarpentry.com';
