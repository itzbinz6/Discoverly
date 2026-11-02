'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Video = {
  id: string;
  category: string;
  categoryId?: string;
  title: string;
  creator: string;
  views: string;
  age: string;
  duration: string;
  score: number;
  tone: string;
  thumbnail?: string;
  videoUrl?: string;
  publishedAt?: string;
  progress?: number;
  remaining?: string;
};
const videos: Video[] = [
  { id: 'web-build', category: 'TECHNOLOGY', title: 'A Better Way to Build on the Web', creator: 'Mina Rowe', views: '510K views', age: '2 days ago', duration: '18:42', score: 92, tone: 'tech' },
  { id: 'brand-system', category: 'DESIGN', title: 'Color Stories: Building a Brand System', creator: 'Studio Forma', views: '324K views', age: '3 weeks ago', duration: '12:06', score: 88, tone: 'design' },
  { id: 'small-team', category: 'BUSINESS', title: 'The Small Team Advantage', creator: 'Work in Progress', views: '689K views', age: '8 months ago', duration: '24:18', score: 85, tone: 'business' },
  { id: 'matter', category: 'SCIENCE', title: 'The Hidden Patterns of Everyday Matter', creator: 'Field Notes', views: '278K views', age: '5 days ago', duration: '09:14', score: 90, tone: 'science' },
  { id: 'two-oceans', category: 'TRAVEL', title: 'One Road, Two Oceans', creator: 'Open Atlas', views: '755K views', age: '2 weeks ago', duration: '16:35', score: 94, tone: 'travel' },
  { id: 'great-chorus', category: 'MUSIC', title: 'The Anatomy of a Great Chorus', creator: 'Sound Room', views: '402K views', age: '1 year ago', duration: '21:02', score: 83, tone: 'music' },
];
const featuredVideo: Video = { id: 'mountains', category: 'TRAVEL', title: 'Above the Quiet: Mountains at First Light', creator: 'Northbound Films', views: '842K views', age: '4 days ago', duration: '14:28', score: 96, tone: 'travel' };
const continueVideo: Video = { id: 'public-spaces', category: 'DESIGN', title: 'A New Language for Public Spaces', creator: 'City Form', views: '—', age: 'Continue watching', duration: '18:30', score: 87, tone: 'design' };
const popularSearches = [
  'Artificial Intelligence',
  'Web Development',
  'Blockchain Technology',
  'UI/UX Design',
  'Science and Technology',
  'Business Ideas',
  'Generative AI',
  'Programming Tutorials',
];
const formatYouTubeDuration = (value: string) => {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return "0:00";

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatYouTubeAge = (publishedAt: string) => {
  const days = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(publishedAt).getTime()) / 86400000
    )
  );

  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;

  return `${Math.floor(days / 365)} years ago`;
};

const formatYouTubeViews = (views: number) => {
  return `${new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(views)} views`;
};

type YouTubeVideo = {
  id: string;
  title: string;
  creator: string;
  thumbnail: string;
  views: number;
  publishedAt: string;
  duration: string;
  videoUrl: string;
  category: string;
  categoryId: string;
};

type YouTubeCategory = {
  id: string;
  name: string;
};

const convertYouTubeVideos = (items: YouTubeVideo[]): Video[] => {
  return items.map((item) => ({
    id: item.id,
    category: item.category.toUpperCase(),
    categoryId: item.categoryId,
    title: item.title,
    creator: item.creator,
    views: formatYouTubeViews(item.views),
    age: formatYouTubeAge(item.publishedAt),
    duration: formatYouTubeDuration(item.duration),
    score: 0,
    tone: 'tech',
    thumbnail: item.thumbnail,
    videoUrl: item.videoUrl,
    publishedAt: item.publishedAt,
  }));
};

