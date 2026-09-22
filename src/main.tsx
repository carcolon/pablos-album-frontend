import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { create } from 'zustand'
import gsap from 'gsap'
import {
  BookOpen,
  CalendarDays,
  Captions,
  CheckCircle2,
  Eye,
  ImagePlus,
  Images,
  KeyRound,
  LayoutTemplate,
  Lock,
  LogOut,
  MailPlus,
  Palette,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut,
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

type PhotoLibraryItem = Photo & {
  pageId: string | null
  pageNumber: number | null
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

type DragState = {
  pointerId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  startedAt: number
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
let csrfToken: string | null = null
const layoutOptions = [
  { id: 'FullPhoto', label: '1 foto', capacity: 1, description: 'Ocupa toda la pagina' },
  { id: 'TwoPhotos', label: '2 fotos', capacity: 2, description: 'Dos fotos del mismo tamano' },
  { id: 'ThreePhotos', label: '3 fotos', capacity: 3, description: 'Una grande y dos pequenas' },
]

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

const forgotPasswordSchema = z.object({
  email: z.string().email('Use a valid email.'),
})

const resetPasswordSchema = z.object({
  email: z.string().email('Use a valid email.'),
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: z.string().min(10, 'Use at least 10 characters.'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(10, 'Use the temporary password.'),
  newPassword: z.string().min(10, 'Use at least 10 characters.'),
})

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
  mustChangePassword: boolean
}

type AuthStatus = {
  hasOwner: boolean
  isAuthenticated: boolean
  user: AuthUser | null
}

const queryClient = new QueryClient()
const soundPreferenceKey = 'pablos-album-sound-enabled'
const pageFlipSoundPath = '/audio/page-flip-soft.wav'

function getInitialMode(): AppMode {
  const params = new URLSearchParams(window.location.search)
  return params.get('studio') === '1' ? 'admin' : 'viewer'
}

function syncModeToUrl(mode: AppMode) {
  const url = new URL(window.location.href)
  if (mode === 'admin') {
    url.searchParams.set('studio', '1')
  } else {
    url.searchParams.delete('studio')
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const useAlbumStore = create<{
  mode: AppMode
  pageIndex: number
  soundEnabled: boolean
  setMode: (mode: AppMode) => void
  setPageIndex: (pageIndex: number) => void
  toggleSound: () => void
}>((set) => ({
  mode: getInitialMode(),
  pageIndex: 0,
  soundEnabled: window.localStorage.getItem(soundPreferenceKey) === 'true',
  setMode: (mode) => {
    syncModeToUrl(mode)
    set({ mode })
  },
  setPageIndex: (pageIndex) => set({ pageIndex }),
  toggleSound: () =>
    set((state) => {
      const soundEnabled = !state.soundEnabled
      window.localStorage.setItem(soundPreferenceKey, String(soundEnabled))
      return { soundEnabled }
    }),
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
  pageId: string
  photoId: string
  originalFileName: string
  storedFileName: string
  originalSizeBytes: number
  storedSizeBytes: number
  wasCompressed: boolean
  storageProvider: string
  storageKey: string
}

async function uploadPhoto(albumId: string, pageId: string, file: File): Promise<UploadPhotoResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiFetch(`/api/albums/${albumId}/pages/${pageId}/photos`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await readProblemMessage(response, 'Upload failed'))
  }

  return (await response.json()) as UploadPhotoResponse
}

async function readProblemMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string; title?: string } | null
    return problem?.error ?? problem?.detail ?? problem?.title ?? fallback
  }

  const text = await response.text().catch(() => '')
  return text || fallback
}

async function fetchPhotoLibrary(albumId: string): Promise<PhotoLibraryItem[]> {
  const response = await apiFetch(`/api/albums/${albumId}/photos`)
  if (!response.ok) {
    throw new Error('Photo library unavailable')
  }

  return (await response.json()) as PhotoLibraryItem[]
}

async function updatePageLayout(albumId: string, pageId: string, layout: string): Promise<void> {
  const response = await apiFetch(`/api/albums/${albumId}/pages/${pageId}/layout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout }),
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Layout update failed')
  }
}

async function updateAlbumCoverText(albumId: string, data: { title: string; subtitle: string; description: string }): Promise<void> {
  const response = await apiFetch(`/api/albums/${albumId}/cover`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Cover update failed')
  }
}

async function addAlbumPage(albumId: string, layout = 'FullPhoto'): Promise<AlbumPage> {
  const response = await apiFetch(`/api/albums/${albumId}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout }),
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Page creation failed')
  }

  return (await response.json()) as AlbumPage
}

async function deleteAlbumPage(albumId: string, pageId: string): Promise<void> {
  const response = await apiFetch(`/api/albums/${albumId}/pages/${pageId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Page deletion failed')
  }
}

async function assignPhotoToPage(albumId: string, pageId: string, photoId: string, sortOrder: number): Promise<void> {
  const response = await apiFetch(`/api/albums/${albumId}/pages/${pageId}/photos/${photoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sortOrder }),
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Photo placement failed')
  }
}

