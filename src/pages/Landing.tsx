/**
 * Port of Cruip `open-react-template` home (`app/(default)/page.tsx` + section components).
 * Raster assets + video are loaded from the upstream repo (local sample only ships SVGs).
 * @see https://github.com/cruip/open-react-template
 */
import { Link } from 'react-router-dom'
import { defaultDocHref } from '../lib/docRoutes'
import { HeroProviderCarousel } from '../components/ProviderLogosCarousel'
import WorkflowCards from '../components/WorkflowCards'
import { 
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type Ref,
} from 'react'

/** Official template `public/` root — matches GitHub `cruip/open-react-template@master` */
const OPEN_SAMPLE_PUBLIC = 'https://raw.githubusercontent.com/cruip/open-react-template/master/public'

const img = (name: string) => `${OPEN_SAMPLE_PUBLIC}/images/${name}`

const landingTitleClass = 'font-nacelle font-semibold text-slate-900 dark:text-marketing-text'

/** Secondary outline CTA — dark styles: `.dark .open-sample .landing-secondary-cta` in index.css */
const secondaryCtaClass =
  'landing-secondary-cta btn relative w-full bg-gradient-to-b from-white to-slate-100 bg-[length:100%_100%] bg-bottom text-slate-800 shadow-sm border border-slate-300/70 hover:bg-[length:100%_150%] sm:ml-4 sm:w-auto'

function PageIllustration({ multiple = false }: { multiple?: boolean }) {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 -translate-x-1/4 opacity-50 dark:opacity-100" aria-hidden>
        <img
          className="landing-deco-img max-w-none opacity-90 saturate-[0.95] dark:opacity-100 dark:saturate-100"
          src={img('page-illustration.svg')}
          width={846}
          height={594}
          alt=""
        />
      </div>
      {multiple && (
        <>
          <div
            className="pointer-events-none absolute left-1/2 top-[400px] -z-10 -mt-20 -translate-x-full opacity-30 dark:opacity-50"
            aria-hidden
          >
            <img
              className="landing-deco-img max-w-none opacity-90 dark:opacity-100"
              src={img('blurred-shape-gray.svg')}
              width={760}
              height={668}
              alt=""
            />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-[440px] -z-10 -translate-x-1/3 opacity-40 dark:opacity-100" aria-hidden>
            <img
              className="landing-deco-img max-w-none opacity-90 dark:opacity-100"
              src={img('blurred-shape.svg')}
              width={760}
              height={668}
              alt=""
            />
          </div>
        </>
      )}
    </>
  )
}

function HeroHome() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="py-12 md:py-20">
          <div className="pb-12 text-center md:pb-20">
            <h1 className={`${landingTitleClass} pb-5 text-open-4xl md:text-open-5xl`}>
              The PM for your AI coding agents
            </h1>
            <div className="mx-auto max-w-3xl">
              <p className="mb-8 text-open-xl text-slate-600 dark:text-marketing-muted">
                TaskMaster AI turns PRDs into structured, dependency-aware tasks—so your CLI, MCP, and dashboard stay in
                sync from plan to merge. Built for Cursor, Windsurf, VS Code, and every workflow that ships with AI.
              </p>
              <div className="mx-auto max-w-xs sm:flex sm:max-w-none sm:justify-center">
                <div>
                  <Link
                    className="landing-primary-cta btn group mb-4 w-full bg-gradient-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-bottom text-white shadow-[inset_0px_1px_0px_0px_color-mix(in_srgb,var(--color-white)_16%,transparent)] hover:bg-[length:100%_150%] sm:mb-0 sm:w-auto"
                    to="/signup?plan=pro"
                  >
                    <span className="relative inline-flex items-center">
                      Get started
                      <span className="ml-1 tracking-normal text-white/50 transition-transform group-hover:translate-x-0.5">
                        -&gt;
                      </span>
                    </span>
                  </Link>
                </div>
                <div className="mb-4 sm:mb-0">
                  <Link className={secondaryCtaClass} to="/pricing">
                    View pricing
                  </Link>
                </div>
                <div>
                  <Link className={secondaryCtaClass} to={defaultDocHref()}>
                    View docs
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <HeroProviderCarousel />
        </div>
      </div>
    </section>
  )
}