const durationSeconds = (value: string) => {
  const parts = value.split(':').map(Number);

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const [minutes, seconds] = parts;
  return minutes * 60 + seconds;
};
const ageDays = (age: string) => { const n = Number(age.match(/\d+/)?.[0] ?? 0); if (age.includes('year')) return n * 365; if (age.includes('month')) return n * 30; if (age.includes('week')) return n * 7; return n; };
function Score({ value }: { value: number }) { return <div className="score-ring" aria-label={`Example match score ${value}`}><span>{value}</span></div>; }
function VideoCard({ video, saved, onToggleSave, onPreview }: { video: Video; saved: boolean; onToggleSave: (id: string) => void; onPreview: (video: Video) => void }) {
  return <article className="video-card"><div
  className={`video-thumb ${video.tone}`}
  style={
    video.thumbnail
      ? {
          backgroundImage: `url("${video.thumbnail}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : undefined
  }
>{video.score > 0 && <Score value={video.score} />}<button className="play-button" aria-label={`Open ${video.title}`} onClick={() => onPreview(video)}>▶</button><span className="duration">{video.duration}</span></div><div className="video-details"><div className="category-label">{video.category}</div><div className="video-title-line"><h3>{video.title}</h3><button className={`save-button ${saved ? 'saved' : ''}`} aria-label={saved ? `Remove ${video.title} from Watch Later` : `Save ${video.title} to Watch Later`} title={saved ? 'Remove from Watch Later' : 'Save to Watch Later'} onClick={() => onToggleSave(video.id)}>{saved ? '✓' : '♧'}</button></div><p className="video-meta">{video.creator} · {video.views} · {video.age}</p></div></article>;
}
export default function Home() {
  const [supabase] = useState(() => createClient());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [preferredTopics, setPreferredTopics] = useState<string[]>([]);
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [savedVideosLoading, setSavedVideosLoading] = useState(false);
  const activeUserIdRef = useRef<string | null>(null);
  const savingVideoIdRef = useRef<string | null>(null);
 
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [duration, setDuration] = useState('Any length');
  const [date, setDate] = useState('Any time');
  const [sort, setSort] = useState('Best match');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [liveVideos, setLiveVideos] = useState<Video[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [youtubeCategories, setYoutubeCategories] = useState<YouTubeCategory[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const currentFeaturedVideo = liveVideos[0] ?? featuredVideo;
  const nextVideoToExplore = liveVideos[1] ?? liveVideos[0] ?? null;
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchFormRef = useRef<HTMLFormElement>(null);

  const searchSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return popularSearches.slice(0, 5);

    return popularSearches
      .filter((suggestion) =>
        suggestion.toLowerCase().includes(normalizedQuery)
      )
      .sort((a, b) => {
        const aStartsWithQuery = a.toLowerCase().startsWith(normalizedQuery);
        const bStartsWithQuery = b.toLowerCase().startsWith(normalizedQuery);
        return Number(bStartsWithQuery) - Number(aStartsWithQuery);
      })
      .slice(0, 5);
  }, [query]);

  useEffect(() => {
    if (!searchFocused) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !searchFormRef.current?.contains(event.target)
      ) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [searchFocused]);

  useEffect(() => {
    let mounted = true;
    let sessionRequestId = 0;

    const syncSession = async (
      sessionUserId: string | null,
      sessionEmail: string | null
    ) => {
      if (!mounted) return;

      const requestId = ++sessionRequestId;
      const accountChanged = activeUserIdRef.current !== sessionUserId;
      activeUserIdRef.current = sessionUserId;
      setUserId(sessionUserId);
      setUserEmail(sessionEmail);
      setAuthReady(true);

      if (accountChanged) {
        setSavedIds([]);
        setSavedVideos([]);
        setSaveMessage('');
        setPreferredTopics([]);
        setExcludedTopics([]);
      }

      if (!sessionUserId) {
        setSavedVideosLoading(false);
        return;
      }

      setSavedVideosLoading(true);

      try {
        const [preferencesResult, savedVideosResult] = await Promise.all([
          supabase
            .from('user_preferences')
            .select('preferred_topics, excluded_topics')
            .eq('user_id', sessionUserId)
            .maybeSingle(),
          supabase
            .from('saved_videos')
            .select('video_id, title, channel_title, thumbnail_url, video_url, created_at')
            .eq('user_id', sessionUserId)
            .order('created_at', { ascending: false }),
        ]);

        if (
          !mounted ||
          requestId !== sessionRequestId ||
          activeUserIdRef.current !== sessionUserId
        ) {
          return;
        }

        if (preferencesResult.error) {
          console.error(
            'Could not load user preferences:',
            preferencesResult.error.message
          );
          setPreferredTopics([]);
          setExcludedTopics([]);
        } else {
          setPreferredTopics(
            preferencesResult.data?.preferred_topics ?? []
          );
          setExcludedTopics(
            preferencesResult.data?.excluded_topics ?? []
          );
        }

        if (savedVideosResult.error) {
          console.error(
            'Could not load saved videos:',
            savedVideosResult.error.message
          );
          setSavedIds([]);
          setSavedVideos([]);
          setSaveMessage('Could not load your saved videos. Please refresh and try again.');
          setSavedVideosLoading(false);
          return;
        }

        const loadedSavedVideos = new Map<string, Video>();
        for (const row of savedVideosResult.data ?? []) {
          if (loadedSavedVideos.has(row.video_id)) continue;

          const savedAt = row.created_at ? new Date(row.created_at) : null;
          const age =
            savedAt && !Number.isNaN(savedAt.getTime())
              ? formatYouTubeAge(savedAt.toISOString())
              : 'Saved video';

          loadedSavedVideos.set(row.video_id, {
            id: row.video_id,
            title: row.title?.trim() || 'Untitled video',
            creator: row.channel_title?.trim() || 'Unknown creator',
            thumbnail: row.thumbnail_url || undefined,
            videoUrl:
              row.video_url ||
              `https://www.youtube.com/watch?v=${encodeURIComponent(row.video_id)}`,
            category: 'SAVED',
            views: '—',
            age,
            duration: '—',
            score: 0,
            tone: 'tech',
          });
        }

        const savedVideoList = [...loadedSavedVideos.values()];

        setSavedVideos(savedVideoList);
        setSavedIds(savedVideoList.map((video) => video.id));
        setSaveMessage('');
        setSavedVideosLoading(false);
      } catch (error) {
        if (
          !mounted ||
          requestId !== sessionRequestId ||
          activeUserIdRef.current !== sessionUserId
        ) {
          return;
        }

        console.error('Could not load saved videos:', error);
        setSavedIds([]);
        setSavedVideos([]);
        setSaveMessage('Could not load your saved videos. Please refresh and try again.');
        setSavedVideosLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Could not read session:', error.message);
        if (mounted) setAuthReady(true);
        return;
      }
      const user = data.session?.user;
      void syncSession(user?.id ?? null, user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.user.id ?? null, session?.user.email ?? null);
    });

    return () => {
      mounted = false;
      sessionRequestId += 1;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const fetchVideos = async (
    term: string,
    selectedCategory: string,
    pageToken?: string
  ) => {
    const params = new URLSearchParams({ q: term.trim() || 'videos' });

    if (selectedCategory !== 'All categories') {
      params.set('categoryId', selectedCategory);
    }

    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`/api/youtube?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Could not load YouTube videos.');
    }

    return response.json();
  };

  const performSearch = async (
    term: string,
    selectedCategory = category
  ) => {
    setYoutubeLoading(true);
    setYoutubeError('');
    setNextPageToken(null);
    setLiveVideos([]);
    setSearchFocused(false);

    const normalizedTerm = term.trim();
    setSearchTerm(normalizedTerm);

    try {
      const data = await fetchVideos(
        normalizedTerm || 'videos',
        selectedCategory
      );

      setLiveVideos(convertYouTubeVideos(data.videos ?? []));
      setYoutubeCategories(data.categories ?? []);
      setNextPageToken(data.nextPageToken ?? null);
    } catch (error) {
      console.error('YouTube search error:', error);
      setYoutubeError(
        error instanceof Error ? error.message : 'Something went wrong while searching.'
      );
    } finally {
      setYoutubeLoading(false);
    }
  };

  const loadMoreVideos = async () => {
    if (!nextPageToken || loadingMore) return;

    setLoadingMore(true);
    setYoutubeError('');

    try {
      const data = await fetchVideos(searchTerm, category, nextPageToken);
      const newVideos = convertYouTubeVideos(data.videos ?? []);

      setLiveVideos((current) => {
        const existingIds = new Set(current.map((video) => video.id));
        return [
          ...current,
          ...newVideos.filter((video) => !existingIds.has(video.id)),
        ];
      });

      setNextPageToken(data.nextPageToken ?? null);
    } catch (error) {
      console.error('Could not load more videos:', error);
      setYoutubeError(
        error instanceof Error ? error.message : 'Could not load more videos.'
      );
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void performSearch('', 'All categories');
    // Initial feed load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Unable to sign out:', error.message);
    setAccountOpen(false);
    setMobileMenuOpen(false);
  };

  const filtered = useMemo(() => {
    let list = [...(youtubeError && liveVideos.length === 0 ? videos : liveVideos)];

    list = list.filter((video) => {
      const categoryMatch =
        category === 'All categories' || video.categoryId === category;
      const seconds = durationSeconds(video.duration);
      const durationMatch =
        duration === 'Any length' ||
        (duration === 'Under 10 min' && seconds < 600) ||
        (duration === '10–20 min' && seconds >= 600 && seconds <= 1200) ||
        (duration === 'Over 20 min' && seconds > 1200);
      const days = ageDays(video.age);
      const dateMatch =
        date === 'Any time' ||
        (date === 'Today' && days === 0) ||
        (date === 'This week' && days <= 7) ||
        (date === 'This month' && days <= 30) ||
        (date === 'This year' && days <= 365);

      return categoryMatch && durationMatch && dateMatch;
    });

    if (sort === 'Best match') {
      list.sort((a, b) => {
        const getPersonalizedScore = (video: Video) => {
          const topic = video.category.trim().toLowerCase();

          const isExcluded = excludedTopics.some(
            (item) => item.trim().toLowerCase() === topic
          );

          const isPreferred = preferredTopics.some(
            (item) => item.trim().toLowerCase() === topic
          );

          if (isExcluded) return video.score - 15;
          if (isPreferred) return video.score + 15;

          return video.score;
        };

        return getPersonalizedScore(b) - getPersonalizedScore(a);
      });
    }
    if (sort === 'Newest') {
      list.sort((a, b) => ageDays(a.age) - ageDays(b.age));
    }
    if (sort === 'Most popular') {
      list.sort(
        (a, b) =>
          Number(b.views.replace(/[^\d.]/g, '')) -
          Number(a.views.replace(/[^\d.]/g, ''))
      );
    }

    return list;
  }, [
    category,
    date,
    duration,
    sort,
    preferredTopics,
    excludedTopics,
    liveVideos,
    youtubeError,
  ]);

  const allVideos = [
    ...liveVideos,
    ...videos,
    currentFeaturedVideo,
    featuredVideo,
    continueVideo,
  ].filter(
    (video, index, list) =>
      list.findIndex((item) => item.id === video.id) === index
  );

  const toggleSave = async (id: string) => {
    const actionUserId = activeUserIdRef.current;
    if (!actionUserId) {
      window.location.assign('/auth?next=/');
      return;
    }
    if (savingVideoIdRef.current) return;

    const alreadySaved = savedIds.includes(id);
    const video = allVideos.find((item) => item.id === id);
    if (!alreadySaved && !video) return;

    savingVideoIdRef.current = id;
    setSaveMessage('');

    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from('saved_videos')
          .delete()
          .eq('user_id', actionUserId)
          .eq('video_id', id);
        if (error) throw error;
        if (activeUserIdRef.current === actionUserId) {
          setSavedIds((current) => current.filter((savedId) => savedId !== id));
          setSavedVideos((current) => current.filter((item) => item.id !== id));
          setSaveMessage('Removed from your saved videos.');
        }
      } else if (video) {
        const videoUrl =
          video.videoUrl ??
          `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${video.title} ${video.creator}`
          )}`;

        const { data: existingRecords, error: lookupError } = await supabase
          .from('saved_videos')
          .select('video_id')
          .eq('user_id', actionUserId)
          .eq('video_id', id)
          .limit(1);
        if (lookupError) throw lookupError;

        if (!existingRecords?.length) {
          const { error } = await supabase.from('saved_videos').insert({
            user_id: actionUserId,
            video_id: id,
            title: video.title,
            channel_title: video.creator,
            thumbnail_url: video.thumbnail ?? null,
            video_url: videoUrl,
          });
          if (error) throw error;
        }

        if (activeUserIdRef.current === actionUserId) {
          setSavedIds((current) =>
            current.includes(id) ? current : [...current, id]
          );
          setSavedVideos((current) => [
            {
              ...video,
              videoUrl,
              category: video.category || 'SAVED',
            },
            ...current.filter((item) => item.id !== id),
          ]);
          setSaveMessage('Saved to your account. It will be here when you return.');
        }
      }
    } catch (error) {
      console.error('Could not update saved video:', error);
      if (activeUserIdRef.current === actionUserId) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : 'Could not update your saved videos. Please try again.'
        );
      }
    } finally {
      if (savingVideoIdRef.current === id) {
        savingVideoIdRef.current = null;
      }
    }
  };
  const clearFilters = () => {
    setCategory('All categories');
    setDuration('Any length');
    setDate('Any time');
    setSort('Best match');
    setQuery('');
    void performSearch('');
  };
  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setMobileMenuOpen(false); setAccountOpen(false); };

  return <main id="top">
    <nav className="topbar" aria-label="Main navigation">
      <a className="wordmark" href="#top">Discoverly</a>
      <form
        ref={searchFormRef}
        className="nav-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void performSearch(query);
          scrollTo('trending');
        }}
      >
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onClick={() => setSearchFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSearchFocused(false);
          }}
          placeholder="Search videos, topics, or creators"
          aria-label="Search videos, topics, or creators"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={searchFocused && searchSuggestions.length > 0}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
        />
        <button className="search-submit" type="submit" aria-label="Search">
          ↵
        </button>
        {searchFocused && searchSuggestions.length > 0 && (
          <div
            className="search-suggestions"
            id="search-suggestions"
            role="listbox"
            aria-label={query.trim() ? 'Search suggestions' : 'Popular searches'}
          >
            <p className="search-suggestions-label">
              {query.trim() ? 'Suggestions' : 'Popular searches'}
            </p>
            {searchSuggestions.map((suggestion) => (
              <button
                className="search-suggestion"
                key={suggestion}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => {
                  setQuery(suggestion);
                  void performSearch(suggestion);
                  scrollTo('trending');
                }}
              >
                <span aria-hidden="true">⌕</span>
                <strong>{suggestion}</strong>
              </button>
            ))}
          </div>
        )}
      </form>
      <div className="nav-links"><a href="#top">Home</a><a href="#trending">Trending</a><a href="#interests">Categories</a><a href="#watch-later">Watch Later{savedIds.length > 0 ? ` (${savedIds.length})` : ''}</a>{!userEmail && <><a className="nav-auth-link" href="/auth">Log in</a><a className="nav-auth-button" href="/auth?mode=signup">Sign up</a></>}{userEmail && <div className="account-wrap"><button className="avatar" aria-label="Open account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(v => !v)}>{userEmail.slice(0, 1).toUpperCase()}</button>{accountOpen && <div className="account-menu"><strong>Your account</strong><span>{userEmail}</span><button onClick={() => {
  setAccountOpen(false);
  window.location.assign('/preferences');
}}>
  Edit preferences
