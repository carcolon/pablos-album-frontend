import React, { useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import HTMLFlipBook from 'react-pageflip'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
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
  LayoutTemplate,
  Lock,
  MailPlus,
  Palette,
  ShieldCheck,
  Sparkles,
  UploadCloud,
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

const fallbackAlbum: Album = {
  id: '018f4b44-6f15-7a45-a810-a1168d98c041',
  title: "Pablo's Album",
  subtitle: 'A private family book for the moments that become home.',
  description: 'A premium album viewer and admin studio prototype built from the technical guide.',
  theme: 'classic-warm',
  coverPhotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1800&q=85',
  pages: [
    {
      id: 'p1',
      pageNumber: 1,
      layout: 'FullPhoto',
      title: 'Before You',
      dateLabel: 'Chapter 00',
      text: 'A quiet page for the little rituals, notes and photographs that made room for Pablo before the first hello.',
      photos: [
        {
          id: 'ph1',
          url: 'https://images.unsplash.com/photo-1491013516836-7db643ee125a?auto=format&fit=crop&w=1600&q=85',
          alt: 'A warm family moment near a window.',
          caption: 'Waiting for you with a house already full of stories.',
          storageProvider: 'SEED',
          storageKey: 'before-you-cover',
          sortOrder: 1,
        },
      ],
    },
    {
      id: 'p2',
      pageNumber: 2,
      layout: 'PhotoWithCaption',
      title: 'Hello World',
      dateLabel: 'The first chapter',
      text: 'The album opens with a first portrait, a date, and space for the words everyone will want to read again years from now.',
      photos: [
        {
          id: 'ph2',
          url: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=1600&q=85',
          alt: 'A baby resting peacefully.',
          caption: 'The first hello.',
          storageProvider: 'SEED',
          storageKey: 'hello-world',
          sortOrder: 1,
        },
      ],
    },
    {
      id: 'p3',
      pageNumber: 3,
      layout: 'TwoPhotos',
      title: 'Small Discoveries',
      dateLabel: 'First month',
      text: 'Two-photo spreads make room for comparisons: tiny hands, sleepy mornings, and the details that change faster than anyone expects.',
      photos: [
        {
          id: 'ph3',
          url: 'https://images.unsplash.com/photo-1546015720-b8b30df5aa27?auto=format&fit=crop&w=1200&q=85',
          alt: 'A close family detail.',
          caption: 'Tiny hands.',
          storageProvider: 'SEED',
          storageKey: 'small-discoveries-1',
          sortOrder: 1,
        },
        {
          id: 'ph4',
          url: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=85',
          alt: 'Soft toys in a nursery.',
          caption: 'A room becoming his.',
          storageProvider: 'SEED',
          storageKey: 'small-discoveries-2',
          sortOrder: 2,
        },
      ],
    },
    {
      id: 'p4',
      pageNumber: 4,
      layout: 'Letter',
      title: 'A Letter for Later',
      dateLabel: 'Read this when you are older',
      text: 'Pablo, this page is for the words that do not fit under a photograph. The app treats letters as first-class memories so the family can preserve voice, context and tenderness, not only images.',
      photos: [],
    },
  ],
  memories: [
    {
      id: 'm1',
      title: 'Album started',
      description: 'The first private prototype is ready to grow into the real family album.',
      date: '2026-09-18',
      type: 'Milestone',
      linkedPageId: 'p1',
    },
    {
      id: 'm2',
      title: 'Viewer experience',
      description: 'Page flip, editorial spreads and responsive reading are part of the first usable slice.',
      date: '2026-09-18',
      type: 'Experience',
      linkedPageId: 'p2',
    },
    {
      id: 'm3',
      title: 'Admin Studio',
      description: 'Layouts, pages, invitations and audit notes are visible for the owner workflow.',
      date: '2026-09-18',
      type: 'Admin',
      linkedPageId: 'p3',
    },
  ],
}

const inviteSchema = z.object({
  email: z.string().email('Use a valid email.'),
  role: z.enum(['Viewer', 'Editor']),
})

type InviteForm = z.infer<typeof inviteSchema>

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
  const response = await fetch(`${apiBaseUrl}/api/albums`)
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

  const response = await fetch(`${apiBaseUrl}/api/albums/${albumId}/photos`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null
    throw new Error(problem?.error ?? problem?.detail ?? 'Upload failed')
  }

  return (await response.json()) as UploadPhotoResponse
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
  const { data: album = fallbackAlbum, isError } = useAlbum()
  const { mode, setMode } = useAlbumStore()

  return (
    <main className="app-shell">
      <TopBar mode={mode} setMode={setMode} apiOffline={isError} />
      {mode === 'viewer' ? <AlbumViewer album={album} /> : <AdminStudio album={album} />}
    </main>
  )
}

