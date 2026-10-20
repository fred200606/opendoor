import { Accessibility, Clock, Eye, MessageSquare, Sparkle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchJobs } from '../api/jobs.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { homeFor } from '../auth/roles.js';
import { jobPath } from '../auth/navigation.js';
import Button from '../components/Button.jsx';
import { TextField } from '../components/form/fields.jsx';
import HeroMascot from '../components/home/HeroMascot.jsx';
import IconTile from '../components/IconTile.jsx';
import JobCard from '../components/JobCard.jsx';
import Page from '../components/Page.jsx';
import { ArrowPill } from '../components/SiteHeader.jsx';

const SUPPORT = [
  { label: 'Physical access', icon: Accessibility, tone: 'pink' },
  { label: 'Communication', icon: MessageSquare, tone: 'lilac' },
  { label: 'Work arrangement', icon: Clock, tone: 'sky' },
  { label: 'Assistive technology', icon: Eye, tone: 'orange' },
];

const STEPS = [
  {
    title: 'Tell us what you need, once',
    text: 'Add your skills and choose the workplace accommodations you need, such as a wheelchair-accessible entrance, a sign language interpreter or remote work.',
  },
  {
    title: 'See the jobs that fit you',
    text: 'Every job lists the skills it needs and the support it provides, so you see how well it fits before you apply.',
  },
  {
    title: 'Know which employers keep their word',
    text: 'People who were hired confirm whether each promised accommodation was delivered. Their answers stay anonymous.',
  },
];

const FEATURED = 3;

/** Each piece of the hero arrives a little after the one before it (still with Reduce motion). */
const step = (index) => ({ animationDelay: `${120 + index * 90}ms` });

/**
 * Home in the IPT look (Francis Ruzgal's opendoor-ipt, decision 2026-10-21b): the headline with
 * the orange highlight, what OpenDoor is, the main actions and the kinds of support beside the
 * waving mascot; then a job search, the newest jobs and how OpenDoor works. The h1 reads as one
 * sentence; the mascot, disc and sparkles are decoration.
 */
export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [featured, setFeatured] = useState(null);
  const jobsPath = user?.role === 'candidate' ? '/candidate/jobs' : '/jobs';

  // The newest open jobs. If they cannot load, Home simply leaves the section out.
  useEffect(() => {
    let active = true;
    searchJobs({ sort: 'newest' })
      .then((result) => active && setFeatured((result.data ?? []).slice(0, FEATURED)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function startSearch(event) {
    event.preventDefault();
    const words = search.trim();
    navigate(words ? `${jobsPath}?${new URLSearchParams({ q: words })}` : jobsPath);
  }

  return (
    <Page
      title="Find work that fits how you work"
      headingClassName="no-bar text-[clamp(2.25rem,1.2rem+3.4vw,3.75rem)] leading-[1.12] tracking-tight"
      heading={
        <span className="block">
          <span className="block animate-hero-text" style={step(0)}>
            Find work that
          </span>{' '}
          <span className="block animate-hero-text" style={step(1)}>
            fits <span className="od-highlight inline-block whitespace-nowrap rounded-2xl bg-orange px-3">how you work</span>
          </span>
        </span>
      }
      className="od [&_.page\_\_header]:grid [&_.page\_\_header]:items-center [&_.page\_\_header]:gap-x-10 [&_.page\_\_header]:gap-y-6 [&_.page\_\_header]:overflow-x-clip md:[&_.page\_\_header]:grid-cols-[1.2fr_1fr]"
      subtitle={
        <div className="max-w-2xl">
          <p className="mt-6 max-w-[46ch] animate-hero-text text-lg text-muted" style={step(2)}>
            A job platform for persons with disabilities in the Philippines. Every job shows the skills it needs and the workplace support it offers, and people
            who were hired confirm it was really provided.
          </p>

          <div className="mt-8 flex animate-hero-text flex-wrap gap-3" style={step(3)}>
            {user ? (
              <>
                <Link to={homeFor(user.role)} className="button group">
                  Go to my dashboard
                  <ArrowPill />
                </Link>
                <Link to={jobsPath} className="button button--secondary">
                  Find jobs
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="button group">
                  Create an account
                  <ArrowPill />
                </Link>
                <Link to="/jobs" className="button button--secondary">
                  Browse jobs
                </Link>
              </>
            )}
          </div>

          {!user && (
            <p className="mt-4 animate-hero-text" style={step(4)}>
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-primary underline underline-offset-4 hover:no-underline">
                Log in
              </Link>
            </p>
          )}

          <div className="mt-10 animate-hero-text" style={step(5)}>
            <p id="home-support" className="text-sm font-bold text-muted">
              Every job lists the support it offers:
            </p>
            <ul aria-labelledby="home-support" className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
              {SUPPORT.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm font-bold">
                  <IconTile icon={item.icon} tone={item.tone} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      actions={
        <div className="relative isolate order-first mx-auto w-full max-w-sm md:order-none md:max-w-none">
          <div aria-hidden="true" className="od-decoration absolute inset-[8%_6%_4%] -z-10 animate-fade-in rounded-full bg-primary-soft" />
          <span aria-hidden="true" className="od-decoration absolute top-[6%] left-[6%] animate-twinkle text-primary">
            <Sparkle className="size-8 fill-current" focusable="false" />
          </span>
          <span aria-hidden="true" className="od-decoration absolute right-[4%] bottom-[22%] animate-twinkle text-orange [animation-delay:1.4s]">
            <Sparkle className="size-10 fill-current" focusable="false" />
          </span>
          <div className="animate-hero-mascot" style={{ animationDelay: '380ms' }}>
            <HeroMascot />
          </div>
        </div>
      }
    >
      <section aria-labelledby="home-search-title" className="mt-14 rounded-lg border-2 border-border bg-subtle p-5 sm:p-6">
        <h2 id="home-search-title" className="text-2xl font-semibold">
          Search open jobs
        </h2>
        <form role="search" onSubmit={startSearch} className="mt-4 flex max-w-2xl flex-wrap items-end gap-3">
          <TextField
            label="Search jobs"
            name="home-search"
            type="search"
            hint="Job title, description or company name"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mb-0 min-w-0 flex-1 basis-64 [&_.field\_\_input]:max-w-none"
          />
          <Button type="submit" className="button">
            Search
          </Button>
        </form>
      </section>

      {featured?.length > 0 && (
        <section aria-labelledby="open-jobs" className="mt-12">
          <h2 id="open-jobs" className="text-2xl font-bold">
            Newest jobs
          </h2>
          <ul className="mt-4 space-y-4">
            {featured.map((job) => (
              <li key={job.id}>
                <JobCard job={job} to={jobPath(user?.role, job.id)} headingLevel={3} />
              </li>
            ))}
          </ul>
          <p className="mt-4">
            <Link to={jobsPath} className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4 hover:no-underline">
              See all jobs
            </Link>
          </p>
        </section>
      )}

      <section aria-labelledby="how-it-works" className="mt-12">
        <h2 id="how-it-works" className="text-2xl font-bold">
          How OpenDoor works
        </h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {STEPS.map((item, index) => (
            <li key={item.title} className="rounded-lg border border-border bg-surface p-5">
              <p className="font-bold text-primary">Step {index + 1}</p>
              <h3 className="mt-1 text-xl font-bold">{item.title}</h3>
              <p className="mt-2">{item.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4">
          <Link to="/trust-scores" className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4 hover:no-underline">
            How trust scores work
          </Link>
        </p>
      </section>
    </Page>
  );
}
