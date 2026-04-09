"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

// Animated section wrapper
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered container
function StaggerContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.15,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Flip card for benefits
function FlipCard({
  icon,
  title,
  description,
  index,
}: {
  icon: string;
  title: string;
  description: string;
  index: number;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 40, rotateX: -15 },
        visible: {
          opacity: 1,
          y: 0,
          rotateX: 0,
          transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      className="h-64 perspective-1000"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center backface-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="text-5xl mb-4">{icon}</span>
          <h3 className="text-xl font-serif text-white">{title}</h3>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#d4a853] to-[#b8923f] rounded-2xl p-8 flex items-center justify-center text-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="text-black font-medium leading-relaxed">{description}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Before/After comparison slider
function CompareSlider({
  beforeImage,
  afterImage,
  beforeLabel,
  afterLabel,
}: {
  beforeImage: string;
  afterImage: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize select-none"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* After image (full) */}
      <div className="absolute inset-0">
        <Image
          src={afterImage}
          alt={afterLabel}
          fill
          className="object-cover"
        />
        <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-1 rounded-full text-sm text-[#d4a853]">
          {afterLabel}
        </div>
      </div>

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <div className="relative w-full h-full" style={{ width: `${100 / (sliderPosition / 100)}%` }}>
          <Image
            src={beforeImage}
            alt={beforeLabel}
            fill
            className="object-cover bg-white"
            style={{ objectPosition: "left" }}
          />
        </div>
        <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1 rounded-full text-sm text-black">
          {beforeLabel}
        </div>
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
        style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg
            className="w-6 h-6 text-zinc-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// 3D tilt image
function TiltImage({ src, alt }: { src: string; alt: string }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setRotateX((y - centerY) / 20);
    setRotateY((centerX - x) / 20);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      className="relative aspect-square rounded-2xl overflow-hidden bg-white cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX,
        rotateY,
        scale: rotateX !== 0 || rotateY !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ transformStyle: "preserve-3d" }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain p-6"
      />
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
        animate={{
          opacity: rotateX !== 0 || rotateY !== 0 ? 1 : 0,
        }}
      />
    </motion.div>
  );
}

const benefits = [
  {
    icon: "🎯",
    title: "Client Visualisation",
    description:
      "Show clients photorealistic renders. Get sign-off before you start — no surprises, no disputes.",
  },
  {
    icon: "📐",
    title: "Precision Planning",
    description:
      "Every measurement is accurate. Export dimensions directly to your cut list or Cabinetos.",
  },
  {
    icon: "💰",
    title: "Better Quotes",
    description:
      "Measure materials from the model, price accurately, and win more jobs with professional presentations.",
  },
];

export default function SketchUpPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <main className="min-h-screen bg-[#0f1114] text-white overflow-x-hidden">
      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="max-w-6xl mx-auto px-6 pt-20 pb-32"
      >
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <AnimatedSection>
            <div className="space-y-6">
              <motion.span
                className="inline-block px-4 py-2 text-sm tracking-widest text-[#d4a853] border border-[#d4a853]/30 rounded-full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                THE PROCESS
              </motion.span>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-tight">
                Why I Use{" "}
                <span className="text-[#d4a853]">SketchUp</span>
              </h1>

              <div className="space-y-4 text-gray-300 text-lg">
                <p>
                  When I started using SketchUp, it completely transformed my
                  workflow. Clients could see exactly what they were getting
                  before I ordered a single board.
                </p>
                <p>
                  Mistakes dropped to almost zero. Material waste went down.
                  And quoting became faster because I could measure everything
                  digitally.
                </p>
              </div>

              <motion.div
                className="flex gap-4 pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  href="/contact"
                  className="px-6 py-3 bg-[#d4a853] text-black font-semibold rounded hover:bg-[#c49843] transition-all duration-300 hover:scale-105"
                >
                  Get a 3D Design
                </Link>
                <Link
                  href="/portfolio"
                  className="px-6 py-3 border border-zinc-700 rounded hover:border-[#d4a853] transition-all duration-300"
                >
                  See Projects
                </Link>
              </motion.div>
            </div>
          </AnimatedSection>

          {/* Right - 3D Tilt Image */}
          <AnimatedSection delay={0.3}>
            <TiltImage
              src="/images/sketchup/wardrobe-model.png"
              alt="SketchUp wardrobe design with dimensions"
            />
            <p className="text-center text-gray-400 text-sm mt-4">
              Hover to interact with the 3D model
            </p>
          </AnimatedSection>
        </div>
      </motion.section>

      {/* Benefits Section - Flip Cards */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-zinc-900/30 to-transparent">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="text-[#d4a853] tracking-widest text-sm">WHY IT MATTERS</span>
            <h2 className="text-4xl md:text-5xl font-serif mt-4">
              Benefits for <span className="text-[#d4a853]">Carpenters</span>
            </h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              Hover over each card to learn more
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <FlipCard
                key={index}
                icon={benefit.icon}
                title={benefit.title}
                description={benefit.description}
                index={index}
              />
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Before/After Comparison */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="text-[#d4a853] tracking-widest text-sm">THE RESULT</span>
            <h2 className="text-4xl md:text-5xl font-serif mt-4">
              3D Design <span className="text-[#d4a853]">vs</span> Real Build
            </h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              Drag the slider to compare the SketchUp model with the finished project
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <CompareSlider
              beforeImage="/images/sketchup/wardrobe-model.png"
              afterImage="/images/projects/built-in-wardrobes.jpg"
              beforeLabel="SketchUp Design"
              afterLabel="Finished Build"
            />
          </AnimatedSection>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: "100+", label: "Projects Designed" },
              { number: "0", label: "Build Mistakes" },
              { number: "15%", label: "Material Saved" },
              { number: "2x", label: "Faster Quoting" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                variants={{
                  hidden: { opacity: 0, scale: 0.8 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    transition: { duration: 0.5, ease: "easeOut" },
                  },
                }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-serif text-[#d4a853] mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <AnimatedSection>
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="relative p-12 md:p-16 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-800 text-center overflow-hidden"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Animated background glow */}
              <motion.div
                className="absolute top-0 right-0 w-96 h-96 bg-[#d4a853]/10 rounded-full blur-3xl"
                animate={{
                  x: [0, 50, 0],
                  y: [0, -30, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-serif mb-6">
                  Want a 3D Design<br />
                  <span className="text-[#d4a853]">for Your Project?</span>
                </h2>
                <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                  See exactly what you&apos;re getting before a single cut is made.
                  Every project starts with a detailed SketchUp model.
                </p>
                <Link
                  href="/contact"
                  className="inline-block px-10 py-4 bg-[#d4a853] text-black text-lg font-semibold rounded hover:bg-[#c49843] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#d4a853]/20"
                >
                  Get in Touch
                </Link>
              </div>
            </motion.div>
          </div>
        </AnimatedSection>
      </section>
    </main>
  );
}
