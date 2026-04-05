import { Link } from 'react-router-dom'
import { defaultDocHref } from '../lib/docRoutes'
import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHome, faBook, faTag } from '@fortawesome/free-solid-svg-icons'

export default function NotFound() {
  return (
    <div className="marketing-page relative mx-auto max-w-lg px-4 py-16 text-center sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mb-4 flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-indigo-400/50" />
          <span className="bg-gradient-to-r from-indigo-500 to-violet-400 bg-clip-text text-sm font-medium text-transparent">
            Error
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-400/50" />
        </div>
        <div className="marketing-gradient-text font-display select-none text-[6rem] font-bold leading-none tracking-tighter md:text-[8rem]">
          404
        </div>

        <h1 className="font-display mt-6 text-xl font-semibold text-marketing-text md:text-2xl">
          Page not found
        </h1>
        <p className="mb-8 mt-3 text-marketing-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
        </p>

        <Link
          to="/"
          className="btn-marketing-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base"
        >
          <FontAwesomeIcon icon={faHome} className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mt-10 flex items-center justify-center gap-6 text-sm">
          <Link
            to={defaultDocHref()}
            className="inline-flex items-center gap-2 text-marketing-muted transition hover:text-marketing-link"
          >
            <FontAwesomeIcon icon={faBook} className="h-4 w-4" />
            Documentation
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-marketing-muted transition hover:text-marketing-link"
          >
            <FontAwesomeIcon icon={faTag} className="h-4 w-4" />
            Pricing
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
