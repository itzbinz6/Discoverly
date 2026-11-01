
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const topics = [
  "Technology",
  "Artificial Intelligence",
  "Science",
  "Business & Finance",
  "Education",
  "Gaming",
  "Music",
  "Sports",
  "Movies & TV",
  "News & Politics",
  "Health & Fitness",
  "Travel",
  "Food & Cooking",
  "Art & Design",
  "History & Culture",
  "Comedy",
  "Lifestyle",
  "Personal Development",
];

export default function PreferencesPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [preferredTopics, setPreferredTopics] = useState<string[]>([]);
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPreferences() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth");
        return;
      }

      const { data, error: preferenceError } = await supabase
        .from("user_preferences")
        .select("preferred_topics, excluded_topics")
        .eq("user_id", user.id)
        .maybeSingle();

      if (preferenceError) {
        setError("We couldn't load your preferences. Please refresh.");
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Your preferences haven't been set up yet. Please complete onboarding.");
        setLoading(false);
        return;
      }

      setPreferredTopics(data.preferred_topics ?? []);
      setExcludedTopics(data.excluded_topics ?? []);
      setLoading(false);
    }

    loadPreferences();
  }, [router, supabase]);

  function togglePreferred(topic: string) {
    setPreferredTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );

    setExcludedTopics((current) => current.filter((item) => item !== topic));
    setMessage("");
  }

  function toggleExcluded(topic: string) {
    setExcludedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );

    setPreferredTopics((current) => current.filter((item) => item !== topic));
    setMessage("");
  }

  async function handleSave() {
    setError("");
    setMessage("");

    if (preferredTopics.length === 0) {
      setError("Please keep at least one preferred topic.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth");
        return;
      }

      const { error: saveError } = await supabase
        .from("user_preferences")
        .update({
          preferred_topics: preferredTopics,
          excluded_topics: excludedTopics,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (saveError) throw saveError;

      setMessage("Your preferences have been updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save your preferences. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function TopicButton({
    topic,
    selected,
    onClick,
  }: {
    topic: string;
    selected: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        style={{
          padding: "10px 15px",
          borderRadius: "24px",
          border: selected ? "1px solid #315C43" : "1px solid #deded6",
          background: selected ? "#315C43" : "#fff",
          color: selected ? "#fff" : "#343b35",
          cursor: "pointer",
        }}
      >
        {selected ? "✓ " : "+ "}
        {topic}
      </button>
    );
  }

  if (loading) {
    return <main style={styles.center}>Loading your preferences...</main>;
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <button
          className="preferences-back-button"
          onClick={() => router.push("/")}
        >
          ← Back to Discoverly
        </button>

        <h1>Your preferences</h1>
        <p>
          Update the topics you enjoy and the topics you would rather avoid.
          Your changes will be saved to your account.
        </p>

        <section style={styles.section}>
          <h2>Topics you're interested in</h2>
          <p>{preferredTopics.length} selected</p>

          <div style={styles.topicList}>
            {topics.map((topic) => (
              <TopicButton
                key={topic}
                topic={topic}
                selected={preferredTopics.includes(topic)}
                onClick={() => togglePreferred(topic)}
              />
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h2>Topics you want to avoid</h2>
          <p>{excludedTopics.length} selected</p>

          <div style={styles.topicList}>
            {topics.map((topic) => (
              <TopicButton
                key={topic}
                topic={topic}
                selected={excludedTopics.includes(topic)}
                onClick={() => toggleExcluded(topic)}
              />
            ))}
          </div>
        </section>

        {error && <p role="alert" style={styles.error}>{error}</p>}
        {message && <p role="status" style={styles.success}>{message}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={styles.save}
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "40px 20px",
    background: "#f8f8f2",
    color: "#252d27",
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
  },
  container: {
    maxWidth: "760px",
    margin: "0 auto",
  },
  section: {
    marginTop: "35px",
  },
  topicList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "15px",
  },
  error: {
    color: "#b42318",
    marginTop: "20px",
  },
  success: {
    color: "#247344",
    marginTop: "20px",
  },
  save: {
    width: "100%",
    marginTop: "25px",
    padding: "15px",
    border: "none",
    borderRadius: "10px",
    background: "#315C43",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
};
