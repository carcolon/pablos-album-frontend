import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import HTMLFlipBook from 'react-pageflip'
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { create } from 'zustand'
import gsap from 'gsap'
import {
  BookOpen,
  CalendarDays,
  Eye,
  ImagePlus,
  KeyRound,
  LayoutTemplate,
  Lock,
  LogOut,
  MailPlus,
  Palette,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserPlus,
} from 'lucide-react'
import './styles.css'

type Photo = {
  id: string
  url: string
  alt: string
  caption: string
  storageProvider: string
  storageKey: string
  sortOrder: number
}

type AlbumPage = {
  id: string
  pageNumber: number
  layout: string
  title: string
  dateLabel: string
  text: string
  photos: Photo[]
}

type Memory = {
  id: string
  title: string
  description: string
  date: string
  type: string
  linkedPageId?: string
}

type Album = {
  id: string
  title: string
  subtitle: string
  description: string
  theme: string
  coverPhotoUrl: string
  pages: AlbumPage[]
  memories: Memory[]
}

type AppMode = 'viewer' | 'admin'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
let csrfToken: string | null = null
const layoutOptions = ['FullPhoto', 'PhotoWithCaption', 'TwoPhotos', 'Letter', 'Milestone', 'Timeline']

const fallbackAlbum: Album = {
  id: '018f4b44-6f15-7a45-a810-a1168d98c041',
  title: "Pablo's Album",
  subtitle: 'A private family book for the moments that become home.',
  description: "A family album ready for Pablo's real photos, notes and milestones.",
  theme: 'classic-warm',
  coverPhotoUrl: '',
  pages: [
    {
      id: 'p1',
      pageNumber: 1,
      layout: 'FullPhoto',
      title: 'Page One',
      dateLabel: 'Family archive',
      text: "Choose a layout in Studio and add Pablo's real memories here.",
      photos: [],
    },
    {
      id: 'p2',
      pageNumber: 2,
      layout: 'PhotoWithCaption',
      title: 'Page Two',
      dateLabel: 'Family archive',
      text: 'This page is ready for a photo, caption and date.',
      photos: [],
    },
    {
      id: 'p3',
      pageNumber: 3,
      layout: 'TwoPhotos',
      title: 'Page Three',
      dateLabel: 'Family archive',
      text: 'Use a two-photo spread for before/after moments, details or comparisons.',
      photos: [],
    },
    {
      id: 'p4',
      pageNumber: 4,
      layout: 'Letter',
      title: 'Letter Page',
      dateLabel: 'Read this when you are older',
      text: 'Write a family note here when the album content is ready.',
      photos: [],
    },
  ],
  memories: [
    {
      id: 'm1',
      title: 'Album created',
      description: 'The album structure is ready for real family content.',
      date: '2026-09-18',
      type: 'Milestone',
      linkedPageId: 'p1',
    },
  ],
}

const inviteSchema = z.object({
  email: z.string().email('Use a valid email.'),
  role: z.enum(['Viewer', 'Editor']),
})

type InviteForm = z.infer<typeof inviteSchema>

const loginSchema = z.object({
  email: z.string().email('Use a valid email.'),
  password: z.string().min(10, 'Use at least 10 characters.'),
  displayName: z.string().optional(),
})

const registerOwnerSchema = loginSchema.extend({
  displayName: z.string().min(2, 'Use your name.'),
})

type AuthForm = {
  email: string
  password: string
  displayName?: string
}

type AuthUser = {
  email: string
  displayName: string
  roles: string[]
}

type AuthStatus = {
  hasOwner: boolean
  isAuthenticated: boolean
  user: AuthUser | null
}

const queryClient = new QueryClient()

const useAlbumStore = create<{
  mode: AppMode
  pageIndex: number
  soundEnabled: boolean
  setMode: (mode: AppMode) => void
  setPageIndex: (pageIndex: number) => void
  toggleSound: () => void
}>((set) => ({
  mode: 'viewer',
  pageIndex: 0,
  soundEnabled: false,
  setMode: (mode) => set({ mode }),
  setPageIndex: (pageIndex) => set({ pageIndex }),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}))

