"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

export type HomePageData = {
  heroEyebrow: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  heroImage: string;
  heroImageAlt: string;
  servicesEyebrow: string;
  servicesHeading: string;
  services: { title: string; description: string; icon: string }[];
  featuredEyebrow: string;
  featuredHeading: string;
  featuredProjects: { title: string; category: string; image: string }[];
  viewAllProjectsLabel: string;
  sketchupImage: string;
  sketchupImageAlt: string;
  sketchupEyebrow: string;
  sketchupHeadingLine1: string;
  sketchupHeadingAccent: string;
  cabinetosCTA: string;
  sketchupLearnMoreLabel: string;
  sketchupCabinetosLinkLabel: string;
  contactHeadingLine1: string;
  contactHeadingAccent: string;
  contactCTA: string;
  contactButtonLabel: string;
};

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
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

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

function StaggerItem({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function ParallaxImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={{ y }} className="relative w-full h-full">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover scale-110"
        />
      </motion.div>
    </div>
  );
}

function ScaleOnScroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <motion.div
      ref={ref}
      style={{ scale, opacity }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function HomeClient({ data }: { data: HomePageData }) {
  return (
    <main className="bg-[#0f1114] text-white overflow-x-hidden">

      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <motion.div
          className="absolute inset-0 z-0"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <Image
            src={data.heroImage}
            alt={data.heroImageAlt}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f1114]/70 via-[#0f1114]/50 to-[#0f1114]" />
        </motion.div>

        <div className="relative z-10 text-center px-6 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <span className="inline-block px-4 py-2 text-sm tracking-widest text-[#d4a853] border border-[#d4a853]/30 rounded-full mb-8">
              {data.heroEyebrow}
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-serif leading-tight mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            {data.heroTitle}
            <span className="block text-[#d4a853]">{data.heroTitleAccent}</span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7 }}
          >
            {data.heroSubtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/portfolio"
              className="px-8 py-4 bg-[#d4a853] text-black font-semibold rounded hover:bg-[#c49843] transition-all duration-300 hover:scale-105"
            >
              View My Work
            </Link>
            <Link
              href="/contact"
              className="px-8 py-4 border border-white/30 rounded hover:bg-white/10 transition-all duration-300"
            >
              Get in Touch
            </Link>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2"
          >
            <motion.div className="w-1.5 h-1.5 bg-[#d4a853] rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-20">
            <span className="text-[#d4a853] tracking-widest text-sm">{data.servicesEyebrow}</span>
            <h2 className="text-4xl md:text-6xl font-serif mt-4">
              {data.servicesHeading}
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            {data.services.map((service, index) => (
              <StaggerItem key={index}>
                <div className="group p-8 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-900/50 border border-zinc-800 hover:border-[#d4a853]/50 transition-all duration-500 hover:-translate-y-2">
                  <span className="text-5xl mb-6 block">{service.icon}</span>
                  <h3 className="text-2xl font-serif mb-4 group-hover:text-[#d4a853] transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <section className="py-32 px-6 bg-gradient-to-b from-transparent via-zinc-900/50 to-transparent">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-20">
            <span className="text-[#d4a853] tracking-widest text-sm">{data.featuredEyebrow}</span>
            <h2 className="text-4xl md:text-6xl font-serif mt-4">
              {data.featuredHeading}
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-6">
            {data.featuredProjects.map((project, index) => (
              <ScaleOnScroll key={index}>
                <Link href="/portfolio" className="group block">
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                    <ParallaxImage
                      src={project.image}
                      alt={project.title}
                      className="absolute inset-0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <span className="text-[#d4a853] text-sm tracking-widest uppercase">
                        {project.category}
                      </span>
                      <h3 className="text-2xl md:text-3xl font-serif mt-2 group-hover:translate-x-2 transition-transform duration-500">
                        {project.title}
                      </h3>
                    </div>
                  </div>
                </Link>
              </ScaleOnScroll>
            ))}
          </div>

          <AnimatedSection delay={0.3} className="text-center mt-16">
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2 text-[#d4a853] hover:gap-4 transition-all duration-300"
            >
              <span className="text-lg">{data.viewAllProjectsLabel}</span>
              <span className="text-2xl">→</span>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <StaggerContainer className="grid md:grid-cols-2 gap-12 items-center">
            <StaggerItem>
              <div className="relative aspect-square rounded-2xl overflow-hidden">
                <Image
                  src={data.sketchupImage}
                  alt={data.sketchupImageAlt}
                  fill
                  className="object-contain bg-white p-8"
                />
              </div>
            </StaggerItem>
            <StaggerItem>
              <span className="text-[#d4a853] tracking-widest text-sm">{data.sketchupEyebrow}</span>
              <h2 className="text-4xl md:text-5xl font-serif mt-4 mb-6">
                {data.sketchupHeadingLine1}<br />
                <span className="text-[#d4a853]">{data.sketchupHeadingAccent}</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                {data.cabinetosCTA}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/sketchup"
                  className="px-6 py-3 bg-[#d4a853] text-black font-semibold rounded hover:bg-[#c49843] transition-all duration-300"
                >
                  {data.sketchupLearnMoreLabel}
                </Link>
                <Link
                  href="/cabinetos"
                  className="px-6 py-3 border border-zinc-700 rounded hover:border-[#d4a853] hover:text-[#d4a853] transition-all duration-300"
                >
                  {data.sketchupCabinetosLinkLabel}
                </Link>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      <section className="py-32 px-6">
        <ScaleOnScroll>
          <div className="max-w-4xl mx-auto text-center">
            <div className="p-12 md:p-20 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4a853]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-serif mb-6">
                  {data.contactHeadingLine1}<br />
                  <span className="text-[#d4a853]">{data.contactHeadingAccent}</span>
                </h2>
                <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
                  {data.contactCTA}
                </p>
                <Link
                  href="/contact"
                  className="inline-block px-10 py-5 bg-[#d4a853] text-black text-lg font-semibold rounded hover:bg-[#c49843] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#d4a853]/20"
                >
                  {data.contactButtonLabel}
                </Link>
              </div>
            </div>
          </div>
        </ScaleOnScroll>
      </section>

    </main>
  );
}
