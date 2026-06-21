/**
 * Marketing home page — aligned with Figma: Wiblaster Website design (node 2002:6)
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'react-feather';
import { Logo } from '../components/Logo.jsx';
import { MarketingHeader } from '../layout/MarketingHeader.jsx';
import LineWaves from '../components/LineWaves.jsx';
import {
  PLANS,
  formatPriceNum,
  getDisplayPrice,
  getBillingPlanId,
  storeSelectedPlan,
} from '../data/plans.js';
import { usePageSeo } from '../utils/seo.js';

const LANDING_PRICING_PLANS = PLANS.filter((p) => p.id === 'essentials' || p.id === 'standard');

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
    image: '/landing/hw1.png',
  },
  {
    step: 'Step 2',
    title: 'Build Your List',
    desc: 'Automatically extract and organize verified emails from the sites you scan. Turn scattered data into a clean, ready-to-use contact list built for outreach.',
    image: '/landing/hw2.png',
  },
  {
    step: 'Step 3',
    title: 'Blast Your Message',
    desc: 'Launch personalized email campaigns with ease. Customize your message, hit send, and reach hundreds of potential customers without the manual work.',
    image: '/landing/hw3.png',
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

function PlayIcon() {
  const gradientId = React.useId().replace(/:/g, '');
  return (
    <svg className="w-10 h-10 sm:w-12 sm:h-12 ml-1" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#fcb04c" />
        </linearGradient>
      </defs>
      <path
        d="M8 5.14v14.72a1 1 0 001.5.86l11.04-7.36a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

const DEMO_VIDEO_URL =
  'https://res.cloudinary.com/dhe2bjp2a/video/upload/v1781834623/prev_oubsh6.mp4';

function DemoVideoModal({ open, onClose, videoRef }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
  }, [open, videoRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Demo video"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl animate-[demo-video-in_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 sm:top-0 sm:-right-12 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Close video"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <video
          ref={videoRef}
          src={DEMO_VIDEO_URL}
          className="w-full max-h-[85vh] rounded-2xl bg-black shadow-2xl"
          controls
          playsInline
          preload="auto"
        />
      </div>
    </div>
  );
}

function DemoSection() {
  const [videoOpen, setVideoOpen] = useState(false);
  const modalVideoRef = React.useRef(null);

  const openVideo = () => setVideoOpen(true);
  const closeVideo = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.pause();
    }
    setVideoOpen(false);
  };

  return (
    <section id="demo" className="bg-black py-16 md:py-24 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <button
          type="button"
          onClick={openVideo}
          className="aos-fade-up flex items-center justify-center gap-2 w-full text-white font-rubik text-base sm:text-lg hover:opacity-80 transition focus:outline-none focus:ring-2 focus:ring-white/30 rounded-lg"
        >
          <img src={LANDING_ICONS.spark} alt="" className="w-5 h-5 object-contain shrink-0" width={20} height={20} />
          <span>Watch a demo</span>
        </button>

        <article className="aos-fade-up mt-8 md:mt-10 w-full max-w-[850px] mx-auto bg-white border border-[rgba(99,101,242,0.13)] rounded-[25px] shadow-step overflow-hidden flex flex-col md:flex-row min-h-[280px]">
          <div className="md:w-[400px] shrink-0 m-3 rounded-[25px] border border-[rgba(99,102,242,0.3)] bg-blaster-bg shadow-step-inset min-h-[200px] md:min-h-[280px] flex items-center justify-center overflow-hidden">
            <button
              type="button"
              onClick={openVideo}
              className="group relative w-full h-full min-h-[200px] md:min-h-[280px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blaster-purple/40 focus:ring-inset rounded-[20px]"
              aria-label="Play demo video"
            >
              <video
                src={DEMO_VIDEO_URL}
                className="absolute inset-0 w-full h-full object-cover rounded-[20px]"
                muted
                playsInline
                preload="metadata"
                tabIndex={-1}
                aria-hidden
              />
              <span className="absolute inset-0 rounded-[20px] bg-black/15 transition group-hover:bg-black/25" aria-hidden />
              <span className="relative z-10 flex items-center justify-center w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] rounded-full bg-brand-gradient-soft border border-blaster-accent/20 transition group-hover:opacity-90">
                <PlayIcon />
              </span>
            </button>
          </div>
          <div className="flex-1 p-6 md:py-8 md:pr-8 flex flex-col justify-center">
            <h3 className="font-poppins font-semibold text-xl sm:text-2xl text-brand-gradient leading-snug">
              How Does Wiblaster Work?
            </h3>
            <p className="mt-3 font-poppins font-light text-base text-[#030303] leading-relaxed max-w-md">
              See how to filter businesses, extract quality leads, and set up personalized messaging campaigns, all from one simple workflow designed to save time and scale your outreach faster.
            </p>
          </div>
        </article>
      </div>

      <DemoVideoModal open={videoOpen} onClose={closeVideo} videoRef={modalVideoRef} />
    </section>
  );
}

function MiniPricingCard({ plan, isAnnually, featured }) {
  const display = getDisplayPrice(plan.price, isAnnually, plan.period);
  const priceLabel = isAnnually ? '/ yr' : '/ mo';

  const handleSubscribe = () => {
    storeSelectedPlan(getBillingPlanId(plan, isAnnually));
  };

  return (
    <article
      className={`relative flex flex-col rounded-2xl border bg-white p-6 sm:p-8 shadow-step ${
        featured
          ? 'border-black ring-1 ring-black'
          : 'border-blaster-border'
      }`}
    >
      {featured && plan.tag && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
          {plan.tag}
        </span>
      )}
      <h3 className="font-poppins text-lg font-semibold text-black">{plan.name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-poppins text-4xl sm:text-5xl font-bold tracking-tight text-black">
          ${formatPriceNum(display.primary)}
        </span>
        <span className="text-sm text-blaster-muted font-rubik">{priceLabel}</span>
      </div>
      {display.secondary != null && (
        <p className="mt-1 text-xs text-blaster-muted font-rubik">
          (~${formatPriceNum(display.secondary)}/mo billed annually)
        </p>
      )}
      <ul className="mt-6 space-y-3 flex-1">
        {plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-blaster-fg">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/signup?from=pricing"
        onClick={handleSubscribe}
        className="mt-8 block w-full py-3 rounded-xl bg-black text-white text-center text-sm font-medium font-rubik hover:opacity-90 transition"
      >
        Subscribe
      </Link>
    </article>
  );
}

function LandingPricingSection() {
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const isAnnually = billingPeriod === 'annually';

  return (
    <section id="pricing" className="bg-white py-16 md:py-24 px-4 sm:px-8 border-t border-blaster-border/40">
      <div className="max-w-4xl mx-auto">
        <div className="text-center aos-fade-up">
          <h2 className="font-poppins text-2xl sm:text-3xl md:text-4xl font-bold text-black">
            Simple, transparent pricing
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className={`text-sm font-medium ${!isAnnually ? 'text-black' : 'text-blaster-muted'}`}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAnnually}
              onClick={() => setBillingPeriod((p) => (p === 'monthly' ? 'annually' : 'monthly'))}
              className="relative inline-flex h-7 w-12 shrink-0 rounded-full border border-blaster-border bg-blaster-bg transition-colors focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-black shadow-sm transition-transform mt-0.5 ml-0.5 ${
                  isAnnually ? 'translate-x-[22px]' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isAnnually ? 'text-black' : 'text-blaster-muted'}`}>
                Annually
              </span>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Save 2 months
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 aos-fade-up">
          {LANDING_PRICING_PLANS.map((plan) => (
            <MiniPricingCard
              key={plan.id}
              plan={plan}
              isAnnually={isAnnually}
              featured={plan.id === 'standard'}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-blaster-muted font-rubik aos-fade-up">
          Need Pro or want to compare everything?{' '}
          <Link to="/pricing" className="text-black underline underline-offset-4 hover:opacity-70">
            View all plans
          </Link>
        </p>
      </div>
    </section>
  );
}

function LandingCtaSection() {
  return (
    <section className="bg-blaster-bg py-16 md:py-24 px-4 sm:px-8">
      <div className="max-w-2xl mx-auto text-center aos-fade-up">
        <h2 className="font-poppins text-2xl sm:text-3xl md:text-4xl font-bold text-black leading-snug">
          Ready to find your next lead?
        </h2>
        <p className="mt-4 font-rubik text-base sm:text-lg text-blaster-muted">
          Start with a $1 three-day trial — full scanner & campaigns, 20 store filters included.
        </p>
        <PrimaryPillButton as={Link} to="/signup" className="mt-8">
          Get started
        </PrimaryPillButton>
      </div>
    </section>
  );
}

function StepCard({ step, title, desc, image, index }) {
  return (
    <article
      className="aos-fade-up w-full max-w-[850px] bg-white border border-[rgba(99, 101, 242, 0.13)] rounded-[25px] shadow-step overflow-hidden flex flex-col md:flex-row min-h-[280px]"
      data-aos-delay={index * 80}
    >
      <div className="md:w-[400px] shrink-0 m-3 rounded-[25px] border border-[rgba(99,102,242,0.3)] bg-white shadow-step-inset min-h-[200px] md:min-h-[280px] flex items-center justify-center overflow-hidden">
        {image ? (
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover rounded-[20px]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="font-poppins text-5xl font-semibold text-black/10">{index + 1}</span>
        )}
      </div>
      <div className="flex-1 p-6 md:py-8 md:pr-8 flex flex-col justify-center">
        <p className="font-poppins font-semibold text-xl text-brand-gradient">{step}</p>
        <h3 className="mt-2 font-rubik text-2xl md:text-[32px] text-[#030303] leading-tight">{title}</h3>
        <p className="mt-3 font-poppins font-light text-base text-[#030303] leading-relaxed max-w-md">{desc}</p>
      </div>
    </article>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  usePageSeo('home');
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
    storeSelectedPlan('trial_3day');
    navigate('/signup?from=pricing');
  };

  return (
    <div className="min-h-screen bg-blaster-bg font-poppins text-black">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative min-h-[100vh] flex flex-col justify-center px-4 sm:px-8 py-10 md:py-16 overflow-hidden bg-blaster-bg">
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" aria-hidden>
          <LineWaves
            speed={0.3}
            innerLineCount={32}
            outerLineCount={36}
            warpIntensity={1}
            rotation={-45}
            edgeFadeWidth={0}
            colorCycleSpeed={1}
            brightness={0.2}
            color1="#faf8f5"
            color2="#6366f2"
            color3="#fcb04c"
            enableMouseInteraction={false}
            mouseInfluence={2}
          />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center w-full -translate-y-10">
          <div className="inline-flex items-center gap-2 bg-black text-white rounded-full px-5 py-2 text-base font-rubik">
            <img src={LANDING_ICONS.spark} alt="" className="w-5 h-5 object-contain shrink-0" width={20} height={20} />
            Outreach made fast
          </div>

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
              Try for $1
            </button>
          </form>
        </div>
      </section>

      {/* Stats + integrations */}
      <section className="bg-white py-12 md:py-16 px-4 sm:px-[95px] border-y border-blaster-border/40">
        <div className="max-w-7xl mx-auto flex flex-col items-center lg:flex-row lg:items-center lg:justify-between gap-12 lg:gap-8">
          <div className="text-center lg:text-left">
            <h2 className="font-poppins text-2xl sm:text-3xl md:text-4xl text-black leading-snug max-w-xl mx-auto lg:mx-0">
              Built for solopreneurs and fast growing ecommerce teams
            </h2>
            <div className="mt-10 flex flex-wrap justify-center lg:justify-start gap-8 sm:gap-12">
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
          <div className="text-center lg:text-right w-full lg:w-auto lg:ml-auto">
            <p className="font-rubik font-light text-base text-blaster-ink mb-8">Works with tools you already use</p>
            <div className="flex flex-wrap justify-center lg:justify-end gap-4 sm:gap-6">
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

      <DemoSection />

      <LandingPricingSection />

      <LandingCtaSection />

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