async function fetchAlbum(): Promise<Album> {
  const response = await apiFetch('/api/albums')
  if (!response.ok) {
    throw new Error('API unavailable')
  }

  const albums = (await response.json()) as Album[]
  return albums[0] ?? fallbackAlbum
}

type UploadPhotoResponse = {
  originalFileName: string
  storedFileName: string
  originalSizeBytes: number
  storedSizeBytes: number
  wasCompressed: boolean
  storageProvider: string
  storageKey: string
}

async function uploadPhoto(albumId: string, file: File): Promise<UploadPhotoResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiFetch(`/api/albums/${albumId}/photos`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Upload failed')
  }

  return (await response.json()) as UploadPhotoResponse
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken
  }

  const response = await fetch(`${apiBaseUrl}/api/security/csrf`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Security token unavailable')
  }

  const payload = (await response.json()) as { token: string }
  csrfToken = payload.token
  return csrfToken
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const method = init.method?.toUpperCase() ?? 'GET'
  const headers = new Headers(init.headers)

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-TOKEN', await getCsrfToken())
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
}

async function fetchAuthStatus(): Promise<AuthStatus> {
  const response = await apiFetch('/api/auth/status')
  if (!response.ok) {
    throw new Error('Authentication unavailable')
  }

  return (await response.json()) as AuthStatus
}

async function login(data: AuthForm): Promise<AuthUser> {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.email, password: data.password, displayName: data.displayName }),
  })

  if (!response.ok) {
    throw new Error('Email or password is incorrect.')
  }

  csrfToken = null
  return (await response.json()) as AuthUser
}

async function logout(): Promise<void> {
  const response = await apiFetch('/api/auth/logout', { method: 'POST' })
  csrfToken = null
  if (!response.ok && response.status !== 401) {
    throw new Error('Logout failed.')
  }
}

function useAlbum() {
  return useQuery({
    queryKey: ['album'],
    queryFn: fetchAlbum,
    retry: false,
    placeholderData: fallbackAlbum,
  })
}

function App() {
  const auth = useQuery({ queryKey: ['auth'], queryFn: fetchAuthStatus, retry: false })
  const { data: album = fallbackAlbum, isError } = useAlbum()
  const { mode, setMode } = useAlbumStore()
  const isAuthenticated = auth.data?.isAuthenticated == true
  const canUseStudio = isAuthenticated && (auth.data?.user?.roles.includes('Owner') || auth.data?.user?.roles.includes('Editor'))

  return (
    <main className="app-shell">
      <TopBar mode={mode} setMode={setMode} apiOffline={isError} user={auth.data?.user ?? null} />
      {mode === 'viewer' ? <AlbumViewer album={album} /> : canUseStudio ? <AdminStudio album={album} /> : <AuthScreen hasOwner={auth.data?.hasOwner ?? true} />}
    </main>
  )
}

function AuthScreen({ hasOwner }: { hasOwner: boolean }) {
  const isRegister = !hasOwner
  const { register, handleSubmit, formState } = useForm<AuthForm>({
    resolver: zodResolver(isRegister ? registerOwnerSchema : loginSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  })
  const mutation = useMutation({
    mutationFn: isRegister ? login : login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      await queryClient.invalidateQueries({ queryKey: ['album'] })
    },
  })

  return (
    <section className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <BookOpen size={24} aria-hidden="true" />
          <span>Pablo's Album</span>
        </div>
        <p className="eyebrow">{isRegister ? 'First admin login' : 'Studio access'}</p>
        <h1>{isRegister ? 'Create admin access' : 'Log in to Studio'}</h1>
        <form className="auth-form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          {isRegister && (
            <label>
              Name
              <input autoComplete="name" placeholder="Your name" {...register('displayName')} />
              {formState.errors.displayName && <small>{formState.errors.displayName.message}</small>}
            </label>
          )}
          <label>
            Email
            <input autoComplete="email" placeholder="family@email.com" type="email" {...register('email')} />
            {formState.errors.email && <small>{formState.errors.email.message}</small>}
          </label>
          <label>
            Password
            <input autoComplete={isRegister ? 'new-password' : 'current-password'} type="password" {...register('password')} />
            {formState.errors.password && <small>{formState.errors.password.message}</small>}
          </label>
          {mutation.error && <small>{mutation.error.message}</small>}
          <button disabled={mutation.isPending} type="submit">
            {isRegister ? <UserPlus size={17} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}
            {mutation.isPending ? 'Working' : isRegister ? 'Create admin' : 'Log in'}
          </button>
        </form>
      </section>
    </section>
  )
}

