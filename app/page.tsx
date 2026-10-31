'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Video = { id: string; category: string; title: string; creator: string; views: string; age: string; duration: string; score: number; tone: string; progress?: number; remaining?: string };
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
const interests = ['All', 'Technology', 'Design', 'Business', 'Science', 'Travel', 'Music', 'Gaming'];
const durationSeconds = (value: string) => { const [m, s] = value.split(':').map(Number); return m * 60 + s; };
const ageDays = (age: string) => { const n = Number(age.match(/\d+/)?.[0] ?? 0); if (age.includes('year')) return n * 365; if (age.includes('month')) return n * 30; if (age.includes('week')) return n * 7; return n; };
function Score({ value }: { value: number }) { return <div className="score-ring" aria-label={`Example match score ${value}`}><span>{value}</span></div>; }
function VideoCard({ video, saved, onToggleSave, onPreview }: { video: Video; saved: boolean; onToggleSave: (id: string) => void; onPreview: (video: Video) => void }) {
  return <article className="video-card"><div className={`video-thumb ${video.tone}`}><Score value={video.score}/><button className="play-button" aria-label={`Open ${video.title}`} onClick={() => onPreview(video)}>▶</button><span className="duration">{video.duration}</span></div><div className="video-details"><div className="category-label">{video.category}</div><div className="video-title-line"><h3>{video.title}</h3><button className={`save-button ${saved ? 'saved' : ''}`} aria-label={saved ? `Remove ${video.title} from Watch Later` : `Save ${video.title} to Watch Later`} title={saved ? 'Remove from Watch Later' : 'Save to Watch Later'} onClick={() => onToggleSave(video.id)}>{saved ? '✓' : '♧'}</button></div><p className="video-meta">{video.creator} · {video.views} · {video.age}</p></div></article>;
}
export default function Home() {
  const [supabase] = useState(() => createClient());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null);
  const [active, setActive] = useState('All');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [duration, setDuration] = useState('Any length');
  const [date, setDate] = useState('Any time');
  const [sort, setSort] = useState('Most popular');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncSession = async (sessionUserId: string | null, sessionEmail: string | null) => {
      if (!mounted) return;
      setUserId(sessionUserId);
      setUserEmail(sessionEmail);
      setAuthReady(true);

      if (!sessionUserId) {
        setSavedIds([]);
        return;
      }

      const { data, error } = await supabase
        .from('saved_videos')
        .select('video_id')
        .eq('user_id', sessionUserId)
        .order('created_at', { ascending: false });

      if (!mounted) return;
      if (error) {
        console.error('Could not load saved videos:', error.message);
        setSaveMessage('Could not load your saved videos. Please refresh and try again.');
        return;
      }
      setSavedIds((data ?? []).map((row) => row.video_id));
      setSaveMessage('');
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
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Unable to sign out:', error.message);
    setAccountOpen(false);
    setMobileMenuOpen(false);
  };

  const filtered = useMemo(() => {
    let list = videos.filter(v => {
      const categoryMatch = (active === 'All' || v.category.toLowerCase() === active.toLowerCase()) && (category === 'All categories' || v.category.toLowerCase() === category.toLowerCase());
      const queryMatch = `${v.title} ${v.creator} ${v.category}`.toLowerCase().includes(query.trim().toLowerCase());
      const seconds = durationSeconds(v.duration);
      const durationMatch = duration === 'Any length' || (duration === 'Under 10 min' && seconds < 600) || (duration === '10–20 min' && seconds >= 600 && seconds <= 1200) || (duration === 'Over 20 min' && seconds > 1200);
      const days = ageDays(v.age);
      const dateMatch = date === 'Any time' || (date === 'Today' && days === 0) || (date === 'This week' && days <= 7) || (date === 'This month' && days <= 30) || (date === 'This year' && days <= 365);
      return categoryMatch && queryMatch && durationMatch && dateMatch;
    });
    if (sort === 'Best match') list = [...list].sort((a, b) => b.score - a.score);
    if (sort === 'Newest') list = [...list].sort((a, b) => ageDays(a.age) - ageDays(b.age));
    if (sort === 'Most popular') list = [...list].sort((a, b) => Number(b.views.split('K')[0]) - Number(a.views.split('K')[0]));
    return list;
  }, [active, category, date, duration, query, sort]);
  const allVideos = [...videos, featuredVideo, continueVideo];
  const savedVideos = allVideos.filter(v => savedIds.includes(v.id));

  const toggleSave = async (id: string) => {
    if (!userId) {
      window.location.assign('/auth?next=/');
      return;
    }
    if (savingVideoId) return;

    const video = allVideos.find((item) => item.id === id);
    if (!video) return;

    setSavingVideoId(id);
    setSaveMessage('');
    const alreadySaved = savedIds.includes(id);

    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from('saved_videos')
          .delete()
          .eq('user_id', userId)
          .eq('video_id', id);
        if (error) throw error;
        setSavedIds((current) => current.filter((savedId) => savedId !== id));
        setSaveMessage('Removed from your saved videos.');
      } else {
        const { error } = await supabase.from('saved_videos').insert({
          user_id: userId,
          video_id: id,
          title: video.title,
          channel_title: video.creator,
          thumbnail_url: null,
          video_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${video.title} ${video.creator}`)}`,
        });
        if (error) throw error;
        setSavedIds((current) => current.includes(id) ? current : [...current, id]);
        setSaveMessage('Saved to your account. It will be here when you return.');
      }
    } catch (error) {
      console.error('Could not update saved video:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Could not update your saved videos. Please try again.');
    } finally {
      setSavingVideoId(null);
    }
  };
  const clearFilters = () => { setActive('All'); setCategory('All categories'); setDuration('Any length'); setDate('Any time'); setSort('Most popular'); setQuery(''); };
  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setMobileMenuOpen(false); setAccountOpen(false); };

  return <main id="top">
    <nav className="topbar" aria-label="Main navigation">
      <a className="wordmark" href="#top">Discoverly</a>
      <form className="nav-search" role="search" onSubmit={e => { e.preventDefault(); scrollTo('trending'); }}><span aria-hidden="true">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search videos, topics, or creators" aria-label="Search videos, topics, or creators" /><button className="search-submit" type="submit" aria-label="Search">↵</button></form>
      <div className="nav-links"><a href="#top">Home</a><a href="#trending">Trending</a><a href="#interests">Categories</a><a href="#watch-later">Watch Later{savedIds.length > 0 ? ` (${savedIds.length})` : ''}</a>{!userEmail && <><a className="nav-auth-link" href="/auth">Log in</a><a className="nav-auth-button" href="/auth?mode=signup">Sign up</a></>}{userEmail && <div className="account-wrap"><button className="avatar" aria-label="Open account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(v => !v)}>{userEmail.slice(0, 1).toUpperCase()}</button>{accountOpen && <div className="account-menu"><strong>Your account</strong><span>{userEmail}</span><button onClick={() => { setAccountOpen(false); scrollTo('watch-later'); }}>Saved videos ({savedIds.length})</button><button onClick={() => { clearFilters(); setAccountOpen(false); scrollTo('trending'); }}>Reset filters</button><button onClick={handleLogout}>Log out</button></div>}</div>}{!authReady && <span className="auth-loading" aria-label="Checking account">…</span>}</div>
      <button className="mobile-menu-toggle" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}>{mobileMenuOpen ? '×' : '☰'}</button>
      {mobileMenuOpen && <div className="mobile-menu"><button onClick={() => scrollTo('top')}>Home</button><button onClick={() => scrollTo('trending')}>Trending</button><button onClick={() => scrollTo('interests')}>Categories</button><button onClick={() => scrollTo('watch-later')}>Watch Later ({savedIds.length})</button><button onClick={() => { clearFilters(); setMobileMenuOpen(false); scrollTo('interests'); }}>Reset filters</button>{userEmail ? <><span className="mobile-account-email">Signed in as {userEmail}</span><button onClick={handleLogout}>Log out</button></> : <><a className="mobile-auth-link" href="/auth">Log in</a><a className="mobile-auth-button" href="/auth?mode=signup">Create account</a></>}</div>}
    </nav>
    <div className="page-wrap">
      <section className="hero"><div className="hero-copy"><div className="hero-kicker"><i/> CURATED FOR YOUR CURIOSITY</div><h1>Find your next favorite<br className="desktop-break"/> video</h1><p>Discover thoughtful stories, fresh ideas, and the videos worth making time for.</p><button className="compass" aria-label="Explore videos" title="Explore videos" onClick={() => scrollTo('trending')}>⊙</button></div><div className="hero-orb" aria-hidden="true"><div className="orb-core"/></div></section>
      <section className="interests" id="interests"><div className="section-kicker"><i/> BROWSE BY INTEREST</div><div className="section-head"><h2>A little something for every mood</h2><button className="clear" onClick={clearFilters}>Clear filters</button></div><div className="chips" aria-label="Filter by interest">{interests.map(i => <button key={i} className={`chip ${active===i?'active':''}`} aria-pressed={active===i} onClick={() => setActive(i)}>{active===i && <span>• </span>}{i}</button>)}</div><div className="filter-panel"><label>CATEGORY<select value={category} onChange={e=>setCategory(e.target.value)}>{['All categories','Technology','Design','Business','Science','Travel','Music','Gaming'].map(v=><option key={v}>{v}</option>)}</select></label><label>DURATION<select value={duration} onChange={e=>setDuration(e.target.value)}>{['Any length','Under 10 min','10–20 min','Over 20 min'].map(v=><option key={v}>{v}</option>)}</select></label><label>UPLOAD DATE<select value={date} onChange={e=>setDate(e.target.value)}>{['Any time','Today','This week','This month','This year'].map(v=><option key={v}>{v}</option>)}</select></label><label>SORT BY<select value={sort} onChange={e=>setSort(e.target.value)}>{['Most popular','Best match','Newest'].map(v=><option key={v}>{v}</option>)}</select></label></div></section>
      <section className="featured"><div className="section-kicker"><i/> EDITOR'S PICK</div><h2>Featured this week</h2><article className="featured-card"><div className="featured-thumb"><Score value={96}/><button className="play-button" aria-label="Open featured video" onClick={() => setSelectedVideo(featuredVideo)}>▶</button><span className="duration">14:28</span></div><div className="featured-info"><div className="category-label">TRAVEL</div><h3>Above the Quiet: Mountains at First Light</h3><p>A slow, cinematic journey through high country as daybreak reshapes the landscape.</p><div className="featured-by"><div><b>Northbound Films</b><small>842K views · 4 days ago</small></div><button className={`save-button ${savedIds.includes(featuredVideo.id) ? 'saved' : ''}`} aria-label={savedIds.includes(featuredVideo.id) ? 'Remove featured video from Watch Later' : 'Save featured video to Watch Later'} title="Save to Watch Later" onClick={() => toggleSave(featuredVideo.id)}>{savedIds.includes(featuredVideo.id) ? '✓' : '♧'}</button></div></div></article></section>
      <section className="trending" id="trending"><div className="section-kicker"><i/> POPULAR RIGHT NOW</div><div className="section-head results-head"><h2>Trending now</h2><span className="result-count">{filtered.length} {filtered.length === 1 ? 'video' : 'videos'}</span></div><div className="video-grid">{filtered.map(v=><VideoCard key={v.id} video={v} saved={savedIds.includes(v.id)} onToggleSave={toggleSave} onPreview={setSelectedVideo}/>)}</div>{filtered.length===0 && <div className="empty"><p>No preview videos match those filters.</p><button className="clear" onClick={clearFilters}>Clear filters and try again</button></div>}<p className="preview-note">Preview content only — live YouTube search and verified match scores are not connected yet.</p></section>
      <section className="continue" id="watch-later"><div className="section-kicker"><i/> YOUR COLLECTION</div><div className="section-head"><h2>Watch Later</h2><span className="result-count">{savedVideos.length} saved</span></div>{saveMessage && <p role="status" aria-live="polite" className="preview-note">{saveMessage}</p>}{!userId && authReady && <p className="preview-note">Log in to save videos to your personal account.</p>}{savedVideos.length ? <div className="video-grid saved-grid">{savedVideos.map(v => <VideoCard key={v.id} video={v} saved onToggleSave={toggleSave} onPreview={setSelectedVideo}/>)}</div> : <div className="saved-empty"><span className="saved-empty-icon">♧</span><div><h3>Your list starts here</h3><p>{userId ? 'Use the bookmark icon on any video to keep it here for later.' : 'Log in, then use the bookmark icon to save videos to your account.'}</p></div><button className="secondary-button" onClick={() => userId ? scrollTo('trending') : window.location.assign('/auth')}>{userId ? 'Explore videos' : 'Log in to save videos'}</button></div>}</section>
      <section className="continue" id="continue-watching"><div className="section-kicker"><i/> PICK UP WHERE YOU LEFT OFF</div><h2>Continue watching</h2><article className="continue-card"><div className="continue-art"/><div className="continue-info"><div className="category-label">DESIGN</div><h3>A New Language for Public Spaces</h3><p>City Form · 5:14 remaining</p><div className="progress"><span/></div><button className="text-action" onClick={() => setSelectedVideo(continueVideo)}>Continue video ↗</button></div></article></section>
      <footer><b>Discoverly</b><span>Find videos worth your time.</span><a href="#top">Back to top ↑</a></footer>
    </div>
    {selectedVideo && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedVideo(null); }}><section className="video-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close video details" onClick={() => setSelectedVideo(null)}>×</button><div className={`modal-art ${selectedVideo.tone}`}><Score value={selectedVideo.score}/><span className="modal-play">▶</span></div><div className="modal-content"><div className="category-label">{selectedVideo.category}</div><h2 id="modal-title">{selectedVideo.title}</h2><p>{selectedVideo.creator} · {selectedVideo.views} · {selectedVideo.age}</p><p className="modal-note">This is sample preview content. Discoverly is not connected to live YouTube playback yet, but you can search YouTube for this title.</p><div className="modal-actions"><a className="primary-button" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(selectedVideo.title + ' ' + selectedVideo.creator)}`} target="_blank" rel="noreferrer">Find on YouTube ↗</a><button className="secondary-button" onClick={() => toggleSave(selectedVideo.id)}>{savedIds.includes(selectedVideo.id) ? '✓ Saved · Remove' : '♧ Save for later'}</button></div></div></section></div>}
  </main>;
}
