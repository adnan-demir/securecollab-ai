/**
 * Projects page – create and list research projects.
 * Access control is enforced server-side:
 *   - Students: own projects only
 *   - Researchers: own + shared
 *   - Admins: all projects
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

function ProjectCard({ project }) {
  return (
    <div data-testid="project-card"
      className="card border border-gray-100 hover:border-blue-200 hover:shadow-md
                 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{project.title}</h3>
          {project.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex-shrink-0">
          {project.is_shared
            ? <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Shared</span>
            : <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">Private</span>
          }
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ title: '', description: '', is_shared: false })
  const [creating, setCreating] = useState(false)

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/api/projects')
      setProjects(data)
    } catch {
      setError('Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/api/projects', form)
      setForm({ title: '', description: '', is_shared: false })
      setShowForm(false)
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create project.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 data-testid="projects-title" className="text-3xl font-bold text-gray-900">
            Research Projects
          </h1>
          <p className="text-gray-500 mt-1">
            {user?.role === 'student'
              ? 'Your personal research projects'
              : user?.role === 'researcher'
              ? 'Your projects and shared research'
              : 'All platform projects (admin view)'}
          </p>
        </div>
        <button
          data-testid="create-project-btn"
          onClick={() => setShowForm((p) => !p)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6 border border-blue-200 bg-blue-50">
          <h2 className="font-bold text-gray-800 mb-4">Create New Project</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                data-testid="project-title-input"
                type="text"
                value={form.title}
                onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                className="input-field"
                placeholder="Research project title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                data-testid="project-desc-input"
                value={form.description}
                onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                className="input-field resize-none"
                placeholder="Brief description of your research…"
                rows={3}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                data-testid="project-shared-checkbox"
                checked={form.is_shared}
                onChange={(e) => setForm(p => ({ ...p, is_shared: e.target.checked }))}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Share with researchers
              </span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                data-testid="create-project-submit"
                type="submit"
                disabled={creating}
                className="btn-primary"
              >
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Project list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📂</div>
          <h3 className="text-lg font-semibold text-gray-700">No projects yet</h3>
          <p className="text-gray-400 mt-1 text-sm">Create your first project to get started.</p>
        </div>
      ) : (
        <div data-testid="project-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}