function TopBar({
  mode,
  setMode,
  apiOffline,
  user,
}: {
  mode: AppMode
  setMode: (mode: AppMode) => void
  apiOffline: boolean
  user: AuthUser | null
}) {
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      useAlbumStore.getState().setMode('viewer')
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.removeQueries({ queryKey: ['album'] })
    },
  })

  return (
    <header className="topbar">
      <div className="brand-mark">
        <BookOpen size={20} aria-hidden="true" />
        <span>Pablo's Album</span>
      </div>
      <nav className="mode-switch" aria-label="Application mode">
        <button className={mode === 'viewer' ? 'active' : ''} onClick={() => setMode('viewer')} type="button">
          <Eye size={18} aria-hidden="true" />
          Viewer
        </button>
        <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')} type="button">
          <LayoutTemplate size={18} aria-hidden="true" />
          Studio
        </button>
      </nav>
      <div className="privacy-pill" title="Studio changes require admin access.">
        <Lock size={16} aria-hidden="true" />
        {apiOffline ? 'Demo data' : user?.displayName || 'Public album'}
      </div>
      {user && (
        <button className="logout-button" onClick={() => logoutMutation.mutate()} type="button">
          <LogOut size={17} aria-hidden="true" />
          Logout
        </button>
      )}
    </header>
  )
}

function AlbumViewer({ album }: { album: Album }) {
  const heroRef = useRef<HTMLDivElement | null>(null)
  const { pageIndex, setPageIndex, soundEnabled, toggleSound } = useAlbumStore()

  const pages = useMemo(() => [coverPage(album), ...album.pages], [album])

  function animateIn() {
    if (!heroRef.current) {
      return
    }

    const timeline = gsap.timeline()
    timeline.fromTo(
      heroRef.current,
      { rotateY: -3, scale: 0.985 },
      { rotateY: 0, scale: 1, duration: 0.55, ease: 'power2.out' },
    )
    timeline.fromTo(
      heroRef.current.querySelectorAll('.page-copy, .photo-frame, .letter-body, .empty-photo-slot, .cover-mark'),
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.05, duration: 0.45, ease: 'power3.out' },
      0.08,
    )
    timeline.fromTo(
      heroRef.current.querySelector('.page-turn-sheen'),
      { xPercent: -120, opacity: 0 },
      { xPercent: 120, opacity: 0.28, duration: 0.62, ease: 'power2.out' },
      0,
    )
  }

  return (
    <section className="viewer">
      <div className="viewer-header">
        <p className="eyebrow">Family album</p>
        <h1>{album.title}</h1>
        <div className="viewer-actions">
          <button onClick={() => setPageIndex(Math.max(0, pageIndex - 1))} type="button">
            Previous
          </button>
          <button onClick={() => setPageIndex(Math.min(pages.length - 1, pageIndex + 1))} type="button">
            Next
          </button>
          <button className={soundEnabled ? 'active' : ''} onClick={toggleSound} type="button">
            <Sparkles size={17} aria-hidden="true" />
            Sound {soundEnabled ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div className="book-stage" ref={heroRef}>
        <div className="page-turn-sheen" aria-hidden="true" />
        <HTMLFlipBook
          width={430}
          height={590}
          size="stretch"
          minWidth={310}
          maxWidth={430}
          minHeight={460}
          maxHeight={590}
          drawShadow
          flippingTime={850}
          mobileScrollSupport
          showCover
          usePortrait
          startPage={pageIndex}
          onFlip={(event) => {
            setPageIndex(event.data)
            animateIn()
          }}
          className="flip-book"
          style={{}}
          startZIndex={0}
          autoSize
          maxShadowOpacity={0.24}
          clickEventForward
          useMouseEvents
          swipeDistance={20}
          showPageCorners
          disableFlipByClick={false}
        >
          {pages.map((page) => (
            <SpreadPage key={page.id} page={page} />
          ))}
        </HTMLFlipBook>
      </div>
    </section>
  )
}

