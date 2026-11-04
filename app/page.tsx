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
const discoveryQueries = [
  'science explained',
  'technology documentary',
  'wildlife documentary',
  'history documentary',
  'business explained',
  'creative process',
  'artificial intelligence explained',
  'interesting engineering projects',
];
const discoveryRotationStorageKey = 'discoverly:discovery-query-index';
const recentVideoHistoryStorageKey = 'discoverly:recent-videos';
const recentVideoHistoryLimit = 100;
const recentVideoHistoryMaxAge = 14 * 24 * 60 * 60 * 1000;
const discoveryPageSize = 9;
const trendingPageSize = 9;

type RecentVideoEntry = { id: string; seenAt: number };

const preferenceYouTubeCategoryIds: Record<string, string> = {
  technology: '28',
  'artificial intelligence': '28',
  science: '28',
  education: '27',
  gaming: '20',
  music: '10',
  sports: '17',
  'movies & tv': '24',
  'news & politics': '25',
  travel: '19',
  'food & cooking': '26',
  comedy: '23',
  'health & fitness': '26',
  'art & design': '26',
  'history & culture': '27',
  'personal development': '27',
};

function getNextDiscoveryQuery(preferredTopics: string[]) {
  const queryOptions = preferredTopics.length > 0 ? preferredTopics : discoveryQueries;
  let index = 0;

  try {
    const storedIndex = window.localStorage.getItem(discoveryRotationStorageKey);
    if (storedIndex !== null) {
      const parsedIndex = Number(storedIndex);
      if (
        Number.isInteger(parsedIndex) &&
        parsedIndex >= 0 &&
        parsedIndex < queryOptions.length
      ) {
        index = parsedIndex;
      }
    }
  } catch (error) {
    console.warn('Could not read the discovery query rotation:', error);
  }

  try {
    window.localStorage.setItem(
      discoveryRotationStorageKey,
      String((index + 1) % queryOptions.length)
    );
  } catch (error) {
    console.warn('Could not save the discovery query rotation:', error);
  }

  return queryOptions[index];
}

function getPreferredTrendingCategory(preferredTopics: string[]) {
  for (const topic of preferredTopics) {
    const categoryId = preferenceYouTubeCategoryIds[topic.trim().toLowerCase()];
    if (categoryId) return categoryId;
  }

  return 'All categories';
}

function readRecentVideoHistory(userId: string): RecentVideoEntry[] {
  try {
    const storedHistory = window.localStorage.getItem(
      `${recentVideoHistoryStorageKey}:${userId}`
    );
    if (!storedHistory) return [];

    const parsedHistory: unknown = JSON.parse(storedHistory);
    if (!Array.isArray(parsedHistory)) {
      throw new Error('Stored recent-video history is not an array.');
    }

    const cutoff = Date.now() - recentVideoHistoryMaxAge;
    return parsedHistory
      .filter(
        (entry): entry is RecentVideoEntry =>
          typeof entry?.id === 'string' &&
          typeof entry?.seenAt === 'number' &&
          Number.isFinite(entry.seenAt) &&
          entry.seenAt >= cutoff
      )
      .sort((a, b) => b.seenAt - a.seenAt)
      .slice(0, recentVideoHistoryLimit);
  } catch (error) {
    console.warn('Could not read recent-video history:', error);
    return [];
  }
}

function filterPreviouslyDisplayedVideos(
  items: Video[],
  userId: string | null,
  existingIds = new Set<string>()
) {
  const recentIds = new Set(
    userId ? readRecentVideoHistory(userId).map((entry) => entry.id) : []
  );
  const uniqueIds = new Set(existingIds);

  return items.filter((video) => {
    if (recentIds.has(video.id) || uniqueIds.has(video.id)) return false;
    uniqueIds.add(video.id);
    return true;
  });
}

function recordDisplayedVideos(userId: string, displayedVideos: Video[]) {
  if (displayedVideos.length === 0) return;

  try {
    const history = new Map(
      readRecentVideoHistory(userId).map((entry) => [entry.id, entry.seenAt])
    );
    const seenAt = Date.now();

    for (const video of displayedVideos) {
      history.set(video.id, seenAt);
    }

    window.localStorage.setItem(
      `${recentVideoHistoryStorageKey}:${userId}`,
      JSON.stringify(
        [...history]
          .map(([id, timestamp]) => ({ id, seenAt: timestamp }))
          .sort((a, b) => b.seenAt - a.seenAt)
          .slice(0, recentVideoHistoryLimit)
      )
    );
  } catch (error) {
    console.warn('Could not save recent-video history:', error);
  }
}

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

