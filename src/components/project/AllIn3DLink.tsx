import Link from 'next/link';

/* The way from a job's (or a service's) 3D model to the Designs in 3D page: "See 8 more wardrobes in 3D"
   (/designs/<kind>) or "See all 31 designs in 3D" (/designs). The page works out the words with in3DLink(). */
export default function AllIn3DLink({ href, label, className = 'mt-6' }: { href: string; label: string; className?: string }) {
  return (
    <p className={className}>
      <Link href={href} className="link-more">
        {label} <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}