</button><button onClick={() => { setAccountOpen(false); scrollTo('watch-later'); }}>Saved videos ({savedIds.length})</button><button onClick={() => { clearFilters(); setAccountOpen(false); scrollTo('trending'); }}>Reset filters</button><button onClick={handleLogout}>Log out</button></div>}</div>}{!authReady && <span className="auth-loading" aria-label="Checking account">…</span>}</div>
      <button className="mobile-menu-toggle" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}>{mobileMenuOpen ? '×' : '☰'}</button>
      {mobileMenuOpen && (
  <div className="mobile-menu">
    <button onClick={() => scrollTo("top")}>Home</button>
    <button onClick={() => scrollTo("trending")}>Trending</button>
    <button onClick={() => scrollTo("interests")}>Categories</button>
    <button onClick={() => scrollTo("watch-later")}>
      Watch Later ({savedIds.length})
    </button>

    <button
      onClick={() => {
        clearFilters();
        setMobileMenuOpen(false);
        scrollTo("interests");
      }}
    >
      Reset filters
    </button>

    {userEmail ? (
      <details className="mobile-account-dropdown">
        <summary className="mobile-account-email">
          <span>Signed in as {userEmail}</span>
          <span className="mobile-account-chevron">⌄</span>
        </summary>

        <div className="mobile-account-actions">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              window.location.assign("/preferences");
            }}
          >
            Edit Preferences
          </button>

          <button onClick={handleLogout}>Log out</button>
        </div>
      </details>
    ) : (
      <>
        <a className="mobile-auth-link" href="/auth">
          Log in
        </a>
        <a className="mobile-auth-button" href="/auth?mode=signup">
          Create account
        </a>
      </>
    )}
  </div>
)}
    </nav>
    <div className="page-wrap">
      <section className="hero"><div className="hero-copy"><div className="hero-kicker"><i/> CURATED FOR YOUR CURIOSITY</div><h1>Find your next favorite<br className="desktop-break"/> video</h1><p>Discover thoughtful stories, fresh ideas, and the videos worth making time for.</p><button className="compass" aria-label="Explore videos" title="Explore videos" onClick={() => scrollTo('trending')}>⊙</button></div><div className="hero-orb" aria-hidden="true"><div className="orb-core"/></div></section>
      <section className="interests" id="interests"><div className="section-kicker"><i/> BROWSE BY INTEREST</div><div className="section-head"><h2>Explore videos by category</h2><button className="clear" onClick={clearFilters}>Clear filters</button></div><div className="filter-panel"><label>
  CATEGORY
  <select
  value={category}
  onChange={async (e) => {
    const selectedCategory = e.target.value;

    setCategory(selectedCategory);
    setYoutubeLoading(true);
    setYoutubeError('');
    setNextPageToken(null);
    setLiveVideos([]);

    try {
      const data = await fetchVideos(searchTerm, selectedCategory);

      setLiveVideos(convertYouTubeVideos(data.videos ?? []));
      setYoutubeCategories(data.categories ?? []);
      setNextPageToken(data.nextPageToken ?? null);
    } catch (error) {
      setYoutubeError(
        error instanceof Error ? error.message : 'Could not load this category.'
      );
    } finally {
      setYoutubeLoading(false);
    }
  }}