type TrendingResponse = {
  videos: YouTubeVideo[];
  categories: YouTubeCategory[];
  nextPageToken: string | null;
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

type VideoFilters = {
  category: string;
  duration: string;
  date: string;
  sort: string;
  preferredTopics: string[];
  excludedTopics: string[];
  preservePopularityOrder?: boolean;
};

function filterAndSortVideos(videos: Video[], filters: VideoFilters) {
  const { category, duration, date, sort, preferredTopics, excludedTopics } = filters;
  const list = videos.filter((video) => {
    const categoryMatch =
      category === 'All categories' || video.categoryId === category;
    const seconds = durationSeconds(video.duration);
    const durationMatch =
      duration === 'Any length' ||
      (duration === 'Under 10 min' && seconds < 600) ||
      (duration === '10–20 min' && seconds >= 600 && seconds <= 1200) ||
      (duration === 'Over 20 min' && seconds > 1200);
    const publishedAt = video.publishedAt ? Date.parse(video.publishedAt) : NaN;
    const days = Number.isFinite(publishedAt)
      ? Math.max(0, Math.floor((Date.now() - publishedAt) / 86400000))
      : ageDays(video.age);
    const dateMatch =
      date === 'Any time' ||
      (date === 'Today' && days === 0) ||
      (date === 'This week' && days <= 7) ||
      (date === 'This month' && days <= 30) ||
      (date === 'This year' && days <= 365);

    return categoryMatch && durationMatch && dateMatch;
  });

  if (sort === 'Newest') {
    list.sort((a, b) => {
      const aDate = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bDate = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bDate - aDate;
    });
  } else if (sort === 'Most popular' && !filters.preservePopularityOrder) {
    const parseViews = (value: string) => {
      const match = value.match(/([\d,.]+)\s*([KMB])?/i);
      if (!match) return 0;
      const multipliers: Record<string, number> = {
        K: 1e3,
        M: 1e6,
        B: 1e9,
      };
      const multiplier = multipliers[(match[2] ?? '').toUpperCase()] ?? 1;
      return Number(match[1].replace(/,/g, '')) * multiplier;
    };
    list.sort((a, b) => parseViews(b.views) - parseViews(a.views));
  } else if (sort === 'Best match') {
    const score = (video: Video) => {
      const topic = video.category.trim().toLowerCase();
      if (excludedTopics.some((item) => item.trim().toLowerCase() === topic)) {
        return video.score - 15;
      }
      if (preferredTopics.some((item) => item.trim().toLowerCase() === topic)) {
        return video.score + 15;
      }
      return video.score;
    };
    list.sort((a, b) => score(b) - score(a));
  }

  return list;
}

const durationOptions = ['Any length', 'Under 10 min', '10–20 min', 'Over 20 min'];
const dateOptions = ['Any time', 'Today', 'This week', 'This month', 'This year'];
const sortOptions = ['Most popular', 'Best match', 'Newest'];

function FeedFilterControls({
  id,
  categories,
  category,
  duration,
  date,
  sort,
  onCategoryChange,
  onDurationChange,
  onDateChange,
  onSortChange,
}: {
  id: string;
  categories: YouTubeCategory[];
  category: string;
  duration: string;
  date: string;
  sort: string;
  onCategoryChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSortChange: (value: string) => void;
}) {
  return (
    <div className="filter-panel feed-filter-panel" id={id}>
      <label>
        CATEGORY
        <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="All categories">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      <label>
        DURATION
        <select value={duration} onChange={(event) => onDurationChange(event.target.value)}>
          {durationOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        UPLOAD DATE
        <select value={date} onChange={(event) => onDateChange(event.target.value)}>
          {dateOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        SORT BY
        <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
          {sortOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    </div>
  );
}

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
  const [preferencesReady, setPreferencesReady] = useState(false);
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
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [trendingCategory, setTrendingCategory] = useState('All categories');
  const [trendingDuration, setTrendingDuration] = useState('Any length');
  const [trendingDate, setTrendingDate] = useState('Any time');
  const [trendingSort, setTrendingSort] = useState('Most popular');
  const [trendingCategories, setTrendingCategories] = useState<YouTubeCategory[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingLoadingMore, setTrendingLoadingMore] = useState(false);
  const [trendingError, setTrendingError] = useState('');
  const [trendingNextPageToken, setTrendingNextPageToken] = useState<string | null>(null);
  const [activeDiscoveryQuery, setActiveDiscoveryQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const videoRequestGenerationRef = useRef(0);
  const loadingMoreLockRef = useRef(false);
  const initialDiscoveryStartedRef = useRef(false);
  const activeDiscoveryQueryRef = useRef('');
  const trendingRequestGenerationRef = useRef(0);
  const trendingLoadingMoreLockRef = useRef(false);
  const trendingInitialLoadStartedRef = useRef(false);
  const trendingCategoryRef = useRef('All categories');
  const [searchTerm, setSearchTerm] = useState('');
  const [youtubeCategories, setYoutubeCategories] = useState<YouTubeCategory[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchFormRef = useRef<HTMLFormElement>(null);

  const storeActiveDiscoveryQuery = (discoveryQuery: string) => {
    activeDiscoveryQueryRef.current = discoveryQuery;
    setActiveDiscoveryQuery(discoveryQuery);
  };

  const getActiveDiscoveryQuery = () => {
    if (activeDiscoveryQueryRef.current) {
      return activeDiscoveryQueryRef.current;
    }

    const discoveryQuery = getNextDiscoveryQuery(preferredTopics);
    storeActiveDiscoveryQuery(discoveryQuery);
    return discoveryQuery;
  };

  const rotateActiveDiscoveryQuery = () => {
    const discoveryQuery = getNextDiscoveryQuery(preferredTopics);
    storeActiveDiscoveryQuery(discoveryQuery);
    return discoveryQuery;
  };

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
        videoRequestGenerationRef.current += 1;
        loadingMoreLockRef.current = false;
        trendingRequestGenerationRef.current += 1;
        trendingLoadingMoreLockRef.current = false;
        initialDiscoveryStartedRef.current = false;
        trendingInitialLoadStartedRef.current = false;
        activeDiscoveryQueryRef.current = '';
        trendingCategoryRef.current = 'All categories';
        setActiveDiscoveryQuery('');
        setTrendingCategory('All categories');
        setTrendingDuration('Any length');
        setTrendingDate('Any time');
        setTrendingSort('Most popular');
        setPreferencesReady(false);
        setSavedIds([]);
        setSavedVideos([]);
        setSaveMessage('');
        setLiveVideos([]);
        setTrendingVideos([]);
        setNextPageToken(null);
        setTrendingNextPageToken(null);
        setYoutubeLoading(false);
        setTrendingLoading(false);
        setLoadingMore(false);
        setTrendingLoadingMore(false);
        setYoutubeError('');
        setTrendingError('');
        setPreferredTopics([]);
        setExcludedTopics([]);
      }

      if (!sessionUserId) {
        setPreferencesReady(true);
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
        setPreferencesReady(true);

        if (savedVideosResult.error) {
          console.error(
            'Could not load saved videos:',
            savedVideosResult.error.message
          );
          setSaveMessage('Could not load your saved videos. Please refresh and try again.');
          setSavedVideosLoading(false);
          return;
        }

        const loadedSavedVideos = new Map<string, Video>();
        for (const row of savedVideosResult.data ?? []) {
          if (loadedSavedVideos.has(row.video_id)) continue;

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
            age: 'Publication date unavailable',
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
        setPreferencesReady(true);
        setSaveMessage('Could not load your saved videos. Please refresh and try again.');
        setSavedVideosLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Could not read session:', error.message);
        if (mounted) {
          setAuthReady(true);
          setPreferencesReady(true);
        }
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
    pageToken?: string,
    order: 'relevance' | 'date' = 'relevance',
    maxResults = 30
  ) => {
    const params = new URLSearchParams({
      q: term.trim(),
      order,
      maxResults: String(maxResults),
    });

    if (selectedCategory !== 'All categories') {
      params.set('categoryId', selectedCategory);
    }

    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`/api/youtube?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Could not load YouTube videos.');
    }

    return response.json();
  };

  const fetchTrendingVideos = async (
    selectedCategory: string,
    pageToken?: string
  ): Promise<TrendingResponse> => {
    const params = new URLSearchParams({
      mode: 'trending',
      maxResults: String(trendingPageSize),
    });

    if (selectedCategory !== 'All categories') {
      params.set('categoryId', selectedCategory);
    }

    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`/api/youtube?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Could not load YouTube Trending videos.'
      );
    }

    return {
      videos: data.videos ?? [],
      categories: data.categories ?? [],
      nextPageToken: data.nextPageToken ?? null,
    };
  };

  const requestTrendingVideos = async (
    selectedCategory: string,
    pageToken?: string,
    replaceResults = false
  ) => {
    const isLoadingMore = Boolean(pageToken) && !replaceResults;
    if (isLoadingMore && trendingLoadingMoreLockRef.current) return;

    if (isLoadingMore) {
      trendingLoadingMoreLockRef.current = true;
      setTrendingLoadingMore(true);
    } else {
      trendingRequestGenerationRef.current += 1;
      trendingLoadingMoreLockRef.current = false;
      setTrendingLoadingMore(false);
      setTrendingLoading(true);
      setTrendingVideos([]);
      setTrendingNextPageToken(null);
    }

    const requestGeneration = trendingRequestGenerationRef.current;
    setTrendingError('');

    try {
      const data = await fetchTrendingVideos(selectedCategory, pageToken);

      if (requestGeneration !== trendingRequestGenerationRef.current) return;

      const videos = convertYouTubeVideos(data.videos);
      if (isLoadingMore) {
        setTrendingVideos((current) => {
          const existingIds = new Set(current.map((video) => video.id));
          const newVideos = videos.filter((video) => {
            if (existingIds.has(video.id)) return false;
            existingIds.add(video.id);
            return true;
          });
          return [...current, ...newVideos];
        });
      } else {
        setTrendingVideos(videos);
      }

      setTrendingCategories(data.categories);
      setTrendingNextPageToken(data.nextPageToken);
    } catch (error) {
      if (requestGeneration === trendingRequestGenerationRef.current) {
        console.error('YouTube Trending error:', error);
        setTrendingError(
          error instanceof Error
            ? error.message
            : 'Could not load YouTube Trending videos.'
        );
      }
    } finally {
      if (requestGeneration === trendingRequestGenerationRef.current) {
        if (isLoadingMore) {
          trendingLoadingMoreLockRef.current = false;
          setTrendingLoadingMore(false);
        } else {
          setTrendingLoading(false);
        }
      }
    }
  };

  const refreshTrending = () => {
    if (trendingNextPageToken) {
      void requestTrendingVideos(
        trendingCategoryRef.current,
        trendingNextPageToken,
        true
      );
      return;
    }

    void requestTrendingVideos(trendingCategoryRef.current);
  };

  const loadMoreTrendingVideos = () => {
    if (!trendingNextPageToken || trendingLoadingMoreLockRef.current) return;
    void requestTrendingVideos(
      trendingCategoryRef.current,
      trendingNextPageToken
    );
  };

  const changeDiscoveryCategory = async (selectedCategory: string) => {
    const requestQuery = searchTerm || getActiveDiscoveryQuery();
    const requestGeneration = invalidateVideoRequests();
    initialDiscoveryStartedRef.current = true;
    setCategory(selectedCategory);
    setYoutubeLoading(true);
    setYoutubeError('');
    setNextPageToken(null);
    setLiveVideos([]);

    try {
      const data = await fetchVideos(
        requestQuery,
        selectedCategory,
        undefined,
        'relevance',
        searchTerm ? 30 : discoveryPageSize
      );

      if (requestGeneration !== videoRequestGenerationRef.current) return;

      setLiveVideos(
        filterPreviouslyDisplayedVideos(
          convertYouTubeVideos(data.videos ?? []),
          searchTerm ? null : activeUserIdRef.current
        )
      );
      setYoutubeCategories(data.categories ?? []);
      setNextPageToken(data.nextPageToken ?? null);
    } catch (error) {
      if (requestGeneration === videoRequestGenerationRef.current) {
        setYoutubeError(
          error instanceof Error ? error.message : 'Could not load this category.'
        );
      }
    } finally {
      if (requestGeneration === videoRequestGenerationRef.current) {
        setYoutubeLoading(false);
      }
    }
  };

  const invalidateVideoRequests = () => {
    const generation = ++videoRequestGenerationRef.current;
    loadingMoreLockRef.current = false;
    setLoadingMore(false);
    return generation;
  };

  const performSearch = async (
    term: string,
    selectedCategory: string,
    discoveryQuery: string,
    pageToken?: string
  ) => {
    initialDiscoveryStartedRef.current = true;
    const requestGeneration = invalidateVideoRequests();
    setYoutubeLoading(true);
    setYoutubeError('');
    setNextPageToken(null);
    setLiveVideos([]);
    setSearchFocused(false);

    const normalizedTerm = term.trim();
    setSearchTerm(normalizedTerm);
    const requestQuery = normalizedTerm || discoveryQuery;
    const order = 'relevance';

    try {
      const data = await fetchVideos(
        requestQuery,
        selectedCategory,
        pageToken,
        order,
        normalizedTerm ? 30 : discoveryPageSize
      );

      if (requestGeneration !== videoRequestGenerationRef.current) return;

      setLiveVideos(
        filterPreviouslyDisplayedVideos(
          convertYouTubeVideos(data.videos ?? []),
          normalizedTerm ? null : activeUserIdRef.current
        )
      );
      setYoutubeCategories(data.categories ?? []);
      setNextPageToken(data.nextPageToken ?? null);
    } catch (error) {
      if (requestGeneration === videoRequestGenerationRef.current) {
        console.error('YouTube search error:', error);
        setYoutubeError(
          error instanceof Error ? error.message : 'Something went wrong while searching.'
        );
      }
    } finally {
      if (requestGeneration === videoRequestGenerationRef.current) {
        setYoutubeLoading(false);
      }
    }
  };

  const loadMoreVideos = async () => {
    if (!nextPageToken || loadingMoreLockRef.current) return;

    loadingMoreLockRef.current = true;
    const requestGeneration = videoRequestGenerationRef.current;
    const requestPageToken = nextPageToken;
    setLoadingMore(true);
    setYoutubeError('');

    try {
      const order = 'relevance';
      const data = await fetchVideos(
        searchTerm || activeDiscoveryQueryRef.current,
        category,
        requestPageToken,
        order,
        searchTerm ? 30 : discoveryPageSize
      );

      if (requestGeneration !== videoRequestGenerationRef.current) return;

      const newVideos = filterPreviouslyDisplayedVideos(
        convertYouTubeVideos(data.videos ?? []),
        searchTerm ? null : activeUserIdRef.current,
        new Set(liveVideos.map((video) => video.id))
      );

      setLiveVideos((current) => {
        const existingIds = new Set(current.map((video) => video.id));
        const videosToAppend = newVideos.filter((video) => {
          if (existingIds.has(video.id)) return false;
          existingIds.add(video.id);
          return true;
        });

        return [...current, ...videosToAppend];
      });

      setNextPageToken(data.nextPageToken ?? null);
    } catch (error) {
      if (requestGeneration === videoRequestGenerationRef.current) {
        console.error('Could not load more videos:', error);
        setYoutubeError(
          error instanceof Error ? error.message : 'Could not load more videos.'
        );
      }
    } finally {
      if (requestGeneration === videoRequestGenerationRef.current) {
        loadingMoreLockRef.current = false;
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!authReady || !preferencesReady || initialDiscoveryStartedRef.current) return;

    initialDiscoveryStartedRef.current = true;
    const discoveryQuery = getNextDiscoveryQuery(preferredTopics);
    storeActiveDiscoveryQuery(discoveryQuery);
    void performSearch('', 'All categories', discoveryQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, preferencesReady, userId]);

  useEffect(() => {
    if (!authReady || !preferencesReady || trendingInitialLoadStartedRef.current) return;

    trendingInitialLoadStartedRef.current = true;
    const preferredCategory = getPreferredTrendingCategory(preferredTopics);
    trendingCategoryRef.current = preferredCategory;
    setTrendingCategory(preferredCategory);
    void requestTrendingVideos(preferredCategory);
    // Initial Trending load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, preferencesReady, userId]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Unable to sign out:', error.message);
    setAccountOpen(false);
    setMobileMenuOpen(false);
  };

  const filtered = useMemo(
    () => filterAndSortVideos(liveVideos, {
      category,
      duration,
      date,
      sort,
      preferredTopics,
      excludedTopics,
    }),
    [category, date, duration, excludedTopics, liveVideos, preferredTopics, sort]
  );
  const filteredTrending = useMemo(
    () => filterAndSortVideos(trendingVideos, {
      category: trendingCategory,
      duration: trendingDuration,
      date: trendingDate,
      sort: trendingSort,
      preferredTopics,
      excludedTopics,
      preservePopularityOrder: true,
    }),
    [
      excludedTopics,
      preferredTopics,
      trendingCategory,
      trendingDate,
      trendingDuration,
      trendingSort,
      trendingVideos,
    ]
  );

  useEffect(() => {
    if (!userId) return;

    recordDisplayedVideos(userId, filtered);
  }, [filtered, userId]);

  const allVideos = [...liveVideos, ...trendingVideos].filter(
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
              age: video.publishedAt
                ? formatYouTubeAge(video.publishedAt)
                : 'Publication date unavailable',
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
    void performSearch('', 'All categories', getActiveDiscoveryQuery());
  };
  const clearTrendingFilters = () => {
    trendingCategoryRef.current = 'All categories';
    setTrendingCategory('All categories');
    setTrendingDuration('Any length');
    setTrendingDate('Any time');
    setTrendingSort('Most popular');
    void requestTrendingVideos('All categories');
  };
  const refreshFeed = () => {
    if (nextPageToken) {
      void performSearch(
        searchTerm,
        category,
        activeDiscoveryQueryRef.current,
        nextPageToken
      );
      return;
    }

    if (searchTerm) {
      void performSearch(searchTerm, category, activeDiscoveryQuery);
      return;
    }

    const discoveryQuery = rotateActiveDiscoveryQuery();
    void performSearch('', category, discoveryQuery);
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
          void performSearch(
            query,
            category,
            query.trim() ? activeDiscoveryQuery : getActiveDiscoveryQuery()
          );
          scrollTo('discover-feed');
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
                  void performSearch(suggestion, category, activeDiscoveryQuery);
                  scrollTo('discover-feed');
                }}
              >
                <span aria-hidden="true">⌕</span>
                <strong>{suggestion}</strong>
              </button>
            ))}
          </div>
        )}
      </form>
      <div className="nav-links"><a href="#top">Home</a><a href="#trending">Trending</a><a href="#discover-feed">Discover</a><a href="#interests">Categories</a><a href="#watch-later">Watch Later{savedIds.length > 0 ? ` (${savedIds.length})` : ''}</a>{!userEmail && <><a className="nav-auth-link" href="/auth">Log in</a><a className="nav-auth-button" href="/auth?mode=signup">Sign up</a></>}{userEmail && <div className="account-wrap"><button className="avatar" aria-label="Open account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(v => !v)}>{userEmail.slice(0, 1).toUpperCase()}</button>{accountOpen && <div className="account-menu"><strong>Your account</strong><span>{userEmail}</span><button onClick={() => {
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
    <button onClick={() => scrollTo("discover-feed")}>Discover</button>
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
      <section className="trending" id="trending">
        <div className="section-kicker"><i /> POPULAR ON YOUTUBE IN NIGERIA</div>
        <div className="section-head results-head">
          <h2>Trending now</h2>
          <span className="result-count">
            {filteredTrending.length} {filteredTrending.length === 1 ? 'video' : 'videos'}
          </span>
          <button
            className="clear"
            onClick={refreshTrending}
            disabled={trendingLoading}
          >
            Refresh Trending
          </button>
          <button className="clear" onClick={clearTrendingFilters}>
            Clear filters
          </button>
        </div>
        <FeedFilterControls
          id="trending-filters"
          categories={trendingCategories}
          category={trendingCategory}
          duration={trendingDuration}
          date={trendingDate}
          sort={trendingSort}
          onCategoryChange={(selectedCategory) => {
            trendingCategoryRef.current = selectedCategory;
            setTrendingCategory(selectedCategory);
            void requestTrendingVideos(selectedCategory);
          }}
          onDurationChange={setTrendingDuration}
          onDateChange={setTrendingDate}
          onSortChange={setTrendingSort}
        />
        <p className="preview-note">
          Filters apply to loaded Trending videos. “Most popular” keeps YouTube’s chart order.
        </p>
        {trendingLoading && trendingVideos.length === 0 && (
          <p role="status" className="preview-note">
            Loading popular YouTube videos for Nigeria…
          </p>
        )}
        {trendingError && (
          <p role="alert" className="preview-note">
            {trendingError}{' '}
            <button className="clear" onClick={refreshTrending}>
              Retry Trending
            </button>
          </p>
        )}
        <div className="video-grid">
          {filteredTrending.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              saved={savedIds.includes(video.id)}
              onToggleSave={toggleSave}
              onPreview={setSelectedVideo}
            />
          ))}
        </div>
        {trendingNextPageToken && (
          <div className="load-more-wrap">
            <button
              className="secondary-button"
              onClick={loadMoreTrendingVideos}
              disabled={trendingLoadingMore}
            >
              {trendingLoadingMore ? 'Loading videos…' : 'Load more'}
            </button>
          </div>
        )}
        {filteredTrending.length === 0 && !trendingLoading && !trendingError && (
          <div className="empty">
            <p>
              {trendingVideos.length > 0
                ? 'No loaded Trending videos match these filters. Load more or adjust the filters.'
                : `YouTube returned no popular videos for Nigeria${trendingCategory !== 'All categories' ? ' in this category' : ''}.`}
            </p>
            {trendingVideos.length === 0 && (
              <button className="clear" onClick={refreshTrending}>Try again</button>
            )}
          </div>
        )}
      </section>
      <section className="trending" id="discover-feed">
        <div className="section-kicker"><i /> CURATED FOR DISCOVERY</div>
        <div className="section-head results-head">
          <h2>Discover videos</h2>
          <span className="result-count">
            {filtered.length} {filtered.length === 1 ? 'video' : 'videos'}
          </span>
          <button className="clear" onClick={refreshFeed}>
            Refresh discoveries
          </button>
          <button className="clear" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
        <FeedFilterControls
          id="interests"
          categories={youtubeCategories}
          category={category}
          duration={duration}
          date={date}
          sort={sort}
          onCategoryChange={(selectedCategory) => void changeDiscoveryCategory(selectedCategory)}
          onDurationChange={setDuration}
          onDateChange={setDate}
          onSortChange={setSort}
        />
        <p className="preview-note">
          Duration, upload date and sort filters apply to videos currently loaded.
        </p>
        {youtubeLoading && liveVideos.length === 0 && (
          <p role="status" className="preview-note">
            Loading videos from YouTube…
          </p>
        )}
        {youtubeError && (
          <p role="alert" className="preview-note">
            {youtubeError}{' '}
            <button className="clear" onClick={refreshFeed}>
              {searchTerm ? 'Retry search' : 'Refresh discoveries'}
            </button>
          </p>
        )}
        <div className="video-grid">
          {filtered.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              saved={savedIds.includes(video.id)}
              onToggleSave={toggleSave}
              onPreview={setSelectedVideo}
            />
          ))}
        </div>
        {nextPageToken && (
          <div className="load-more-wrap">
            <button
              className="secondary-button"
              onClick={loadMoreVideos}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading videos…' : 'Show more videos'}
            </button>
          </div>
        )}
        {filtered.length === 0 && !youtubeLoading && !youtubeError && (
          <div className="empty">
            <p>
              {liveVideos.length > 0
                ? 'No videos match those filters. Try another search or category.'
                : nextPageToken
                  ? 'No new videos were found on this page. Load more to continue.'
                  : 'YouTube returned no videos for this query.'}
            </p>
            <button
              className="clear"
              onClick={liveVideos.length > 0 ? clearFilters : refreshFeed}
            >
              {liveVideos.length > 0
                ? 'Clear filters and try again'
                : searchTerm
                  ? 'Retry search'
                  : 'Try another discovery query'}
            </button>
          </div>
        )}
        <p className="preview-note">
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

  <p className="preview-note">
    Your watch history will appear here when playback tracking is available.
  </p>
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
