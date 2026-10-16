'use client';
import { useEffect } from 'react';

/* Plays the site's moving line drawings only while they are on screen (src/app/motion.css): every element with
   `data-motion` gets `data-play` while at least a quarter of it shows, and loses it when it scrolls away, so
   each drawing starts as it comes into view and nothing animates off screen. Watches for drawings added later
   (client navigation, opened menus). Renders nothing. */
export default function MotionObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      const all = () => document.querySelectorAll('[data-motion]').forEach((el) => el.setAttribute('data-play', ''));
      all();
      const mo = new MutationObserver(all);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute('data-play', e.isIntersecting);
      },
      { threshold: 0.25 },
    );
    const watched = new Set<Element>();
    const scan = () => {
      document.querySelectorAll('[data-motion]').forEach((el) => {
        if (!watched.has(el)) {
          watched.add(el);
          io.observe(el);
        }
      });
      for (const el of watched) {
        if (!el.isConnected) {
          io.unobserve(el);
          watched.delete(el);
        }
      }
    };
    scan();
    let queued = 0;
    const mo = new MutationObserver((records) => {
      if (queued || !records.some((r) => r.addedNodes.length || r.removedNodes.length)) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(queued);
      mo.disconnect();
      io.disconnect();
    };
  }, []);
  return null;
}