function Workflows() {
  return (
    <section className="relative z-[1]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="pb-12 md:pb-20">
          <div className="mx-auto max-w-3xl pb-12 text-center md:pb-20">
            <div className="inline-flex items-center gap-3 pb-3 before:h-px before:w-8 before:bg-gradient-to-r before:from-transparent before:to-indigo-200/50 after:h-px after:w-8 after:bg-gradient-to-l after:from-transparent after:to-indigo-200/50 dark:before:to-indigo-400/35 dark:after:to-indigo-400/35">
              <span className="inline-flex bg-gradient-to-r from-indigo-500 to-indigo-200 bg-clip-text text-transparent dark:from-indigo-400 dark:to-indigo-200">
                How it works
              </span>
            </div>
            <h2 className={`${landingTitleClass} pb-4 text-open-3xl md:text-open-4xl`}>From PRD to tasks your agents can run</h2>
            <p className="text-open-lg text-slate-600 dark:text-marketing-muted">
              Parse requirements, break work into steps, and track dependencies in one place—then drive it from the
              terminal, your editor, or the web app. No more lost context between your spec and your AI tools.
            </p>
          </div>
          <WorkflowCards />
        </div>
      </div>
    </section>
  )
}

const featurePlatformIconClass =
  'mb-3 h-6 w-6 shrink-0 fill-current text-indigo-600 dark:text-accent-primary'

