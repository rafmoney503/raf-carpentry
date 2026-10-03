import SocialIcon from './SocialIcon';
import { whatsappText, whatsappUrl } from '@/lib/site';

/* Green WhatsApp button next to "Get a quote": opens WhatsApp with the first message already typed. */
export default function WhatsAppButton({
  text = whatsappText(),
  label = 'WhatsApp me',
  className = '',
}: {
  text?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a href={whatsappUrl(text)} target="_blank" rel="noopener" className={`btn btn-whatsapp gap-2.5 ${className}`}>
      <SocialIcon network="whatsapp" size={18} />
      {label}
    </a>
  );
}
