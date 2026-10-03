import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { Container } from '@/components/ui';
import SocialIcon from '@/components/SocialIcon';
import { GoogleRating } from '@/components/Reviews';
import { GOOGLE_WRITE_REVIEW_URL, PHONE_DISPLAY, PHONE_HREF, whatsappUrl } from '@/lib/site';

/* For customers when a job is finished: one button (and a QR code to show on Raf's phone)
   that opens the Google "write a review" box for RAF CARPENTRY. Not in the menu or in Google. */

export const metadata: Metadata = {
  title: 'Leave a review | Raf Carpentry',
  description: 'Thank you for having me. A short Google review helps other people in London find me.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/review' },
};

export default async function ReviewPage() {
  const qr = await QRCode.toString(GOOGLE_WRITE_REVIEW_URL, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#16191c', light: '#fbfbf9' },
  });

  return (
    <Container className="py-14 md:py-24">
      <div className="mx-auto max-w-[620px] text-center">
        <p className="kicker">Thank you</p>
        <h1 className="mt-3 font-display text-[40px] font-[650] leading-[1.04] tracking-[-0.025em] md:text-[56px]">
          Thanks for having me.
        </h1>
        <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted">
          If you&apos;re happy with the work, a short Google review helps other people in London find me. It takes a minute, and a photo of the finished job helps even more.
        </p>
        <a href={GOOGLE_WRITE_REVIEW_URL} target="_blank" rel="noopener" className="btn btn-primary mt-8 w-full gap-2 sm:w-auto">
          Leave a review on Google <span aria-hidden="true">↗</span>
        </a>

        <div className="mx-auto mt-12 w-fit rounded-sm border border-line-strong bg-mount p-5">
          <div className="h-[200px] w-[200px] md:h-[240px] md:w-[240px] [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR code that opens the Google review box" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-3 font-mono text-[12px] text-faint">Or scan with your phone camera</p>
        </div>

        <div className="mt-12 flex justify-center">
          <GoogleRating />
        </div>

        <div className="mt-12 border-t border-line pt-8 text-[15px] leading-relaxed text-muted">
          <p>Something not quite right? Tell me and I&apos;ll come back and sort it.</p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href={whatsappUrl('Hi Raf, it is about the job you did for me.')} target="_blank" rel="noopener" className="inline-flex items-center gap-2 font-medium text-ink hover:text-accent">
              <SocialIcon network="whatsapp" size={17} className="text-whatsapp" /> WhatsApp
            </a>
            <a href={PHONE_HREF} className="font-mono text-ink hover:text-accent">{PHONE_DISPLAY}</a>
          </p>
        </div>
      </div>
    </Container>
  );
}
