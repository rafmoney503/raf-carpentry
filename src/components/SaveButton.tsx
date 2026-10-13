'use client';
import { toggleSaved, useSaved, type SavedItem } from '@/lib/saved';

/* The heart: saves a job or 3D design for the visitor's brief (src/lib/saved.ts). 'button' is the full
   "Save for my brief" button beside Get a quote; 'icon' is the round heart on a photo or still, placed by
   the parent (it sits outside the card's link, so the two never nest). */

export function Heart({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="flex-none">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

export default function SaveButton({ item, variant = 'button', className = '' }: { item: SavedItem; variant?: 'button' | 'icon'; className?: string }) {
  const saved = useSaved();
  const on = saved.some((x) => x.id === item.id);
  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved(item);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={click}
        aria-pressed={on}
        aria-label={on ? `Saved: remove ${item.title} from my brief` : `Save ${item.title} for my brief`}
        title={on ? 'Saved for your brief' : 'Save for my brief'}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_2px_8px_rgb(22_25_28/0.12)] transition-colors ${on ? 'border-accent bg-mount text-accent' : 'border-line-strong bg-mount/90 text-ink hover:border-accent hover:text-accent'} ${className}`}
      >
        <Heart on={on} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      className={`btn gap-2.5 border ${on ? 'border-accent bg-accent/10 text-accent hover:bg-accent/15' : 'btn-ghost'} ${className}`}
    >
      <Heart on={on} />
      {on ? 'Saved for my brief' : 'Save for my brief'}
    </button>
  );
}