function TopBar({
  mode,
  setMode,
  apiOffline,
}: {
  mode: AppMode
  setMode: (mode: AppMode) => void
  apiOffline: boolean
}) {
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
      <div className="privacy-pill" title="Private media is served through the API in production.">
        <Lock size={16} aria-hidden="true" />
        {apiOffline ? 'Demo data' : 'API connected'}
      </div>
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

    gsap.fromTo(
      heroRef.current.querySelectorAll('.page-copy, .photo-frame, .letter-body'),
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.06, duration: 0.65, ease: 'power3.out' },
    )
  }

  return (
    <section className="viewer">
      <div className="viewer-copy">
        <p className="eyebrow">Private family album</p>
        <h1>{album.title}</h1>
        <p>{album.subtitle}</p>
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
            <SpreadPage key={page.id} page={page} coverPhotoUrl={album.coverPhotoUrl} />
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
    photos: [
      {
        id: 'cover-photo',
        url: album.coverPhotoUrl,
        alt: 'Family album cover image.',
        caption: album.subtitle,
        storageProvider: 'SEED',
        storageKey: 'cover',
        sortOrder: 0,
      },
    ],
  }
}

function SpreadPage({ page, coverPhotoUrl }: { page: AlbumPage; coverPhotoUrl: string }) {
  const firstPhoto = page.photos[0]

  if (page.layout === 'Cover') {
    return (
      <article className="book-page cover-page">
        <img src={coverPhotoUrl} alt="" />
        <div className="cover-overlay">
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
          {page.photos.map((photo) => (
            <figure className="photo-frame" key={photo.id}>
              <img src={photo.url} alt={photo.alt} />
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
        <p>{page.text}</p>
      </article>
    )
  }

  return (
    <article className="book-page photo-page">
      {firstPhoto && (
        <figure className="photo-frame hero-photo">
          <img src={firstPhoto.url} alt={firstPhoto.alt} />
          <figcaption>{firstPhoto.caption}</figcaption>
        </figure>
      )}
      <div className="page-copy">
        <p className="eyebrow">{page.dateLabel}</p>
        <h2>{page.title}</h2>
        <p>{page.text}</p>
      </div>
    </article>
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

  function submitInvite(data: InviteForm) {
    setInvites((current) => [data, ...current])
    reset({ email: '', role: 'Viewer' })
  }

  async function submitPhotoUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
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
      event.currentTarget.reset()
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
        {['FullPhoto', 'PhotoWithCaption', 'TwoPhotos', 'Letter', 'Milestone'].map((layout) => (
          <button key={layout} type="button">
            <LayoutTemplate size={17} aria-hidden="true" />
            {layout}
          </button>
        ))}
      </aside>

      <div className="studio-preview">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Album engine</p>
            <h1>{album.title}</h1>
          </div>
          <span className="upload-note">Images over 10 MB are compressed before Drive storage.</span>
        </div>

        <div className="admin-grid">
          {album.pages.map((page) => (
            <article className="page-card" key={page.id}>
              <span>{String(page.pageNumber).padStart(2, '0')}</span>
              <h3>{page.title}</h3>
              <p>{page.layout}</p>
            </article>
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
            {album.pages.reduce((total, page) => total + page.photos.length, 0)} photos
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