function coverPage(album: Album): AlbumPage {
  return {
    id: 'cover',
    pageNumber: 0,
    layout: 'Cover',
    title: album.title,
    dateLabel: 'Family archive',
    text: album.description,
    photos: [],
  }
}

function SpreadPage({ page }: { page: AlbumPage }) {
  const firstPhoto = page.photos[0]

  if (page.layout === 'Cover') {
    return (
      <article className="book-page cover-page">
        <div className="cover-paper">
          <div className="cover-mark" aria-hidden="true">
            PA
          </div>
          <p>{page.dateLabel}</p>
          <h2>{page.title}</h2>
          <span>{page.text}</span>
        </div>
      </article>
    )
  }

  if (page.layout === 'Letter') {
    return (
      <article className="book-page letter-page">
        <div className="page-copy">
          <p className="eyebrow">{page.dateLabel}</p>
          <h2>{page.title}</h2>
        </div>
        <p className="letter-body">{page.text}</p>
      </article>
    )
  }

  if (page.layout === 'TwoPhotos') {
    return (
      <article className="book-page collage-page">
        <div className="page-copy">
          <p className="eyebrow">{page.dateLabel}</p>
          <h2>{page.title}</h2>
        </div>
        <div className="photo-grid">
          {page.photos.length > 0
            ? page.photos.map((photo) => (
                <figure className="photo-frame" key={photo.id}>
                  <img src={photo.url} alt={photo.alt} />
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))
            : [0, 1].map((slot) => <EmptyPhotoSlot key={slot} label={`Photo ${slot + 1}`} />)}
        </div>
        <p>{page.text}</p>
      </article>
    )
  }

  return (
    <article className="book-page photo-page">
      {firstPhoto ? (
        <figure className="photo-frame hero-photo">
          <img src={firstPhoto.url} alt={firstPhoto.alt} />
          <figcaption>{firstPhoto.caption}</figcaption>
        </figure>
      ) : (
        <EmptyPhotoSlot label="Photo" />
      )}
      <div className="page-copy">
        <p className="eyebrow">{page.dateLabel}</p>
        <h2>{page.title}</h2>
        <p>{page.text}</p>
      </div>
    </article>
  )
}