function Features() {
  return (
    <section className="relative z-[1]">
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 -mt-20 -translate-x-1/2 opacity-40 dark:opacity-100"
        aria-hidden="true"
      >
        <img
          className="landing-deco-img max-w-none opacity-90 dark:opacity-100"
          src={img('blurred-shape-gray.svg')}
          width={760}
          height={668}
          alt=""
        />
      </div>
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -z-10 -mb-80 -translate-x-[120%] opacity-30 dark:opacity-50"
        aria-hidden="true"
      >
        <img
          className="landing-deco-img max-w-none opacity-90 dark:opacity-100"
          src={img('blurred-shape.svg')}
          width={760}
          height={668}
          alt=""
        />
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="open-sample-section-divider py-12 md:py-20">
          <div className="mx-auto max-w-3xl pb-12 text-center md:pb-16">
            <div className="inline-flex items-center gap-3 pb-3 before:h-px before:w-8 before:bg-gradient-to-r before:from-transparent before:to-indigo-200/50 after:h-px after:w-8 after:bg-gradient-to-l after:from-transparent after:to-indigo-200/50 dark:before:to-indigo-400/35 dark:after:to-indigo-400/35">
              <span className="inline-flex bg-gradient-to-r from-indigo-500 to-indigo-200 bg-clip-text text-transparent dark:from-indigo-400 dark:to-indigo-200">
                Platform
              </span>
            </div>
            <h2
              className={`${landingTitleClass} block w-full whitespace-normal pb-4 text-open-2xl sm:inline-block sm:w-auto sm:max-w-none sm:whitespace-nowrap sm:text-open-3xl md:text-open-4xl`}
            >
              Everything your agents need to stay on track
            </h2>
            <p className="text-open-lg text-slate-600 dark:text-marketing-muted">
              Complexity scoring, task expansion, research mode, hosted or bring-your-own API keys, and usage that syncs to
              your account—so you ship faster without juggling five different tools.
            </p>
          </div>
          <div className="mx-auto grid max-w-sm gap-12 sm:max-w-none sm:grid-cols-2 md:gap-x-14 md:gap-y-16 lg:grid-cols-3">
            <article>
              <svg className={featurePlatformIconClass} xmlns="http://www.w3.org/2000/svg" width={24} height={24}>
                <path fill="currentColor" d="M0 0h14v17H0V0Zm2 2v13h10V2H2Z" />
                <path
                  fill="currentColor"
                  fillOpacity={0.48}
                  d="m16.295 5.393 7.528 2.034-4.436 16.412L5.87 20.185l.522-1.93 11.585 3.132 3.392-12.55-5.597-1.514.522-1.93Z"
                />
              </svg>
              <h3 className="mb-1 font-nacelle text-[1rem] font-semibold text-slate-900 dark:text-marketing-text">Task hierarchy</h3>
              <p className="text-slate-600 dark:text-marketing-muted">
                Nested tasks and subtasks with stable IDs so agents, humans, and your PRD all reference the same work.
              </p>
            </article>
            <article>
              <svg className={featurePlatformIconClass} xmlns="http://www.w3.org/2000/svg" width={24} height={24}>
                <path fill="currentColor" fillOpacity={0.48} d="M7 8V0H5v8h2Zm12 16v-4h-2v4h2Z" />
                <path fill="currentColor" d="M19 6H0v2h17v8H7v-6H5v8h19v-2h-5V6Z" />
              </svg>
              <h3 className="mb-1 font-nacelle text-[1rem] font-semibold text-slate-900 dark:text-marketing-text">Dashboard &amp; sync</h3>
              <p className="text-slate-600 dark:text-marketing-muted">
                See tasks and usage in the browser while the CLI keeps your repo as the source of truth.
              </p>
            </article>
            <article>
              <svg className={featurePlatformIconClass} xmlns="http://www.w3.org/2000/svg" width={24} height={24}>
                <path
                  fill="currentColor"
                  d="M23.414 6 18 .586 16.586 2l3 3H7a6 6 0 0 0-6 6h2a4 4 0 0 1 4-4h12.586l-3 3L18 11.414 23.414 6Z"
                />
                <path
                  fill="currentColor"
                  fillOpacity={0.48}
                  d="M13.01 12.508a2.5 2.5 0 0 0-3.502.482L1.797 23.16.203 21.952l7.71-10.17a4.5 4.5 0 1 1 7.172 5.437l-4.84 6.386-1.594-1.209 4.841-6.385a2.5 2.5 0 0 0-.482-3.503Z"
                />
              </svg>
              <h3 className="mb-1 font-nacelle text-[1rem] font-semibold text-slate-900 dark:text-marketing-text">Next task &amp; deps</h3>
              <p className="text-slate-600 dark:text-marketing-muted">
                Dependency-aware &quot;what&apos;s next&quot; so agents stop guessing which task to implement first.
              </p>
            </article>
            <article>
              <svg className={featurePlatformIconClass} xmlns="http://www.w3.org/2000/svg" width={24} height={24}>
                <path
                  fill="currentColor"
                  fillOpacity={0.48}
                  d="m3.031 9.05-.593-.805 1.609-1.187.594.804a6.966 6.966 0 0 1 0 8.276l-.594.805-1.61-1.188.594-.805a4.966 4.966 0 0 0 0-5.9Z"
                />
                <path
                  fill="currentColor"
                  d="m7.456 6.676-.535-.845 1.69-1.07.534.844a11.944 11.944 0 0 1 0 12.789l-.535.845-1.69-1.071.536-.845a9.944 9.944 0 0 0 0-10.647Z"
                />
                <path
                  fill="currentColor"
                  fillOpacity={0.48}
                  d="m11.888 4.35-.514-.858 1.717-1.027.513.858a16.9 16.9 0 0 1 2.4 8.677 16.9 16.9 0 0 1-2.4 8.676l-.513.859-1.717-1.028.514-.858A14.9 14.9 0 0 0 14.003 12a14.9 14.9 0 0 0-2.115-7.65Z"
                />
                <path
                  fill="currentColor"
                  d="m16.321 2-.5-.866 1.733-1 .5.866A22 22 0 0 1 21 12c0 3.852-1.017 7.636-2.948 10.97l-.502.865-1.73-1.003.501-.865A19.878 19.878 0 0 0 19 12a20 20 0 0 0-2.679-10Z"
                />
              </svg>
              <h3 className="mb-1 font-nacelle text-[1rem] font-semibold text-slate-900 dark:text-marketing-text">PRD parsing &amp; planning</h3>
              <p className="text-slate-600 dark:text-marketing-muted">
                Go from product doc to structured tasks in one pass—ready for breakdown and implementation.
              </p>
            </article>
            <article>
              <svg className={featurePlatformIconClass} xmlns="http://www.w3.org/2000/svg" width={24} height={24}>
                <path
                  fill="currentColor"
                  fillOpacity={0.48}
                  d="M12 8.8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"
                />
                <path
                  fill="currentColor"
                  d="m7.454 2.891.891-.454L7.437.655l-.891.454a12 12 0 0 0 0 21.382l.89.454.91-1.781-.892-.455a10 10 0 0 1 0-17.818ZM17.456 1.11l-.891-.454-.909 1.782.891.454a10 10 0 0 1 0 17.819l-.89.454.908 1.781.89-.454a12 12 0 0 0 0-21.382Z"
                />
              </svg>
              <h3 className="mb-1 font-nacelle text-[1rem] font-semibold text-slate-900 dark:text-marketing-text">Models per role</h3>
              <p className="text-slate-600 dark:text-marketing-muted">
                Point main, research, and fallback models at the providers you trust—OpenAI, Anthropic, Gemini, and more.
              </p>
            </article>
            <article>
              <svg className={featurePlatformIconClass} xmlns="http://www.w3.org/2000/svg" width={24} height={24}>
                <path
                  fill="currentColor"
                  fillOpacity={0.48}
                  d="M19 8h5v2h-5V8Zm-4 5h9v2h-9v-2Zm9 5H11v2h13v-2Z"
                />
                <path
                  fill="currentColor"
                  d="M19.406 3.844 6.083 20.497.586 15 2 13.586l3.917 3.917L17.844 2.595l1.562 1.25Z"
                />
              </svg>
              <h3 className="mb-1 font-nacelle text-[1rem] font-semibold text-slate-900 dark:text-marketing-text">Usage &amp; activity</h3>
              <p className="text-slate-600 dark:text-marketing-muted">
                Transparent usage and recent operations so you know what your agents consumed this month.
              </p>
            </article>
            </div>
          </div>
        </div>
      </section>
  )
}

