/**
 * Marketing home page — aligned with Figma: Wiblaster Website design (node 2002:6)
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';
import { MarketingHeader } from '../layout/MarketingHeader.jsx';

/** Static assets from Figma — served from /public/landing/ */
const LANDING_ICONS = {
  heroEmail: '/landing/hero-email.png',
  spark: '/landing/spark.png',
  integrations: [
    '/landing/integration-1.png',
    '/landing/integration-2.png',
    '/landing/integration-3.png',
    '/landing/integration-4.png',
    '/landing/integration-5.png',
    '/landing/integration-6.png',
  ],
};

const STATS = [
  { value: '100k', suffix: '+', label: 'messages sent', accent: true },
  { value: '10k', suffix: '+', label: 'Campaigns', accent: true },
  { value: '3', suffix: 'X', label: 'Faster Outreach', accent: false },
];

const STEPS = [
  {
    step: 'Step 1',
    title: 'Find your leads',
    desc: 'Discover and collect potential customers by generating and scanning store links in seconds. Easily uncover businesses and opportunities that match your target audience without manual searching.',
  },
  {
    step: 'Step 2',
    title: 'Build Your List',
    desc: 'Automatically extract and organize verified emails from the sites you scan. Turn scattered data into a clean, ready-to-use contact list built for outreach.',
  },
  {
    step: 'Step 3',
    title: 'Blast Your Message',
    desc: 'Launch personalized email campaigns with ease. Customize your message, hit send, and reach hundreds of potential customers without the manual work.',
  },
];

function PrimaryPillButton({ children, className = '', as: Tag = 'button', ...props }) {
  const classes = `inline-flex items-center justify-center h-[53px] px-6 rounded-full bg-black border border-blaster-orange text-[#faf8f5] font-poppins font-medium text-base tracking-wide shadow-blaster-cta transition hover:opacity-90 ${className}`;
  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}