function EmptyPhotoSlot({ label }: { label: string }) {
  return (
    <div className="empty-photo-slot">
      <ImagePlus size={28} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

function AdminStudio({ album }: { album: Album }) {
  const { register, handleSubmit, formState, reset } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'Viewer' },
  })
  const [invites, setInvites] = useState<InviteForm[]>([])
  const [uploadStatus, setUploadStatus] = useState<string>('Ready to upload to Google Drive.')
  const [isUploading, setIsUploading] = useState(false)
  const [workingPages, setWorkingPages] = useState<AlbumPage[]>(album.pages)
  const [selectedPageId, setSelectedPageId] = useState<string>(album.pages[0]?.id ?? '')

  useEffect(() => {
    setWorkingPages(album.pages)
    setSelectedPageId(album.pages[0]?.id ?? '')
  }, [album])

  const selectedPage = workingPages.find((page) => page.id === selectedPageId) ?? workingPages[0]

  function assignLayout(layout: string) {
    if (!selectedPage) {
      return
    }

    setWorkingPages((pages) => pages.map((page) => (page.id === selectedPage.id ? { ...page, layout } : page)))
  }

  function submitInvite(data: InviteForm) {
    setInvites((current) => [data, ...current])
    reset({ email: '', role: 'Viewer' })
  }

  async function submitPhotoUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      setUploadStatus('Choose an image first.')
      return
    }

    setIsUploading(true)
    setUploadStatus(`Uploading ${file.name}...`)
    try {
      const result = await uploadPhoto(album.id, file)
      const beforeMb = (result.originalSizeBytes / 1024 / 1024).toFixed(2)
      const afterMb = (result.storedSizeBytes / 1024 / 1024).toFixed(2)
      setUploadStatus(
        `${result.storedFileName} saved in ${result.storageProvider}. ${beforeMb} MB -> ${afterMb} MB${
          result.wasCompressed ? ' after compression.' : '.'
        }`,
      )
      form.reset()
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="studio">
      <aside className="studio-sidebar">
        <h2>Layouts</h2>
        {layoutOptions.map((layout) => (
          <button className={selectedPage?.layout === layout ? 'active' : ''} key={layout} onClick={() => assignLayout(layout)} type="button">
            <LayoutTemplate size={17} aria-hidden="true" />
            {layout}
          </button>
        ))}
        {selectedPage && (
          <div className="selected-page-note">
            <strong>Editing page {String(selectedPage.pageNumber).padStart(2, '0')}</strong>
            <span>{selectedPage.title}</span>
          </div>
        )}
      </aside>

      <div className="studio-preview">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Album engine</p>
            <h1>{album.title}</h1>
          </div>
          <span className="upload-note">Choose a page, assign its layout, then upload the real photo assets.</span>
        </div>

        <div className="admin-grid">
          {workingPages.map((page) => (
            <button className={`page-card ${selectedPage?.id === page.id ? 'selected' : ''}`} key={page.id} onClick={() => setSelectedPageId(page.id)} type="button">
              <span>{String(page.pageNumber).padStart(2, '0')}</span>
              <h3>{page.title}</h3>
              <p>{page.layout}</p>
            </button>
          ))}
        </div>

        <div className="timeline-panel">
          <h2>Timeline</h2>
          {album.memories.map((memory) => (
            <div className="memory-row" key={memory.id}>
              <CalendarDays size={17} aria-hidden="true" />
              <div>
                <strong>{memory.title}</strong>
                <p>{memory.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="studio-sidebar right">
        <form className="upload-form" onSubmit={submitPhotoUpload}>
          <h2>Photos</h2>
          <input accept="image/jpeg,image/png,image/webp" name="file" type="file" />
          <button disabled={isUploading} type="submit">
            <UploadCloud size={17} aria-hidden="true" />
            {isUploading ? 'Uploading' : 'Upload image'}
          </button>
          <small>{uploadStatus}</small>
        </form>

        <h2>Security</h2>
        <div className="security-list">
          <span>
            <ShieldCheck size={17} aria-hidden="true" />
            Private by default
          </span>
          <span>
            <Palette size={17} aria-hidden="true" />
            Theme: {album.theme}
          </span>
          <span>
            <ImagePlus size={17} aria-hidden="true" />
            {workingPages.reduce((total, page) => total + page.photos.length, 0)} photos
          </span>
        </div>

        <form className="invite-form" onSubmit={handleSubmit(submitInvite)}>
          <h2>Invite</h2>
          <input placeholder="family@email.com" {...register('email')} />
          <select {...register('role')}>
            <option value="Viewer">Viewer</option>
            <option value="Editor">Editor</option>
          </select>
          {formState.errors.email && <small>{formState.errors.email.message}</small>}
          <button type="submit">
            <MailPlus size={17} aria-hidden="true" />
            Create invite
          </button>
        </form>

        <div className="invite-list">
          {invites.map((invite) => (
            <span key={`${invite.email}-${invite.role}`}>
              {invite.email} - {invite.role}
            </span>
          ))}
        </div>
      </aside>
    </section>
  )
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