function useMasonry(category: number): RefObject<HTMLDivElement | null> {
  const masonryContainer = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<ChildNode[]>([])

  const elementLeft = (el: HTMLElement) => el.getBoundingClientRect().left
  const elementTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY
  const elementBottom = (el: HTMLElement) => el.getBoundingClientRect().bottom + window.scrollY

  useEffect(() => {
    if (masonryContainer.current) {
      setItems(Array.from(masonryContainer.current.children))
    }
  }, [])

  const handleMasonry = useCallback(() => {
    const nodes = items
    if (!nodes || nodes.length < 1) return
    let gapSize = 0
    if (masonryContainer.current) {
      gapSize = parseInt(
        window.getComputedStyle(masonryContainer.current).getPropertyValue('grid-row-gap'),
        10,
      )
    }
    nodes.forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      let previous = el.previousSibling
      el.style.marginTop = '0'
      while (previous) {
        if (previous.nodeType === 1) {
          if (previous instanceof HTMLElement && elementLeft(previous) === elementLeft(el)) {
            el.style.marginTop = `${-(elementTop(el) - elementBottom(previous) - gapSize)}px`
            break
          }
        }
        previous = previous.previousSibling
      }
    })
  }, [items])

  useEffect(() => {
    handleMasonry()
    window.addEventListener('resize', handleMasonry)
    return () => window.removeEventListener('resize', handleMasonry)
  }, [handleMasonry, category])

  return masonryContainer
}

/** Dev-tool marks (Simple Icons CDN) — illustrative, not endorsements */
const devLogo = (slug: string) => `https://cdn.simpleicons.org/${slug}`

