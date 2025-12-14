import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { doc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faCheckCircle,
  faSpinner,
  faClock,
  faExclamationTriangle,
  faBan,
  faChevronDown,
  faChevronRight,
  faSync,
  faFolder,
  faTag,
  faTerminal,
  faListCheck,
  faCircle,
} from '@fortawesome/free-solid-svg-icons'

interface Subtask {
  id: number
  title: string
  description?: string
  status: string
  details?: string
}

interface Task {
  id: number
  title: string
  description: string
  status: string
  priority: 'high' | 'medium' | 'low'
  dependencies?: number[]
  details?: string
  testStrategy?: string
  subtasks?: Subtask[]
}

interface Project {
  id: string
  name: string
  lastSynced?: string
  stats?: {
    [tag: string]: {
      total: number
      pending: number
      inProgress: number
      done: number
      blocked: number
    }
  }
  tags?: Array<{
    name: string
    taskCount: number
    syncedAt?: string
  }>
}

interface TagData {
  tasks: Task[]
  metadata?: {
    createdAt?: string
    updatedAt?: string
  }
  syncedAt?: string
}

const statusConfig: { [key: string]: { icon: typeof faClock; color: string; bg: string; label: string } } = {
  'pending': { icon: faClock, color: 'text-text-muted', bg: 'bg-surface-highlight', label: 'Pending' },
  'in-progress': { icon: faSpinner, color: 'text-accent', bg: 'bg-accent/10', label: 'In Progress' },
  'done': { icon: faCheckCircle, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Done' },
  'blocked': { icon: faExclamationTriangle, color: 'text-status-error', bg: 'bg-status-error/10', label: 'Blocked' },
  'cancelled': { icon: faBan, color: 'text-text-muted', bg: 'bg-surface-highlight', label: 'Cancelled' },
  'deferred': { icon: faClock, color: 'text-status-warning', bg: 'bg-status-warning/10', label: 'Deferred' },
}

const priorityConfig: { [key: string]: { color: string; label: string } } = {
  'high': { color: 'text-status-error', label: '▲' },
  'medium': { color: 'text-status-warning', label: '●' },
  'low': { color: 'text-status-success', label: '▼' },
}

function TaskRow({ task, expanded, onToggle }: { task: Task; expanded: boolean; onToggle: () => void }) {
  const status = statusConfig[task.status] || statusConfig['pending']
  const priority = priorityConfig[task.priority] || priorityConfig['medium']
  const hasSubtasks = task.subtasks && task.subtasks.length > 0

  return (
    <>
      <tr
        className="border-b border-theme-primary hover:bg-surface-highlight/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {hasSubtasks && (
              <FontAwesomeIcon 
                icon={expanded ? faChevronDown : faChevronRight} 
                className="text-text-muted text-xs w-3"
              />
            )}
            {!hasSubtasks && <span className="w-3" />}
            <span className="text-text-muted font-mono text-sm">{task.id}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${status.bg} ${status.color}`}>
            <FontAwesomeIcon icon={status.icon} className={`w-3 h-3 ${task.status === 'in-progress' ? 'animate-spin' : ''}`} />
            {status.label}
          </span>
        </td>
        <td className="py-3 px-4">
          <span className={`${priority.color} text-sm`} title={task.priority}>
            {priority.label}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="max-w-md">
            <p className="font-medium text-sm truncate">{task.title}</p>
          </div>
        </td>
        <td className="py-3 px-4 text-text-muted text-sm">
          {task.dependencies && task.dependencies.length > 0 
            ? task.dependencies.map(d => (
                <span key={d} className="inline-block bg-surface-highlight px-1.5 py-0.5 rounded text-xs mr-1 font-mono">
                  {d}
                </span>
              ))
            : <span className="text-text-muted/50">—</span>
          }
        </td>
      </tr>
      
      {/* Subtasks */}
      <AnimatePresence>
        {expanded && hasSubtasks && task.subtasks!.map((subtask) => {
          const subStatus = statusConfig[subtask.status] || statusConfig['pending']
          return (
            <motion.tr
              key={`${task.id}.${subtask.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-b border-theme-primary bg-surface/50"
            >
              <td className="py-2.5 px-4 pl-12">
                <span className="text-text-muted font-mono text-xs">{task.id}.{subtask.id}</span>
              </td>
              <td className="py-2.5 px-4">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${subStatus.bg} ${subStatus.color}`}>
                  <FontAwesomeIcon icon={subStatus.icon} className={`w-2.5 h-2.5 ${subtask.status === 'in-progress' ? 'animate-spin' : ''}`} />
                  {subStatus.label}
                </span>
              </td>
              <td className="py-2.5 px-4"></td>
              <td className="py-2.5 px-4" colSpan={2}>
                <p className="text-sm text-text-muted truncate">{subtask.title}</p>
              </td>
            </motion.tr>
          )
        })}
      </AnimatePresence>
    </>
  )
}

export default function Tasks() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string>('master')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())

  // Load projects
  useEffect(() => {
    if (!user) return

    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'projects'),
      (snapshot) => {
        const projectsData: Project[] = []
        snapshot.forEach((doc) => {
          projectsData.push({
            id: doc.id,
            ...doc.data(),
          } as Project)
        })
        setProjects(projectsData)
        
        if (!selectedProject && projectsData.length > 0) {
          setSelectedProject(projectsData[0].id)
        }
        
        setLoading(false)
      },
      (error) => {
        console.error('Error loading projects:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, selectedProject])

  // Load tasks for selected project and tag
  useEffect(() => {
    if (!user || !selectedProject) return

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid, 'projects', selectedProject, 'tags', selectedTag),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as TagData
          setTasks(data.tasks || [])
          setLastSynced(data.syncedAt || null)
        } else {
          setTasks([])
          setLastSynced(null)
        }
      },
      (error) => {
        console.error('Error loading tasks:', error)
      }
    )

    return () => unsubscribe()
  }, [user, selectedProject, selectedTag])

  const toggleTask = (taskId: number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  }

  const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  if (loading) {
    return (
      <div className="p-5 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <FontAwesomeIcon icon={faSpinner} className="w-5 h-5 text-accent animate-spin" />
          <span className="ml-3 text-text-muted">Loading tasks...</span>
        </div>
      </div>
    )
  }

  // Show getting started guide when no projects exist
  if (projects.length === 0) {
    return (
      <div className="p-5 lg:p-8 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <h1 className="text-2xl font-bold mb-1">Tasks</h1>
          <p className="text-sm text-text-muted mb-8">Real-time view of your CLI tasks</p>

          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faTerminal} className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Get Started with TaskMaster CLI</h2>
            <p className="text-text-muted mb-6 max-w-md mx-auto">
              Tasks will sync here automatically when you use the CLI. Follow these steps to get started:
            </p>

            <div className="text-left bg-surface-highlight rounded-lg p-5 max-w-lg mx-auto space-y-4">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <div>
                  <p className="font-medium">Install the CLI</p>
                  <code className="text-sm text-text-muted block mt-1">npm install -g taskmaster-ai-cli</code>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <div>
                  <p className="font-medium">Activate your license</p>
                  <code className="text-sm text-text-muted block mt-1">taskmaster activate &lt;your-license-key&gt;</code>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <div>
                  <p className="font-medium">Initialize in your project</p>
                  <code className="text-sm text-text-muted block mt-1">cd your-project && taskmaster init</code>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                <div>
                  <p className="font-medium">Parse your PRD to create tasks</p>
                  <code className="text-sm text-text-muted block mt-1">taskmaster parse-prd your-prd.md</code>
                </div>
              </div>
            </div>

            <p className="text-xs text-text-subtle mt-6">
              Your license key can be found in your{' '}
              <a href="/app/billing" className="text-accent hover:underline">Billing settings</a>
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Tasks</h1>
            <p className="text-sm text-text-muted">
              Real-time view of your CLI tasks
            </p>
          </div>
          
          {lastSynced && (
            <div className="flex items-center gap-2 text-xs text-text-muted bg-surface-highlight px-3 py-1.5 rounded-lg">
              <FontAwesomeIcon icon={faSync} className="w-3 h-3" />
              Synced {new Date(lastSynced).toLocaleString()}
            </div>
          )}
        </div>
      </motion.div>

      {/* Project & Tag Selector */}
      {projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          className="mb-6 flex flex-wrap gap-3"
        >
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faFolder} className="w-4 h-4 text-text-muted" />
            <select
              value={selectedProject || ''}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-surface border border-theme-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || project.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faTag} className="w-4 h-4 text-text-muted" />
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-surface border border-theme-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            >
              <option value="master">master</option>
              {projects.find(p => p.id === selectedProject)?.tags?.map((tag) => (
                tag.name !== 'master' && (
                  <option key={tag.name} value={tag.name}>
                    {tag.name} ({tag.taskCount})
                  </option>
                )
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        className="mb-6"
      >
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-text-muted">Total</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-text-muted">{stats.pending}</p>
                  <p className="text-xs text-text-muted">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-accent">{stats.inProgress}</p>
                  <p className="text-xs text-text-muted">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-status-success">{stats.done}</p>
                  <p className="text-xs text-text-muted">Done</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{progress}%</p>
              <p className="text-xs text-text-muted">Complete</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-2 bg-surface-highlight rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Tasks Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
      >
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faListCheck} className="w-4 h-4 text-accent" />
          Task List
        </h2>

        {tasks.length === 0 ? (
          <div className="card p-8 text-center">
            <FontAwesomeIcon icon={faTerminal} className="w-8 h-8 text-text-muted mb-3" />
            <h3 className="text-base font-semibold mb-2">No tasks synced yet</h3>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-4">
              Tasks will appear here automatically when you use the CLI.
            </p>
            <code className="inline-block bg-surface-highlight px-3 py-1.5 rounded text-sm font-mono text-text-muted">
              taskmaster plan your-prd.md
            </code>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-highlight/50">
                  <tr className="border-b border-theme-primary">
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider w-20">ID</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider w-28">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider w-12">Pri</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Title</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider w-24">Deps</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      expanded={expandedTasks.has(task.id)}
                      onToggle={() => toggleTask(task.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
