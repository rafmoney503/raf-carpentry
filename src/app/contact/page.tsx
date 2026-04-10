import { readPageJson } from '@/lib/pages';
import ContactClient, { type ContactPageData } from './contact-client';

export default function Contact() {
  const d = readPageJson<ContactPageData>('contact.json');
  return <ContactClient d={d} />;
}