const testimonialsData = [
  {
    img: img('testimonial-01.jpg'),
    clientImg: devLogo('cursor'),
    clientLogoAlt: 'Cursor',
    logoWhiteInDark: true,
    name: 'Maya K.',
    company: 'Solo dev · Cursor',
    content:
      'I live in Cursor all day—TaskMaster is the backlog that finally matches my PRD. The MCP integration means I expand and reorder tasks without breaking flow, and dependency IDs stay consistent across agent runs.',
    categories: [1, 2, 5],
  },
  {
    img: img('testimonial-02.jpg'),
    clientImg: devLogo('hashicorp'),
    clientLogoAlt: 'HashiCorp',
    logoWhiteInDark: true,
    name: 'Marcus T.',
    company: 'Platform · HashiCorp',
    content:
      'Our platform team treats specs like contracts. TaskMaster turns them into stable task IDs before anything hits Terraform or CI, and complexity scoring kept a gnarly state migration from turning into chat chaos.',
    categories: [1, 3, 4],
  },
  {
    img: img('testimonial-03.jpg'),
    clientImg: devLogo('vercel'),
    clientLogoAlt: 'Vercel',
    logoWhiteInDark: true,
    name: 'Olivia S.',
    company: 'Engineering · Vercel',
    content:
      'We ship fast on Vercel; TaskMaster keeps the plan tied to the repo. Hosted keys on Pro mean every engineer gets the same models without another .env ritual, and usage in the dashboard is honest when we are close to limits.',
    categories: [1, 3, 5],
  },
  {
    img: img('testimonial-04.jpg'),
    clientImg: devLogo('gitlab'),
    clientLogoAlt: 'GitLab',
    name: 'Rachel N.',
    company: 'Consulting · GitLab',
    content:
      'Clients hand me messy PRDs; TaskMaster turns them into tasks and subtasks with dependencies so my agent does not wander. Merge requests in GitLab reference the same IDs the CLI uses—reviewers never argue about what “done” means.',
    categories: [1, 4],
  },
  {
    img: img('testimonial-05.jpg'),
    clientImg: devLogo('github'),
    clientLogoAlt: 'GitHub',
    logoWhiteInDark: true,
    name: 'Nina K.',
    company: 'OSS · GitHub',
    content:
      'Contributors work in forks and PRs on GitHub; TaskMaster keeps the task graph in the repo so triage is not a spreadsheet. Docs and CLI are straightforward, and issue links line up with the task IDs I use locally.',
    categories: [1, 2, 4],
  },
  {
    img: '/testimonial-sam.jpg',
    clientImg: devLogo('supabase'),
    clientLogoAlt: 'Supabase',
    name: 'Sam T.',
    company: 'Full-stack · Supabase',
    content:
      'Backend on Supabase, agents in the IDE—TaskMaster is where planning lives. Research mode plus model routing means a heavier model for design and a fast one for edits, without losing the thread between API work and UI tasks.',
    categories: [1, 2],
  },
  {
    img: img('testimonial-07.jpg'),
    clientImg: devLogo('linear'),
    clientLogoAlt: 'Linear',
    name: 'James R.',
    company: 'Product · Linear',
    content:
      'We still plan initiatives in Linear, but engineering’s executable truth is TaskMaster’s graph—no more “what’s next?” in standup. The same ordered list shows up in the terminal and in review, so product and eng share one language.',
    categories: [1, 3],
  },
  {
    img: img('testimonial-08.jpg'),
    clientImg: devLogo('netlify'),
    clientLogoAlt: 'Netlify',
    name: 'Devon P.',
    company: 'Agency · Netlify',
    content:
      'We standardize client sites on Netlify; TaskMaster standardizes how we go from PRD to agent-ready tasks. New engagements start with structured work instead of a Notion graveyard—billing and license live in one place for the team.',
    categories: [1, 4, 5],
  },
  {
    img: img('testimonial-09.jpg'),
    clientImg: devLogo('okta'),
    clientLogoAlt: 'Okta',
    name: 'Morgan F.',
    company: 'IT Security · Okta',
    content:
      'Identity is Okta; execution still needs sane API usage. TaskMaster’s vault and audit-friendly usage views meant we could approve a pilot without inventing another key spreadsheet—security gets visibility, devs keep shipping.',
    categories: [1, 3, 5],
  },
]