>
    <option value="All categories">All categories</option>
    {youtubeCategories.map(item => (
      <option key={item.id} value={item.id}>
        {item.name}
      </option>
    ))}
  </select>
</label><label>DURATION<select value={duration} onChange={e=>setDuration(e.target.value)}>{['Any length','Under 10 min','10–20 min','Over 20 min'].map(v=><option key={v}>{v}</option>)}</select></label><label>UPLOAD DATE<select value={date} onChange={e=>setDate(e.target.value)}>{['Any time','Today','This week','This month','This year'].map(v=><option key={v}>{v}</option>)}</select></label><label>SORT BY<select value={sort} onChange={e=>setSort(e.target.value)}>{['Most popular','Best match','Newest'].map(v=><option key={v}>{v}</option>)}</select></label></div></section>
      {searchTerm === '' && <section className="featured">
        <div className="section-kicker"><i/> EDITOR&apos;S PICK</div>
        <h2>Featured this week</h2>

        <article className="featured-card">
          <div
            className="featured-thumb"
            style={
              currentFeaturedVideo.thumbnail
                ? {
                    backgroundImage: `url("${currentFeaturedVideo.thumbnail}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {currentFeaturedVideo.score > 0 && (
              <Score value={currentFeaturedVideo.score} />
            )}

            <button
              className="play-button"
              aria-label="Open featured video"
              onClick={() => setSelectedVideo(currentFeaturedVideo)}
            >
              ▶
            </button>

            <span className="duration">
              {currentFeaturedVideo.duration}
            </span>
          </div>

          <div className="featured-info">
            <div className="category-label">
              {currentFeaturedVideo.category}
            </div>

            <h3>{currentFeaturedVideo.title}</h3>

            <p>
              Discover something interesting and worth your time.
            </p>

            <div className="featured-by">
              <div>
                <b>{currentFeaturedVideo.creator}</b>
                <small>
                  {currentFeaturedVideo.views} · {currentFeaturedVideo.age}
                </small>
              </div>

              <button
                className={`save-button ${
                  savedIds.includes(currentFeaturedVideo.id) ? 'saved' : ''
                }`}
                aria-label={
                  savedIds.includes(currentFeaturedVideo.id)
                    ? 'Remove featured video from Watch Later'
                    : 'Save featured video to Watch Later'
                }
                title="Save to Watch Later"
                onClick={() => toggleSave(currentFeaturedVideo.id)}
              >
                {savedIds.includes(currentFeaturedVideo.id) ? '✓' : '♧'}
              </button>
            </div>
          </div>
        </article>
      </section>}
      <section className="trending" id="trending"><div className="section-kicker"><i/> POPULAR RIGHT NOW</div><div className="section-head results-head"><h2>Trending now</h2><span className="result-count">{filtered.length} {filtered.length === 1 ? 'video' : 'videos'}</span></div>{youtubeLoading && liveVideos.length === 0 && <p role="status" className="preview-note">Loading videos from YouTube…</p>}{youtubeError && <p role="alert" className="preview-note">{youtubeError}{liveVideos.length === 0 ? ' Showing sample videos instead.' : ''}</p>}<div className="video-grid">{filtered.map(v=><VideoCard key={v.id} video={v} saved={savedIds.includes(v.id)} onToggleSave={toggleSave} onPreview={setSelectedVideo}/>)}</div>{nextPageToken && <div className="load-more-wrap"><button className="secondary-button" onClick={loadMoreVideos} disabled={loadingMore}>{loadingMore ? 'Loading videos…' : 'Show more videos'}</button></div>}{filtered.length===0 && !youtubeLoading && <div className="empty"><p>No videos match those filters. Try another search or category.</p><button className="clear" onClick={clearFilters}>Clear filters and try again</button></div>}<p className="preview-note">
        Discover real videos from YouTube. Personalized relevance scoring is still being improved.</p></section>
      <section className="continue" id="watch-later">
        <div className="section-kicker"><i /> YOUR COLLECTION</div>
        <div className="section-head">
          <h2>Watch Later</h2>
          <span className="result-count">{savedVideos.length} saved</span>
        </div>
        {saveMessage && (
          <p role="status" aria-live="polite" className="preview-note">
            {saveMessage}
          </p>
        )}
        {!userId && authReady && (
          <p className="preview-note">
            Log in to save videos to your personal account.
          </p>
        )}
        {savedVideosLoading ? (
          <p role="status" className="preview-note">
            Loading your saved videos…
          </p>
        ) : savedVideos.length ? (
          <div className="video-grid saved-grid">
            {savedVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                saved
                onToggleSave={toggleSave}
                onPreview={setSelectedVideo}
              />
            ))}
          </div>
        ) : (
          <div className="saved-empty">
            <span className="saved-empty-icon">♧</span>
            <div>
              <h3>Your list starts here</h3>
              <p>
                {userId
                  ? 'Use the bookmark icon on any video to keep it here for later.'
                  : 'Log in, then use the bookmark icon to save videos to your account.'}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() =>
                userId
                  ? scrollTo('trending')
                  : window.location.assign('/auth')
              }
            >
              {userId ? 'Explore videos' : 'Log in to save videos'}
            </button>
          </div>
        )}
      </section>
      <section className="continue" id="continue-watching">
  <div className="section-kicker">
    <i /> PICK UP WHERE YOU LEFT OFF
  </div>

  <h2>Continue watching</h2>

  {nextVideoToExplore ? (
    <article className="continue-card">
      <div
        className="continue-art"
        style={
          nextVideoToExplore.thumbnail
            ? {
                backgroundImage: `url("${nextVideoToExplore.thumbnail}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />

      <div className="continue-info">
        <div className="category-label">
          {nextVideoToExplore.category}
        </div>

        <h3>{nextVideoToExplore.title}</h3>

        <p>
          {nextVideoToExplore.creator} · {nextVideoToExplore.duration}
        </p>

        <button
          className="text-action"
          onClick={() => setSelectedVideo(nextVideoToExplore)}
        >
          Explore video ↗
        </button>
      </div>
    </article>
  ) : (
    <p className="preview-note">
      Your watch history will appear here when playback tracking is available.
    </p>
  )}
</section>
      <footer><b>Discoverly</b><span>Find videos worth your time.</span><a href="#top">Back to top ↑</a></footer>
    </div>
    {selectedVideo && (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) setSelectedVideo(null);
      }}
    >
      <section
        className="video-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          className="modal-close"
          aria-label="Close video details"
          onClick={() => setSelectedVideo(null)}
        >
          ×
        </button>

        <div
          className={`modal-art ${selectedVideo.tone}`}
          style={
            selectedVideo.thumbnail
              ? {
                  backgroundImage: `url("${selectedVideo.thumbnail}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {selectedVideo.score > 0 && (
            <Score value={selectedVideo.score} />
          )}
          <span className="modal-play">▶</span>
        </div>

        <div className="modal-content">
          <div className="category-label">
            {selectedVideo.category}
          </div>

          <h2 id="modal-title">{selectedVideo.title}</h2>

          <p>
            {selectedVideo.creator} · {selectedVideo.views} · {selectedVideo.age}
          </p>

          <p className="modal-note">
            Watch this video directly on YouTube.
          </p>

          <div className="modal-actions">
            <a
              className="primary-button"
              href={
                selectedVideo.videoUrl ??
                `https://www.youtube.com/results?search_query=${encodeURIComponent(
                  selectedVideo.title + ' ' + selectedVideo.creator
                )}`
              }
              target="_blank"
              rel="noreferrer"
            >
              Watch on YouTube ↗
            </a>

            <button
              className="secondary-button"
              onClick={() => toggleSave(selectedVideo.id)}
            >
              {savedIds.includes(selectedVideo.id)
                ? '✓ Saved · Remove'
                : '♧ Save for later'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )}
  </main>;
}