async function removePhotoFromAlbum(albumId: string, photoId: string): Promise<void> {
  const response = await apiFetch(`/api/albums/${albumId}/photos/${photoId}/assignment`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Photo removal failed')
  }
}

async function updatePhotoDetails(photoId: string, data: { alt: string; caption: string }): Promise<void> {
  const response = await apiFetch(`/api/photos/${photoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Photo update failed')
  }
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

async function inviteUser(data: InviteForm): Promise<void> {
  const response = await apiFetch('/api/auth/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await readProblemMessage(response, 'Invitation failed.'))
  }
}

async function forgotPassword(data: { email: string }): Promise<void> {
  const response = await apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await readProblemMessage(response, 'Password reset email failed.'))
  }
}

async function resetPassword(data: { email: string; token: string; newPassword: string }): Promise<void> {
  const response = await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await readProblemMessage(response, 'Password reset failed.'))
  }
}

async function changePassword(data: { currentPassword: string; newPassword: string }): Promise<AuthUser> {
  const response = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await readProblemMessage(response, 'Password change failed.'))
  }

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
  const resetParams = new URLSearchParams(window.location.search)
  const isResetPassword = resetParams.get('reset') === '1'
  const isAuthenticated = auth.data?.isAuthenticated == true
  const mustChangePassword = auth.data?.user?.mustChangePassword == true
  const canUseStudio =
    isAuthenticated
    && !mustChangePassword
    && (auth.data?.user?.roles.includes('Owner') || auth.data?.user?.roles.includes('Editor'))

  return (
    <main className="app-shell">
      <TopBar mode={mode} setMode={setMode} apiOffline={isError} user={auth.data?.user ?? null} />
      {isResetPassword ? (
        <ResetPasswordScreen email={resetParams.get('email') ?? ''} token={resetParams.get('token') ?? ''} />
      ) : mode === 'viewer' ? (
        <AlbumViewer album={album} />
      ) : mustChangePassword ? (
        <ChangePasswordScreen />
      ) : canUseStudio ? (
        <AdminStudio album={album} />
      ) : (
        <AuthScreen hasOwner={auth.data?.hasOwner ?? true} />
      )}
    </main>
  )
}

function AuthScreen({ hasOwner }: { hasOwner: boolean }) {
  const isRegister = !hasOwner
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const { register, handleSubmit, formState } = useForm<AuthForm>({
    resolver: zodResolver(isRegister ? registerOwnerSchema : loginSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  })
  const forgotForm = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })
  const mutation = useMutation({
    mutationFn: isRegister ? login : login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      await queryClient.invalidateQueries({ queryKey: ['album'] })
    },
  })
  const forgotMutation = useMutation({
    mutationFn: forgotPassword,
  })

  if (showForgotPassword) {
    return (
      <section className="auth-shell">
        <section className="auth-panel">
          <div className="auth-brand">
            <BookOpen size={24} aria-hidden="true" />
            <span>Pablo's Album</span>
          </div>
          <p className="eyebrow">Studio access</p>
          <h1>Reset password</h1>
          <form className="auth-form" onSubmit={forgotForm.handleSubmit((data) => forgotMutation.mutate(data))}>
            <label>
              Email
              <input autoComplete="email" placeholder="family@email.com" type="email" {...forgotForm.register('email')} />
              {forgotForm.formState.errors.email && <small>{forgotForm.formState.errors.email.message}</small>}
            </label>
            {forgotMutation.error && <small>{forgotMutation.error.message}</small>}
            {forgotMutation.isSuccess && <small className="success-message">If that email exists, a reset link was sent.</small>}
            <button disabled={forgotMutation.isPending} type="submit">
              <MailPlus size={17} aria-hidden="true" />
              {forgotMutation.isPending ? 'Sending' : 'Send reset link'}
            </button>
            <button className="secondary-action" onClick={() => setShowForgotPassword(false)} type="button">
              Back to login
            </button>
          </form>
        </section>
      </section>
    )
  }

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
          {!isRegister && (
            <button className="secondary-action" onClick={() => setShowForgotPassword(true)} type="button">
              Forgot password
            </button>
          )}
        </form>
      </section>
    </section>
  )
}

function ResetPasswordScreen({ email, token }: { email: string; token: string }) {
  const { register, handleSubmit, formState } = useForm<{ email: string; token: string; newPassword: string }>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email, token, newPassword: '' },
  })
  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      window.history.replaceState({}, '', '/')
    },
  })

  return (
    <section className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <BookOpen size={24} aria-hidden="true" />
          <span>Pablo's Album</span>
        </div>
        <p className="eyebrow">Studio access</p>
        <h1>Choose a new password</h1>
        <form className="auth-form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <label>
            Email
            <input autoComplete="email" type="email" {...register('email')} />
            {formState.errors.email && <small>{formState.errors.email.message}</small>}
          </label>
          <input type="hidden" {...register('token')} />
          <label>
            New password
            <input autoComplete="new-password" type="password" {...register('newPassword')} />
            {formState.errors.newPassword && <small>{formState.errors.newPassword.message}</small>}
          </label>
          {mutation.error && <small>{mutation.error.message}</small>}
          {mutation.isSuccess && <small className="success-message">Password changed. You can log in now.</small>}
          <button disabled={mutation.isPending || mutation.isSuccess} type="submit">
            <KeyRound size={17} aria-hidden="true" />
            {mutation.isPending ? 'Changing' : 'Change password'}
          </button>
        </form>
      </section>
    </section>
  )
}

function ChangePasswordScreen() {
  const { register, handleSubmit, formState } = useForm<{ currentPassword: string; newPassword: string }>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })
  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  return (
    <section className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <BookOpen size={24} aria-hidden="true" />
          <span>Pablo's Album</span>
        </div>
        <p className="eyebrow">Required step</p>
        <h1>Change temporary password</h1>
        <form className="auth-form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <label>
            Temporary password
            <input autoComplete="current-password" type="password" {...register('currentPassword')} />
            {formState.errors.currentPassword && <small>{formState.errors.currentPassword.message}</small>}
          </label>
          <label>
            New password
            <input autoComplete="new-password" type="password" {...register('newPassword')} />
            {formState.errors.newPassword && <small>{formState.errors.newPassword.message}</small>}
          </label>
          {mutation.error && <small>{mutation.error.message}</small>}
          <button disabled={mutation.isPending} type="submit">
            <KeyRound size={17} aria-hidden="true" />
            {mutation.isPending ? 'Changing' : 'Change password'}
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
  const bookRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<DragState | null>(null)
  const pageFlipAudioRef = useRef<HTMLAudioElement | null>(null)
  const pressedPhoto = useRef<Photo | null>(null)
  const turnDirection = useRef<'next' | 'previous'>('next')
  const isSinglePage = useIsSinglePage()
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const { pageIndex, setPageIndex, soundEnabled, toggleSound } = useAlbumStore()

  const pages = useMemo(() => [coverPage(album), ...album.pages], [album])
  const leftPage = pages[pageIndex]
  const rightPage = isSinglePage ? null : pages[pageIndex + 1]
  const maxPageIndex = Math.max(0, pages.length - 1)
  const pageStep = isSinglePage ? 1 : 2

  useEffect(() => {
    animateIn()
  }, [pageIndex])

  useEffect(() => {
    const audio = new Audio(pageFlipSoundPath)
    audio.preload = 'auto'
    audio.volume = 0.28
    pageFlipAudioRef.current = audio

    return () => {
      audio.pause()
      pageFlipAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const normalized = normalizePageIndex(pageIndex)
    if (normalized !== pageIndex) {
      setPageIndex(normalized)
    }
  }, [isSinglePage, pages.length])

  function turnTo(nextPageIndex: number) {
    const normalized = normalizePageIndex(nextPageIndex)
    if (normalized === pageIndex) {
      return
    }

    turnDirection.current = normalized > pageIndex ? 'next' : 'previous'
    setPageIndex(normalized)
    playPageFlipSound()
  }

  function normalizePageIndex(value: number) {
    const normalized = Math.max(0, Math.min(maxPageIndex, value))
    return isSinglePage ? normalized : normalized % 2 === 0 ? normalized : normalized - 1
  }

  function playPageFlipSound() {
    const audio = pageFlipAudioRef.current
    if (!soundEnabled || !audio) {
      return
    }

    audio.currentTime = 0
    void audio.play().catch(() => {
      // Browsers can block playback until the next direct user gesture.
    })
  }

  function animateIn() {
    if (!heroRef.current) {
      return
    }

    const timeline = gsap.timeline()
    timeline.fromTo(
      heroRef.current,
      { rotateY: turnDirection.current === 'next' ? -3 : 3, scale: 0.985 },
      { rotateY: 0, scale: 1, duration: 0.55, ease: 'power2.out' },
    )
    timeline.fromTo(
      heroRef.current.querySelector('.turning-sheet'),
      {
        opacity: 0.88,
        rotateY: turnDirection.current === 'next' ? 0 : 0,
        transformOrigin: turnDirection.current === 'next' ? 'left center' : 'right center',
        xPercent: turnDirection.current === 'next' ? 48 : -48,
      },
      {
        opacity: 0,
        rotateY: turnDirection.current === 'next' ? -132 : 132,
        xPercent: turnDirection.current === 'next' ? -8 : 8,
        duration: 0.72,
        ease: 'power2.inOut',
      },
      0,
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

  function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return
    }

    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      startedAt: Date.now(),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.classList.add('dragging')
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    drag.currentX = event.clientX
    drag.currentY = event.clientY
    const delta = drag.currentX - drag.startX
    const clamped = Math.max(-90, Math.min(90, delta))
    gsap.to(bookRef.current, {
      rotateY: clamped / 18,
      x: clamped / 8,
      duration: 0.12,
      ease: 'power2.out',
    })
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    event.currentTarget.classList.remove('dragging')
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragState.current = null
    gsap.to(bookRef.current, { rotateY: 0, x: 0, duration: 0.24, ease: 'power2.out' })

    const delta = drag.currentX - drag.startX
    const verticalDelta = drag.currentY - drag.startY
    const moved = Math.hypot(delta, verticalDelta)
    const elapsed = Math.max(1, Date.now() - drag.startedAt)
    const velocity = Math.abs(delta) / elapsed

    if (pressedPhoto.current && moved < 9) {
      setSelectedPhoto(pressedPhoto.current)
      pressedPhoto.current = null
      return
    }

    pressedPhoto.current = null

    if (delta < -54 || (delta < -28 && velocity > 0.45)) {
      turnTo(pageIndex + pageStep)
    } else if (delta > 54 || (delta > 28 && velocity > 0.45)) {
      turnTo(pageIndex - pageStep)
    }
  }

  return (
    <section className="viewer">
      <div className="viewer-header">
        <p className="eyebrow">Family album</p>
        <h1>{album.title}</h1>
        <div className="viewer-actions">
          <button disabled={pageIndex === 0} onClick={() => turnTo(pageIndex - pageStep)} type="button">
            Previous
          </button>
          <button disabled={pageIndex + pageStep > maxPageIndex} onClick={() => turnTo(pageIndex + pageStep)} type="button">
            Next
          </button>
          <button aria-pressed={soundEnabled} className={soundEnabled ? 'active' : ''} onClick={toggleSound} type="button">
            <Sparkles size={17} aria-hidden="true" />
            Sound {soundEnabled ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div className="book-stage" ref={heroRef}>
        <div className="page-turn-sheen" aria-hidden="true" />
        <div
          className={`album-book ${isSinglePage ? 'single-page-book' : ''}`}
          aria-label={`${album.title} open album`}
          onPointerCancel={endDrag}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          ref={bookRef}
        >
          <div className="turning-sheet" aria-hidden="true" />
          {leftPage && (
            <SpreadPage
              onPhotoPress={(photo) => {
                pressedPhoto.current = photo
              }}
              page={leftPage}
              side={isSinglePage ? 'right' : 'left'}
            />
          )}
          {rightPage ? (
            <SpreadPage
              onPhotoPress={(photo) => {
                pressedPhoto.current = photo
              }}
              page={rightPage}
              side="right"
            />
          ) : (
            !isSinglePage && <article className="book-page blank-page right-page" />
          )}
        </div>
      </div>
      {selectedPhoto && <PhotoLightbox onClose={() => setSelectedPhoto(null)} photo={selectedPhoto} />}
    </section>
  )
}

function useIsSinglePage() {
  const [isSinglePage, setIsSinglePage] = useState(() => window.matchMedia('(max-width: 760px)').matches)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)')
    const update = () => setIsSinglePage(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isSinglePage
}

function coverPage(album: Album): AlbumPage {
  return {
    id: 'cover',
    pageNumber: 0,
    layout: 'Cover',
    title: album.title,
    dateLabel: album.subtitle || 'Family archive',
    text: album.description,
    photos: [],
  }
}

function SpreadPage({
  onPhotoPress,
  page,
  side,
}: {
  onPhotoPress: (photo: Photo) => void
  page: AlbumPage
  side: 'left' | 'right'
}) {
  const firstPhoto = page.photos[0]
  const sideClass = side === 'left' ? 'left-page' : 'right-page'

  if (page.layout === 'Cover') {
    return (
      <article className={`book-page cover-page ${sideClass}`}>
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
      <article className={`book-page letter-page ${sideClass}`}>
        <div className="page-copy">
          <p className="eyebrow">{page.dateLabel}</p>
          <h2>{page.title}</h2>
        </div>
        <p className="letter-body">{page.text}</p>
      </article>
    )
  }

  if (page.layout === 'TwoPhotos' || page.layout === 'ThreePhotos') {
    const slots = Array.from({ length: getLayoutCapacity(page.layout) })
    return (
      <article className={`book-page collage-page ${page.layout === 'ThreePhotos' ? 'three-photo-page' : ''} ${sideClass}`}>
        <div className={page.layout === 'ThreePhotos' ? 'photo-grid photo-grid-three' : 'photo-grid'}>
          {slots.map((_, index) => {
            const photo = page.photos[index]
            return photo ? (
              <button
                aria-label={`Open ${photo.alt || photo.caption || `photo ${index + 1}`}`}
                className="photo-frame photo-button"
                key={photo.id}
                onClick={(event) => event.preventDefault()}
                onPointerDown={() => onPhotoPress(photo)}
                type="button"
              >
                <img src={mediaUrl(photo.url)} alt={photo.alt} />
                <PhotoMeta photo={photo} />
              </button>
            ) : (
              <EmptyPhotoSlot key={index} label={`Photo ${index + 1}`} />
            )
          })}
        </div>
      </article>
    )
  }

  return (
    <article className={`book-page photo-page ${sideClass}`}>
      {firstPhoto ? (
        <button
          aria-label={`Open ${firstPhoto.alt || firstPhoto.caption || 'photo'}`}
          className="photo-frame hero-photo photo-button"
          onClick={(event) => event.preventDefault()}
          onPointerDown={() => onPhotoPress(firstPhoto)}
          type="button"
        >
          <img src={mediaUrl(firstPhoto.url)} alt={firstPhoto.alt} />
          <PhotoMeta photo={firstPhoto} />
        </button>
      ) : (
        <EmptyPhotoSlot label="Photo" />
      )}
    </article>
  )
}

function PhotoMeta({ photo }: { photo: Photo }) {
  if (!photo.alt && !photo.caption) {
    return null
  }

  return (
    <span className="photo-meta">
      {photo.alt && <strong>{photo.alt}</strong>}
      {photo.caption && <small>{photo.caption}</small>}
    </span>
  )
}

function getLayoutCapacity(layout: string) {
  return layoutOptions.find((option) => option.id === layout)?.capacity ?? 1
}

function mediaUrl(url: string) {
  if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }

  return `${apiBaseUrl}${url.startsWith('/') ? url : `/${url}`}`
}

function PhotoLightbox({ onClose, photo }: { onClose: () => void; photo: Photo }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<DragState | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function setBoundedZoom(nextZoom: number) {
    setZoom(Math.max(1, Math.min(4, nextZoom)))
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) {
      return
    }

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX - pan.x,
      startY: event.clientY - pan.y,
      currentX: event.clientX,
      currentY: event.clientY,
      startedAt: Date.now(),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId || zoom <= 1) {
      return
    }

    drag.current.currentX = event.clientX
    drag.current.currentY = event.clientY
    setPan({ x: event.clientX - drag.current.startX, y: event.clientY - drag.current.startY })
  }

  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = null
  }

  function wheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    setBoundedZoom(zoom + (event.deltaY > 0 ? -0.18 : 0.18))
  }

  return (
    <div className="lightbox" role="dialog" aria-label={photo.alt || photo.caption || 'Photo preview'}>
      <button className="lightbox-backdrop" onClick={onClose} type="button" />
      <div className="lightbox-panel">
        <div className="lightbox-toolbar">
          <button onClick={() => setBoundedZoom(zoom + 0.35)} type="button">
            <ZoomIn size={18} aria-hidden="true" />
            Zoom
          </button>
          <button onClick={() => setBoundedZoom(zoom - 0.35)} type="button">
            <ZoomOut size={18} aria-hidden="true" />
            Out
          </button>
          <button onClick={resetView} type="button">
            <RotateCcw size={18} aria-hidden="true" />
            Reset
          </button>
          <button aria-label="Close photo preview" onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="lightbox-canvas" onPointerCancel={endPan} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onWheel={wheelZoom}>
          <img
            alt={photo.alt}
            draggable={false}
            src={mediaUrl(photo.url)}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          />
        </div>
        {photo.caption && <p>{photo.caption}</p>}
      </div>
    </div>
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
    defaultValues: { email: '', role: 'Editor' },
  })
  const [invites, setInvites] = useState<InviteForm[]>([])
  const [uploadStatus, setUploadStatus] = useState<string>('Ready to upload to Google Drive.')
  const [studioStatus, setStudioStatus] = useState<string>('Arrastra fotos desde la biblioteca hacia la pagina seleccionada.')
  const [isUploading, setIsUploading] = useState(false)
  const [workingPages, setWorkingPages] = useState<AlbumPage[]>(album.pages)
  const [selectedPageId, setSelectedPageId] = useState<string>(album.pages[0]?.id ?? '')
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>('')
  const [draggedPhotoId, setDraggedPhotoId] = useState<string>('')
  const [photoTitle, setPhotoTitle] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [coverTitle, setCoverTitle] = useState(album.title)
  const [coverSubtitle, setCoverSubtitle] = useState(album.subtitle)
  const [coverDescription, setCoverDescription] = useState(album.description)
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)
  const [isPageMutating, setIsPageMutating] = useState(false)
  const [isPhotoMutating, setIsPhotoMutating] = useState(false)
  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (_, data) => {
      setInvites((current) => [data, ...current])
      reset({ email: '', role: 'Editor' })
    },
  })
  const photoLibrary = useQuery({
    queryKey: ['photo-library', album.id],
    queryFn: () => fetchPhotoLibrary(album.id),
    enabled: Boolean(album.id),
    retry: false,
  })

  useEffect(() => {
    setWorkingPages(album.pages)
    setSelectedPageId((current) => (album.pages.some((page) => page.id === current) ? current : album.pages[0]?.id ?? ''))
    setCoverTitle(album.title)
    setCoverSubtitle(album.subtitle)
    setCoverDescription(album.description)
  }, [album])

  const selectedPage = workingPages.find((page) => page.id === selectedPageId) ?? workingPages[0]
  const selectedLayout = layoutOptions.find((layout) => layout.id === selectedPage?.layout) ?? layoutOptions[0]
  const libraryPhotos = photoLibrary.data ?? workingPages.flatMap((page) => page.photos.map((photo) => ({ ...photo, pageId: page.id, pageNumber: page.pageNumber })))
  const selectedPhoto = libraryPhotos.find((photo) => photo.id === selectedPhotoId) ?? selectedPage?.photos[0] ?? libraryPhotos[0]
  const orderedPagePhotos = [...(selectedPage?.photos ?? [])].sort((left, right) => left.sortOrder - right.sortOrder)
  const filledSlots = orderedPagePhotos.length
  const canDeleteSelectedPage = Boolean(selectedPage) && workingPages.length > 1 && selectedPage.photos.length === 0

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoTitle('')
      setPhotoCaption('')
      return
    }

    setSelectedPhotoId(selectedPhoto.id)
    setPhotoTitle(selectedPhoto.alt)
    setPhotoCaption(selectedPhoto.caption)
  }, [selectedPhoto?.id, selectedPhoto?.alt, selectedPhoto?.caption])

  async function assignLayout(layout: string) {
    if (!selectedPage) {
      return
    }

    const nextCapacity = getLayoutCapacity(layout)
    if (selectedPage.photos.length > nextCapacity) {
      setStudioStatus(`Esta pagina tiene ${selectedPage.photos.length} fotos. Quita o mueve algunas antes de usar un layout de ${nextCapacity}.`)
      return
    }

    setWorkingPages((pages) => pages.map((page) => (page.id === selectedPage.id ? { ...page, layout } : page)))
    setStudioStatus('Guardando layout...')
    try {
      await updatePageLayout(album.id, selectedPage.id, layout)
      await queryClient.invalidateQueries({ queryKey: ['album'] })
      setStudioStatus('Layout guardado.')
    } catch (error) {
      setStudioStatus(error instanceof Error ? error.message : 'Layout update failed.')
      setWorkingPages(album.pages)
    }
  }

  async function createPage() {
    setIsPageMutating(true)
    setStudioStatus('Creando nueva pagina...')
    try {
      const page = await addAlbumPage(album.id, 'FullPhoto')
      setSelectedPageId(page.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['album'] }),
        queryClient.invalidateQueries({ queryKey: ['photo-library', album.id] }),
      ])
      setStudioStatus(`Pagina ${String(page.pageNumber).padStart(2, '0')} creada.`)
    } catch (error) {
      setStudioStatus(error instanceof Error ? error.message : 'Page creation failed.')
    } finally {
      setIsPageMutating(false)
    }
  }

  async function removeSelectedPage() {
    if (!selectedPage) {
      return
    }

    if (!canDeleteSelectedPage) {
      setStudioStatus(
        selectedPage.photos.length > 0
          ? 'Mueve las fotos de esta pagina antes de eliminarla.'
          : 'El album debe conservar al menos una pagina.',
      )
      return
    }

    const previousPage = workingPages
      .filter((page) => page.id !== selectedPage.id)
      .find((page) => page.pageNumber >= selectedPage.pageNumber)
      ?? workingPages.filter((page) => page.id !== selectedPage.id).at(-1)

    setIsPageMutating(true)
    setStudioStatus('Eliminando pagina...')
    try {
      await deleteAlbumPage(album.id, selectedPage.id)
      if (previousPage) {
        setSelectedPageId(previousPage.id)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['album'] }),
        queryClient.invalidateQueries({ queryKey: ['photo-library', album.id] }),
      ])
      setStudioStatus('Pagina eliminada.')
    } catch (error) {
      setStudioStatus(error instanceof Error ? error.message : 'Page deletion failed.')
    } finally {
      setIsPageMutating(false)
    }
  }

  async function dropPhotoOnSlot(event: React.DragEvent<HTMLDivElement>, slotIndex: number) {
    event.preventDefault()
    const photoId = event.dataTransfer.getData('photo/id') || draggedPhotoId
    if (!photoId || !selectedPage) {
      return
    }

    setStudioStatus('Ubicando foto en la pagina...')
    try {
      await assignPhotoToPage(album.id, selectedPage.id, photoId, slotIndex + 1)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['album'] }),
        queryClient.invalidateQueries({ queryKey: ['photo-library', album.id] }),
      ])
      setSelectedPhotoId(photoId)
      setStudioStatus('Foto ubicada y guardada.')
    } catch (error) {
      setStudioStatus(error instanceof Error ? error.message : 'Photo placement failed.')
    } finally {
      setDraggedPhotoId('')
    }
  }

  async function unassignPhoto(photo: Photo) {
    setIsPhotoMutating(true)
    setStudioStatus('Quitando foto de la pagina...')
    try {
      await removePhotoFromAlbum(album.id, photo.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['album'] }),
        queryClient.invalidateQueries({ queryKey: ['photo-library', album.id] }),
      ])
      setSelectedPhotoId(photo.id)
      setStudioStatus('Foto quitada del album. Sigue disponible en la biblioteca.')
    } catch (error) {
      setStudioStatus(error instanceof Error ? error.message : 'Photo removal failed.')
    } finally {
      setIsPhotoMutating(false)
    }
  }

  async function savePhotoDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPhoto) {
      return
    }

    setStudioStatus('Guardando titulo de foto...')
    try {
      await updatePhotoDetails(selectedPhoto.id, { alt: photoTitle, caption: photoCaption })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['album'] }),
        queryClient.invalidateQueries({ queryKey: ['photo-library', album.id] }),
      ])
      setStudioStatus('Foto actualizada.')
    } catch (error) {
      setStudioStatus(error instanceof Error ? error.message : 'Photo update failed.')
    }
  }

  async function saveCoverText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStudioStatus('Guardando portada...')
    try {
      await updateAlbumCoverText(album.id, {
        title: coverTitle,
        subtitle: coverSubtitle,
        description: coverDescription,
      })
      await queryClient.invalidateQueries({ queryKey: ['album'] })
      setStudioStatus('Portada actualizada.')
    } catch (error) {
      setStudioStatus(error instanceof Error ? error.message : 'Cover update failed.')
    }
  }

  function submitInvite(data: InviteForm) {
    inviteMutation.mutate(data)
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
      if (!selectedPage) {
        setUploadStatus('Choose a page first.')
        return
      }

      const result = await uploadPhoto(album.id, selectedPage.id, file)
      const beforeMb = (result.originalSizeBytes / 1024 / 1024).toFixed(2)
      const afterMb = (result.storedSizeBytes / 1024 / 1024).toFixed(2)
      setUploadStatus(
        `${result.storedFileName} saved in ${result.storageProvider}. ${beforeMb} MB -> ${afterMb} MB${
          result.wasCompressed ? ' after compression.' : '.'
        }`,
      )
      form.reset()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['album'] }),
        queryClient.invalidateQueries({ queryKey: ['photo-library', album.id] }),
      ])
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="studio">
      <aside className="studio-sidebar studio-pages-panel">
        <div className="studio-section-heading">
          <p className="eyebrow">Studio</p>
          <h2>Paginas</h2>
        </div>
        <button className="page-action-button" disabled={isPageMutating} onClick={createPage} type="button">
          <Plus size={17} aria-hidden="true" />
          Agregar pagina
        </button>
        <div className="studio-page-list">
          {workingPages.map((page) => (
            <button className={`studio-page-item ${selectedPage?.id === page.id ? 'active' : ''}`} key={page.id} onClick={() => setSelectedPageId(page.id)} type="button">
              <span>{String(page.pageNumber).padStart(2, '0')}</span>
              <strong>{page.title}</strong>
              <small>
                {layoutOptions.find((layout) => layout.id === page.layout)?.label ?? page.layout} - {page.photos.length}/
                {getLayoutCapacity(page.layout)}
              </small>
            </button>
          ))}
        </div>
      </aside>

      <div className="studio-workspace">
        <div className="studio-workspace-header">
          <div>
            <p className="eyebrow">Pagina {String(selectedPage?.pageNumber ?? 0).padStart(2, '0')}</p>
            <h1>{selectedPage?.title ?? album.title}</h1>
          </div>
          <span className="studio-status">{studioStatus}</span>
        </div>

        <div className="layout-toolbar" aria-label="Page layouts">
          {layoutOptions.map((layout) => (
            <button className={selectedPage?.layout === layout.id ? 'active' : ''} key={layout.id} onClick={() => assignLayout(layout.id)} type="button">
              <LayoutTemplate size={17} aria-hidden="true" />
              <span>
                <strong>{layout.label}</strong>
                <small>{layout.description}</small>
              </span>
            </button>
          ))}
        </div>

        <div className={`studio-page-canvas layout-${selectedLayout.capacity}`} aria-label="Selected album page">
          {Array.from({ length: selectedLayout.capacity }).map((_, index) => {
            const photo = orderedPagePhotos[index]
            return (
              <div
                className={`drop-slot ${photo ? 'filled' : ''}`}
                key={index}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropPhotoOnSlot(event, index)}
              >
                {photo ? (
                  <>
                    <button className={selectedPhoto?.id === photo.id ? 'selected-photo' : ''} onClick={() => setSelectedPhotoId(photo.id)} type="button">
                      <img src={mediaUrl(photo.url)} alt={photo.alt} />
                      <span>{photo.alt || `Foto ${index + 1}`}</span>
                    </button>
                    <button
                      aria-label={`Quitar ${photo.alt || `foto ${index + 1}`} de esta pagina`}
                      className="remove-photo-button"
                      disabled={isPhotoMutating}
                      onClick={(event) => {
                        event.stopPropagation()
                        unassignPhoto(photo)
                      }}
                      title="Quitar del album, conservar en biblioteca"
                      type="button"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <div>
                    <UploadCloud size={26} aria-hidden="true" />
                    <strong>Soltar foto {index + 1}</strong>
                    <small>{index === 0 && selectedLayout.capacity === 3 ? 'Esta sera la foto grande' : 'Arrastra desde la biblioteca'}</small>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="studio-page-meta">
          <span>
            <CheckCircle2 size={17} aria-hidden="true" />
            Layout: {selectedLayout.label}
          </span>
          <span>
            <Images size={17} aria-hidden="true" />
            {filledSlots}/{selectedLayout.capacity} fotos en esta pagina
          </span>
          <span>
            <CalendarDays size={17} aria-hidden="true" />
            {selectedPage?.dateLabel || 'Sin fecha'}
          </span>
          <button
            className="delete-page-button"
            disabled={!canDeleteSelectedPage || isPageMutating}
            onClick={removeSelectedPage}
            title={
              selectedPage?.photos.length
                ? 'Mueve las fotos antes de eliminar esta pagina.'
                : workingPages.length <= 1
                  ? 'El album debe conservar al menos una pagina.'
                  : 'Eliminar pagina vacia'
            }
            type="button"
          >
            <Trash2 size={17} aria-hidden="true" />
            Eliminar pagina
          </button>
        </div>
      </div>

      <aside className="studio-sidebar studio-media-panel">
        <form className="cover-editor" onSubmit={saveCoverText}>
          <div className="studio-section-heading">
            <p className="eyebrow">Portada</p>
            <h2>Texto</h2>
          </div>
          <label>
            Titulo
            <input onChange={(event) => setCoverTitle(event.target.value)} value={coverTitle} />
          </label>
          <label>
            Subtitulo
            <input onChange={(event) => setCoverSubtitle(event.target.value)} value={coverSubtitle} />
          </label>
          <label>
            Descripcion
            <textarea onChange={(event) => setCoverDescription(event.target.value)} rows={3} value={coverDescription} />
          </label>
          <button type="submit">
            <Save size={17} aria-hidden="true" />
            Guardar portada
          </button>
        </form>

        <form className="studio-upload" onSubmit={submitPhotoUpload}>
          <div className="studio-section-heading">
            <p className="eyebrow">Drive</p>
            <h2>Fotos</h2>
          </div>
          <input accept="image/jpeg,image/png,image/webp" name="file" type="file" />
          <button disabled={isUploading || !selectedPage} type="submit">
            <UploadCloud size={17} aria-hidden="true" />
            {isUploading ? 'Subiendo' : `Subir a pagina ${selectedPage?.pageNumber ?? ''}`}
          </button>
          <small>{uploadStatus}</small>
        </form>

        <div className="photo-library">
          <div className="library-heading">
            <strong>Biblioteca</strong>
            <span>{libraryPhotos.length} fotos</span>
          </div>
          {photoLibrary.isError && <small>No pude leer la biblioteca; uso las fotos del album cargado.</small>}
          <div className="library-grid">
            {libraryPhotos.map((photo) => (
              <button
                className={selectedPhoto?.id === photo.id ? 'active' : ''}
                draggable
                key={photo.id}
                onClick={() => setSelectedPhotoId(photo.id)}
                onDoubleClick={() => setPreviewPhoto(photo)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('photo/id', photo.id)
                  setDraggedPhotoId(photo.id)
                }}
                type="button"
              >
                <img src={mediaUrl(photo.url)} alt={photo.alt} />
                <span>{photo.pageNumber ? `Pag. ${photo.pageNumber}` : 'No asignada'}</span>
              </button>
            ))}
            {libraryPhotos.length === 0 && <p className="empty-library">Sube la primera foto para empezar a disenar las paginas.</p>}
          </div>
        </div>

        <form className="photo-editor" onSubmit={savePhotoDetails}>
          <div className="library-heading">
            <strong>Editar foto</strong>
            <span>
              {selectedPhoto
                ? 'pageNumber' in selectedPhoto
                  ? selectedPhoto.pageNumber
                    ? `Pag. ${selectedPhoto.pageNumber}`
                    : 'No asignada'
                  : `Pag. ${selectedPage?.pageNumber}`
                : 'Sin foto'}
            </span>
          </div>
          <label>
            Titulo
            <input disabled={!selectedPhoto} onChange={(event) => setPhotoTitle(event.target.value)} value={photoTitle} />
          </label>
          <label>
            Caption
            <textarea disabled={!selectedPhoto} onChange={(event) => setPhotoCaption(event.target.value)} rows={3} value={photoCaption} />
          </label>
          <div className="editor-actions">
            <button disabled={!selectedPhoto} type="submit">
              <Save size={17} aria-hidden="true" />
              Guardar
            </button>
            <button disabled={!selectedPhoto} onClick={() => selectedPhoto && setPreviewPhoto(selectedPhoto)} type="button">
              <Captions size={17} aria-hidden="true" />
              Ver
            </button>
          </div>
        </form>

        <details className="studio-details">
          <summary>Seguridad e invitaciones</summary>
          <div className="security-list">
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              Privado para editar
            </span>
            <span>
              <Palette size={17} aria-hidden="true" />
              Tema: {album.theme}
            </span>
          </div>
          <form className="invite-form" onSubmit={handleSubmit(submitInvite)}>
            <input placeholder="family@email.com" {...register('email')} />
            <select {...register('role')}>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
            {formState.errors.email && <small>{formState.errors.email.message}</small>}
            {inviteMutation.error && <small>{inviteMutation.error.message}</small>}
            {inviteMutation.isSuccess && <small className="success-message">Invitacion enviada por email.</small>}
            <button disabled={inviteMutation.isPending} type="submit">
              <MailPlus size={17} aria-hidden="true" />
              {inviteMutation.isPending ? 'Enviando' : 'Enviar invitacion'}
            </button>
          </form>

          <div className="invite-list">
            {invites.map((invite) => (
              <span key={`${invite.email}-${invite.role}`}>
                {invite.email} - {invite.role}
              </span>
            ))}
          </div>
        </details>
        {previewPhoto && <PhotoLightbox onClose={() => setPreviewPhoto(null)} photo={previewPhoto} />}
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
