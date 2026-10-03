import { readPageJson } from '@/lib/pages';
import ContactClient, { type ContactPageData } from './contact-client';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Contact | Raf Carpentry',
  description: 'Call, WhatsApp or email Raf about fitted wardrobes, alcove units and built-in furniture in London. I reply within 24 hours.',
  path: '/contact',
});

export default function Contact() {
  const d = readPageJson<ContactPageData>('contact.json');
  return <ContactClient d={d} />;
}
