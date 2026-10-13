import { Accessibility, ArrowUpRight, Clock, Eye, MessageSquare, Sparkle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import IconTile from '../components/IconTile.jsx';
import Page from '../components/Page.jsx';

const SUPPORT = [
  { label: 'Physical access', icon: Accessibility, tone: 'pink' },
  { label: 'Communication', icon: MessageSquare, tone: 'lilac' },
  { label: 'Work setup', icon: Clock, tone: 'sky' },
  { label: 'Assistive tech', icon: Eye, tone: 'orange' },
];

/** Figma "3.1 Home". The sparkle pill and the highlight are decorative; the h1 reads as one sentence. */
export default function HomePage() {
  const { user } = useAuth();
  const candidate = user?.role === 'candidate';

  const steps = [
    { title: '1 · Say what you need', text: 'Tick the workplace support that helps you.', link: 'Set your needs', to: candidate ? '/candidate/profile' : '/register' },
    { title: '2 · See matching jobs', text: 'Every job lists the support it offers.', link: 'Browse jobs', to: candidate ? '/candidate/jobs' : '/jobs', featured: true },
    { title: '3 · Check it was real', text: '30 days after hiring, employees confirm it.', link: 'How trust scores work', to: '/trust-scores' },
  ];

  return (
    <Page
      title="Find work that fits how you work"
      className="home"
      heading={
        <>
          <span className="home__line">
            Find work that
            <span className="home__sparkle decoration" aria-hidden="true">
              <Sparkle focusable="false" />
            </span>
          </span>{' '}
          <span className="home__line">
            fits <span className="home__highlight">how you work</span>
          </span>
        </>
      }
    >
      <p className="home__lead">Jobs show the workplace support they offer, and hired employees confirm it was provided.</p>
      <p className="actions home__actions">
        <Link to={candidate ? '/candidate/jobs' : '/jobs'} className="button">
          Browse jobs
          <span className="button__arrow" aria-hidden="true">
            <ArrowUpRight focusable="false" />
          </span>
        </Link>
        {!user && (
          <Link to="/register" className="button button--secondary">
            Create an account
          </Link>
        )}
      </p>

      <ul className="home__support" aria-label="Workplace support you can search for">
        {SUPPORT.map((item) => (
          <li key={item.label}>
            <IconTile icon={item.icon} tone={item.tone} size="lg" />
            {item.label}
          </li>
        ))}
      </ul>

      <section className="home__how" aria-labelledby="how-title">
        <h2 id="how-title" className="home__how-title">
          <Sparkle className="decoration" aria-hidden="true" focusable="false" />
          How it works
          <Sparkle className="decoration" aria-hidden="true" focusable="false" />
        </h2>
        <ol className="home__steps">
          {steps.map((step) => (
            <li key={step.title} className={`home__step ${step.featured ? 'home__step--featured' : ''}`.trim()}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <Link to={step.to} className="home__step-link">
                <span className="home__step-arrow" aria-hidden="true">
                  <ArrowUpRight focusable="false" />
                </span>
                {step.link}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </Page>
  );
}