function StepCard({ step, title, desc, index }) {
  return (
    <article
      className="aos-fade-up w-full max-w-[850px] bg-white border border-[rgba(99, 101, 242, 0.13)] rounded-[25px] shadow-step overflow-hidden flex flex-col md:flex-row min-h-[280px]"
      data-aos-delay={index * 80}
    >
      <div className="md:w-[400px] shrink-0 m-3 rounded-[25px] border border-[rgba(99,102,242,0.3)] bg-white shadow-step-inset min-h-[200px] md:min-h-[280px] flex items-center justify-center">
        <span className="font-poppins text-5xl font-semibold text-black/10">{index + 1}</span>
      </div>
      <div className="flex-1 p-6 md:py-8 md:pr-8 flex flex-col justify-center">
        <p className="font-poppins font-semibold text-xl text-[rgba(99,102,242,0.74)]">{step}</p>
        <h3 className="mt-2 font-rubik text-2xl md:text-[32px] text-[#030303] leading-tight">{title}</h3>
        <p className="mt-3 font-poppins font-light text-base text-[#030303] leading-relaxed max-w-md">{desc}</p>
      </div>
    </article>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [heroEmail, setHeroEmail] = useState('');
  const [heroIconVisible, setHeroIconVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroIconVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.aos-fade-up');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('aos-visible');
            const delay = e.target.getAttribute('data-aos-delay');
            if (delay) e.target.style.transitionDelay = `${delay}ms`;
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const handleHeroSubmit = (e) => {
    e.preventDefault();
    navigate('/pricing');
  };

  return (
    <div className="min-h-screen bg-blaster-bg font-poppins text-black">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative min-h-[100vh] flex flex-col justify-center px-4 sm:px-8 py-10 md:py-16 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center w-full -translate-y-10">
          <p className="font-rubik text-sm sm:text-xl text-blaster-ink tracking-wide uppercase">
            outreach made fast
          </p>

          <h1 className="mt-6 font-bold font-sans text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.05] tracking-tight text-black [text-shadow:1px_1px_0px_white]">
            Send Personalized{' '}
            <span className="whitespace-nowrap">
              Mess
              <span className="hero-email-letter relative inline-block align-baseline pt-0 pb-0">
                a
                <img
                  src={LANDING_ICONS.heroEmail}
                  alt=""
                  className={`hero-email-icon absolute left-1/2 object-contain -translate-x-1/2 -translate-y-1/2 ${heroIconVisible ? 'hero-email-icon--visible' : ''}`}
                  width={244}
                  height={71}
                  decoding="async"
                />
              </span>
              ges
            </span>{' '}
            That Actually Convert
          </h1>

          <p className="mt-8 font-rubik text-lg sm:text-xl text-blaster-ink max-w-2xl mx-auto leading-relaxed tracking-wide">
            Find leads, extract emails, and send tailored messges in minutes, all from one simple dashboard.
          </p>

          <form onSubmit={handleHeroSubmit} className="mt-10 aos-fade-up flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-0 max-w-xl mx-auto">
            <label className="sr-only" htmlFor="hero-email">
              Email
            </label>
            <input
              id="hero-email"
              type="email"
              value={heroEmail}
              onChange={(e) => setHeroEmail(e.target.value)}
              placeholder="Put Your Email Here"
              className="w-full sm:flex-1 h-14 sm:h-[55px] px-6 bg-white border border-black rounded-full sm:rounded-l-full sm:rounded-r-none text-base text-black/70 placeholder:text-black/50 font-rubik tracking-wider focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
            />
            <button
              type="submit"
              className="mt-3 sm:mt-0 shrink-0 h-[60px] px-8 rounded-full bg-black border border-blaster-orange text-[#faf8f5] font-rubik font-medium text-lg sm:text-xl tracking-wide shadow-blaster-cta hover:opacity-90 transition sm:-ml-4"
            >
              Explore Trial
            </button>
          </form>
        </div>
      </section>

      {/* Stats + integrations */}
      <section className="bg-white py-12 md:py-16 px-4 sm:px-8 border-y border-blaster-border/40">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div>
            <h2 className="font-poppins text-2xl sm:text-3xl md:text-4xl text-black leading-snug max-w-xl">
              Built for solopreneurs and fast growing ecommerce teams
            </h2>
            <div className="mt-10 flex flex-wrap gap-8 sm:gap-12">
              {STATS.map((s) => (
                <div key={s.label} className="text-center min-w-[120px]">
                  <p className="font-sans text-2xl tracking-tight">
                    <span>{s.value}</span>
                    <span className={s.accent ? 'text-blaster-purple' : 'text-black'}>{s.suffix}</span>
                  </p>
                  <p className="mt-1 font-rubik font-light text-base text-blaster-ink">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center lg:text-left">
            <p className="font-rubik font-light text-base text-blaster-ink mb-8">Works with tools you already use</p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4 sm:gap-6">
              {LANDING_ICONS.integrations.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="w-12 h-12 sm:w-[50px] sm:h-[50px] object-contain"
                  loading="lazy"
                  width={50}
                  height={50}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-blaster-bg py-16 md:py-24 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center aos-fade-up">
            <div className="inline-flex items-center gap-2 bg-black text-white rounded-full px-5 py-2 text-base font-rubik">
              <img src={LANDING_ICONS.spark} alt="" className="w-5 h-5 object-contain shrink-0" width={20} height={20} />
              How it works
            </div>
            <h2 className="mt-6 font-poppins text-2xl sm:text-3xl md:text-[32px] leading-snug max-w-2xl mx-auto">
              The 3-step system behind{' '}
              <span className="text-[#434346]">faster outreach</span>
              {' and '}
              <span className="text-[#434346]">more conversions</span>
            </h2>
          </div>

          <div className="mt-12 md:mt-16 flex flex-col items-center gap-8 md:gap-11">
            {STEPS.map((s, i) => (
              <StepCard key={s.step} {...s} index={i} />
            ))}
          </div>

          <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryPillButton as={Link} to="/pricing">
              Start Blasting
            </PrimaryPillButton>
            <Link
              to="/signup"
              className="font-poppins text-base text-black underline underline-offset-4 hover:opacity-70"
            >
              Create free account →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-8 border-t border-blaster-border bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-blaster-muted">
          <Link to="/" className="shrink-0">
            <Logo className="!w-[100px]" />
          </Link>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/pricing" className="hover:text-black transition">
              Pricing
            </Link>
            <Link to="/login" className="hover:text-black transition">
              Login
            </Link>
            <Link to="/privacy" className="hover:text-black transition">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-black transition">
              Terms
            </Link>
          </div>
          <p className="text-center sm:text-right">© {new Date().getFullYear()} wiblaster</p>
        </div>
      </footer>
    </div>
  );
}