function TestimonialCard({
  testimonial,
  category,
  children,
}: {
  testimonial: (typeof testimonialsData)[0]
  category: number
  children: ReactNode
}) {
  return (
    <article
      className={`landing-testimonial-card relative rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-sm transition-opacity dark:!border-transparent dark:!bg-transparent dark:bg-gradient-to-br dark:from-surface-1/50 dark:via-surface-4/25 dark:to-surface-1/50 dark:shadow-none dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:rounded-[inherit] dark:before:border dark:before:border-transparent dark:before:[background:linear-gradient(to_right,var(--color-gray-800),var(--color-gray-700),var(--color-gray-800))_border-box] dark:before:[mask-composite:exclude_!important] dark:before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)] ${
        !testimonial.categories.includes(category) ? 'opacity-30' : ''
      }`}
    >
      <div className="flex flex-col gap-4">
        <div>
          <img
            src={testimonial.clientImg}
            height={36}
            width={120}
            alt={testimonial.clientLogoAlt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={`h-9 w-auto max-w-[7.5rem] object-contain object-left opacity-90 contrast-[1.05] dark:opacity-100 dark:contrast-100${
              testimonial.logoWhiteInDark ? ' dark:brightness-0 dark:invert' : ''
            }`}
          />
        </div>
        <p className="text-slate-600 before:content-['\201C'] after:content-['\201D'] dark:text-marketing-muted">{children}</p>
        <div className="flex items-center gap-3">
          <img
            className="inline-flex shrink-0 rounded-full ring-2 ring-white shadow-sm dark:ring-white/10 dark:shadow-none"
            src={testimonial.img}
            width={36}
            height={36}
            alt={testimonial.name}
          />
          <div className="text-open-sm font-medium text-slate-900 dark:text-marketing-text">
            <span>{testimonial.name}</span>
            <span className="text-slate-400 dark:text-marketing-muted/70"> - </span>
            <a
              className="text-indigo-600 transition-colors hover:text-indigo-500 dark:text-accent-primary dark:hover:text-accent-primary-hover"
              href="#0"
            >
              {testimonial.company}
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

function Testimonials() {
  const [category, setCategory] = useState(1)
  const masonryContainer = useMasonry(category)

  const testimonialTabClass = (n: number) =>
    `testimonial-tab flex h-8 flex-1 items-center gap-2.5 whitespace-nowrap rounded-full px-3 text-open-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:focus-visible:ring-indigo-400/40 ${
      category === n
        ? 'testimonial-tab--active relative bg-gradient-to-b from-indigo-50 via-white to-slate-50 text-slate-900 shadow-sm ring-1 ring-inset ring-indigo-200/90 dark:from-surface-6 dark:via-surface-3 dark:to-surface-4 dark:text-marketing-text dark:ring-white/12'
        : 'testimonial-tab--inactive text-slate-700 opacity-[0.85] transition-opacity hover:opacity-100 dark:text-marketing-muted'
    }`

  return (
    <section className="relative z-[1]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="open-sample-section-divider py-12 md:py-20">
        <div className="mx-auto max-w-3xl pb-12 text-center">
          <h2 className={`${landingTitleClass} pb-4 text-open-3xl md:text-open-4xl`}>Ship faster with agents that stay aligned</h2>
          <p className="text-open-lg text-slate-600 dark:text-marketing-muted">
            Builders and teams use TaskMaster AI to turn specs into executable work—without losing the thread between your
            PRD, terminal, and editor.
          </p>
        </div>

        <div>
          <div className="flex justify-center pb-12 max-md:hidden md:pb-16">
            <div className="testimonial-tabs-track relative inline-flex flex-wrap justify-center rounded-[1.25rem] bg-slate-200/90 p-1">
              <button
                type="button"
                className={testimonialTabClass(1)}
                aria-pressed={category === 1}
                onClick={() => setCategory(1)}
              >
                <svg
                  className={`fill-current ${category === 1 ? 'text-indigo-500' : 'text-slate-500 dark:text-marketing-muted/70'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height={16}
                >
                  <path d="M.062 10.003a1 1 0 0 1 1.947.455c-.019.08.01.152.078.19l5.83 3.333c.052.03.115.03.168 0l5.83-3.333a.163.163 0 0 0 .078-.188 1 1 0 0 1 1.947-.459 2.161 2.161 0 0 1-1.032 2.384l-5.83 3.331a2.168 2.168 0 0 1-2.154 0l-5.83-3.331a2.162 2.162 0 0 1-1.032-2.382Zm7.854-7.981-5.83 3.332a.17.17 0 0 0 0 .295l5.828 3.33c.054.031.118.031.17.002l5.83-3.333a.17.17 0 0 0 0-.294L8.085 2.023a.172.172 0 0 0-.17-.001ZM9.076.285l5.83 3.332c1.458.833 1.458 2.935 0 3.768l-5.83 3.333c-.667.38-1.485.38-2.153-.001l-5.83-3.332c-1.457-.833-1.457-2.935 0-3.767L6.925.285a2.173 2.173 0 0 1 2.15 0Z" />
                </svg>
                <span>All</span>
              </button>
              <button
                type="button"
                className={testimonialTabClass(2)}
                aria-pressed={category === 2}
                onClick={() => setCategory(2)}
              >
                <svg
                  className={`fill-current ${category === 2 ? 'text-indigo-500' : 'text-slate-500 dark:text-marketing-muted/70'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height={16}
                >
                  <path d="M6.5 3.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM9 6.855A3.502 3.502 0 0 0 8 0a3.5 3.5 0 0 0-1 6.855v1.656L5.534 9.65a3.5 3.5 0 1 0 1.229 1.578L8 10.267l1.238.962a3.5 3.5 0 1 0 1.229-1.578L9 8.511V6.855Zm2.303 4.74c.005-.005.01-.01.013-.016l.012-.016a1.5 1.5 0 1 1-.025.032ZM3.5 11A1.497 1.497 0 0 1 5 12.5 1.5 1.5 0 1 1 3.5 11Z" />
                </svg>
                <span>Developers</span>
              </button>
              <button
                type="button"
                className={testimonialTabClass(3)}
                aria-pressed={category === 3}
                onClick={() => setCategory(3)}
              >
                <svg
                  className={`fill-current ${category === 3 ? 'text-indigo-500' : 'text-slate-500 dark:text-marketing-muted/70'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height={16}
                >
                  <path d="M2.428 10c.665-1.815 1.98-3.604 3.44-4.802-.6-1.807-1.443-3.079-2.29-3.18-1.91-.227-2.246 2.04-.174 2.962a1 1 0 1 1-.813 1.827C-1.407 5.028-.589-.491 3.815.032c1.605.191 2.925 1.811 3.79 4.07.979-.427 1.937-.51 2.735-.092.818.429 1.143 1.123 1.294 2.148.015.1.022.149.043.32.542-.537 1.003-.797 1.693-.622.64.162.894.493 1.195 1.147l.018.04a1 1 0 0 1 1.133 1.61c-.46.47-1.12.574-1.744.398a1.661 1.661 0 0 1-.87-.592 2.127 2.127 0 0 1-.224-.349 3.225 3.225 0 0 1-.55.477c-.377.253-.8.368-1.259.267-.993-.218-1.21-.779-1.367-2.05-.027-.22-.033-.262-.046-.353-.067-.452-.144-.617-.244-.67-.225-.118-.665-.013-1.206.278.297 1.243.475 2.587.516 3.941H15a1 1 0 0 1 0 2H8.68l-.025.285c-.173 1.918-.906 3.381-2.654 3.668-1.5.246-3.013-.47-3.677-1.858-.29-.637-.39-1.35-.342-2.095H1a1 1 0 0 1 0-2h1.428Zm2.11 0h2.175a18.602 18.602 0 0 0-.284-2.577c-.205.202-.408.42-.606.654A9.596 9.596 0 0 0 4.537 10Zm2.135 2H3.942c-.032.465.03.888.194 1.25.258.538.89.836 1.54.73.546-.09.888-.772.988-1.875L6.673 12Z" />
                </svg>
                <span>Teams</span>
              </button>
              <button
                type="button"
                className={testimonialTabClass(4)}
                aria-pressed={category === 4}
                onClick={() => setCategory(4)}
              >
                <svg
                  className={`fill-current ${category === 4 ? 'text-indigo-500' : 'text-slate-500 dark:text-marketing-muted/70'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height={16}
                >
                  <path d="M3.757 3.758a6 6 0 0 1 8.485 8.485 5.992 5.992 0 0 1-5.301 1.664 1 1 0 1 0-.351 1.969 8 8 0 1 0-4.247-2.218 1 1 0 0 0 1.415-.001L9.12 8.294v1.827a1 1 0 1 0 2 0v-4.2a.997.997 0 0 0-1-1.042H5.879a1 1 0 1 0 0 2h1.829l-4.599 4.598a6 6 0 0 1 .648-7.719Z" />
                </svg>
                <span>Agencies</span>
              </button>
              <button
                type="button"
                className={testimonialTabClass(5)}
                aria-pressed={category === 5}
                onClick={() => setCategory(5)}
              >
                <svg
                  className={`fill-current ${category === 5 ? 'text-indigo-500' : 'text-slate-500 dark:text-marketing-muted/70'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height={16}
                >
                  <path d="M13.95.879a3 3 0 0 0-4.243 0L1.293 9.293a1 1 0 0 0-.274.51l-1 5a1 1 0 0 0 1.177 1.177l5-1a1 1 0 0 0 .511-.273l1.16-1.16a1 1 0 0 0-1.414-1.414l-.946.946-3.232.646.646-3.232 8.2-8.2a1 1 0 0 1 1.414 0l1.172 1.172a1 1 0 0 1 0 1.414l-.55.549a1 1 0 0 0 1.415 1.414l.55-.55a3 3 0 0 0 0-4.241L13.948.879ZM3.25 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm11.474 6.029-1.521-.752-.752-1.521c-.168-.341-.73-.341-.896 0l-.752 1.52-1.521.753a.498.498 0 0 0 0 .896l1.52.752.753 1.52a.5.5 0 0 0 .896 0l.752-1.52 1.52-.752a.498.498 0 0 0 0-.896Z" />
                </svg>
                <span>Enterprise</span>
              </button>
            </div>
          </div>

          <div
            className="mx-auto grid max-w-sm items-start gap-6 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3"
            ref={masonryContainer as Ref<HTMLDivElement>}
          >
            {testimonialsData.map((testimonial, index) => (
              <div key={index} className="group">
                <TestimonialCard testimonial={testimonial} category={category}>
                  {testimonial.content}
                </TestimonialCard>
              </div>
            ))}
          </div>
        </div>
      </div>
        </div>
      </section>
  )
}

function Cta() {
  return (
    <section className="relative z-[1] overflow-hidden">
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -z-10 -mb-24 ml-20 -translate-x-1/2 opacity-35 dark:opacity-100"
        aria-hidden="true"
      >
        <img
          className="landing-deco-img max-w-none opacity-90 dark:opacity-100"
          src={img('blurred-shape.svg')}
          width={760}
          height={668}
          alt=""
        />
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="landing-cta-band bg-gradient-to-r from-transparent via-slate-200/80 to-transparent py-12 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className={`${landingTitleClass} pb-8 text-open-3xl md:text-open-4xl`}>Your agents are ready. Are you?</h2>
            <div className="mx-auto max-w-xs sm:flex sm:max-w-none sm:justify-center">
              <div>
                <Link
                  className="landing-primary-cta btn group mb-4 w-full bg-gradient-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-bottom text-white shadow-[inset_0px_1px_0px_0px_color-mix(in_srgb,var(--color-white)_16%,transparent)] hover:bg-[length:100%_150%] sm:mb-0 sm:w-auto"
                  to="/signup?plan=pro"
                >
                  <span className="relative inline-flex items-center">
                    Get started
                    <span className="ml-1 tracking-normal text-white/50 transition-transform group-hover:translate-x-0.5">
                      -&gt;
                    </span>
                  </span>
                </Link>
              </div>
              <div className="mb-4 sm:mb-0">
                <Link className={secondaryCtaClass} to="/pricing">
                  View pricing
                </Link>
              </div>
              <div>
                <Link className={secondaryCtaClass} to={defaultDocHref()}>
                  View docs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="open-sample relative min-h-screen bg-slate-50 font-inter text-open-base text-marketing-text antialiased supports-[overflow:clip]:overflow-x-clip dark:bg-marketing-bg">
      <PageIllustration />
      <HeroHome />
      <Workflows />
      <Features />
      <Testimonials />
      <Cta />
    </div>
  )
}
