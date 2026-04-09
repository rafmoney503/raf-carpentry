import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-[--border] bg-[--bg-card]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[--gold] to-[--gold-light] flex items-center justify-center text-[--bg] font-bold text-sm">RC</div>
              <span className="font-bold text-lg">Raf Carpentry</span>
            </div>
            <p className="text-sm text-[--text-muted] leading-relaxed">Craftsmanship meets technology. Bespoke carpentry, smart tools, and decades of expertise.</p>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-3 text-[--gold]">Services</h4>
            <div className="flex flex-col gap-2 text-sm text-[--text-muted]">
              <Link href="/portfolio" className="hover:text-[--text] transition-colors">Portfolio</Link>
              <Link href="/cabinetos" className="hover:text-[--text] transition-colors">Cabinetos App</Link>
              <Link href="/sketchup" className="hover:text-[--text] transition-colors">SketchUp</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-3 text-[--gold]">Resources</h4>
            <div className="flex flex-col gap-2 text-sm text-[--text-muted]">
              <Link href="/blog" className="hover:text-[--text] transition-colors">Blog</Link>
              <Link href="/about" className="hover:text-[--text] transition-colors">About</Link>
              <Link href="/contact" className="hover:text-[--text] transition-colors">Contact</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-3 text-[--gold]">Connect</h4>
            <div className="flex flex-col gap-2 text-sm text-[--text-muted]">
              <a href="https://www.instagram.com/raf_carpentry/" target="_blank" rel="noopener" className="hover:text-[--text] transition-colors">Instagram</a>
              <a href="https://www.tiktok.com/@rafcarpentry" target="_blank" rel="noopener" className="hover:text-[--text] transition-colors">TikTok</a>
              <a href="https://www.facebook.com/rafcarpentry/" target="_blank" rel="noopener" className="hover:text-[--text] transition-colors">Facebook</a>
            </div>
          </div>
        </div>
        <div className="border-t border-[--border] mt-10 pt-6 text-center text-xs text-[--text-muted]">
          &copy; {new Date().getFullYear()} Raf Carpentry. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
