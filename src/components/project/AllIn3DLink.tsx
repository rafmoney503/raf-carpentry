import Link from 'next/link';

/* "See all 31 jobs in 3D": from a job's (or a service's) 3D model to the gallery of every model on the SketchUp page. */
export default function AllIn3DLink({ count, className = 'mt-6' }: { count: number; className?: string }) {
  return (
    <p className={className}>
      <Link href="/sketchup#in-3d" className="link-more">
        See all {count} jobs in 3D <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}
