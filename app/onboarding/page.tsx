
"use client";

// Discoverly onboarding page.
// This page collects a user's preferred and excluded topics
// and stores them in Supabase.

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

const supabase = createClient();

export default function OnboardingPage() {
  const router = useRouter();

  const [preferredTopics, setPreferredTopics] = useState<string[]>([]);
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Check that the user is signed in and load any existing preferences.
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
        .select("preferred_topics, excluded_topics, onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (preferenceError) {
        setError("We couldn't load your preferences. Please refresh.");
        setLoading(false);
        return;
      }

      // If onboarding has already been completed, don't show it again.
      if (data?.onboarding_completed) {
        router.replace("/");
        return;
      }

      setPreferredTopics(data?.preferred_topics ?? []);
      setExcludedTopics(data?.excluded_topics ?? []);
      setLoading(false);
    }

    loadPreferences();
  }, [router, supabase]);

  // Add or remove a topic from the selected list.
  function toggleTopic(
    topic: string,
    selectedTopics: string[],
    setSelectedTopics: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    setSelectedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );
  }

  // Save the user's choices to their Supabase account.
  async function handleSubmit() {
    setError("");

    if (preferredTopics.length === 0) {
      setError("Please select at least one topic you're interested in.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaving(false);
      router.replace("/auth");
      return;
    }

    const { error: saveError } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          preferred_topics: preferredTopics,
          excluded_topics: excludedTopics,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (saveError) {
      setError("We couldn't save your preferences. Please try again.");
      setSaving(false);
      return;
    }

    router.replace("/");
  }

  // Reusable topic selection button.
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
        style={{
          padding: "11px 16px",
          borderRadius: "30px",
          border: selected ? "1px solid #315C43" : "1px solid #deded6",
          background: selected ? "#315C43" : "#fff",
          color: selected ? "#fff" : "#343b35",
          fontSize: "14px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        {selected ? "✓ " : "+ "}
        {topic}
      </button>
    );
  }

  if (loading) {
    return (
      <main style={styles.loading}>
        <p>Preparing your Discoverly experience...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <div style={styles.logo}>discoverly<span>.</span></div>

        <div style={styles.progress}>
          <div style={styles.progressFill} />
        </div>

        <p style={styles.step}>LET'S PERSONALIZE YOUR EXPERIENCE</p>

        <h1 style={styles.heading}>
          What do you <span>love watching?</span>
        </h1>

        <p style={styles.description}>
          Choose the topics you're interested in. We'll use your choices
          to help make your video discovery experience more relevant.
        </p>

        <section style={styles.section}>
          <div style={styles.sectionHeading}>
            <h2>Your interests</h2>
            <span>{preferredTopics.length} selected</span>
          </div>

          <p style={styles.helper}>
            Select everything you'd enjoy watching.
          </p>

          <div style={styles.topicList}>
            {topics.map((topic) => (
              <TopicButton
                key={topic}
                topic={topic}
                selected={preferredTopics.includes(topic)}
                onClick={() =>
                  toggleTopic(topic, preferredTopics, setPreferredTopics)
                }
              />
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeading}>
            <h2>Topics to avoid</h2>
            <span>{excludedTopics.length} selected</span>
          </div>

          <p style={styles.helper}>
            Optional: tell us what you'd rather not see.
          </p>

          <div style={styles.topicList}>
            {topics.map((topic) => (
              <TopicButton
                key={topic}
                topic={topic}
                selected={excludedTopics.includes(topic)}
                onClick={() =>
                  toggleTopic(topic, excludedTopics, setExcludedTopics)
                }
              />
            ))}
          </div>
        </section>

        {error && <p style={styles.error}>{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          style={{
            ...styles.submit,
            opacity: saving ? 0.65 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving your preferences..." : "Continue to Discoverly →"}
        </button>

        <p style={styles.footer}>
          You can always change your preferences later.
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8f8f2",
    padding: "48px 20px",
    color: "#252d27",
  },
  container: {
    maxWidth: "760px",
    margin: "0 auto",
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8f8f2",
    color: "#315C43",
  },
  logo: {
    fontSize: "25px",
    fontWeight: 800,
    letterSpacing: "-1.5px",
    marginBottom: "36px",
  },
  progress: {
    width: "100%",
    height: "5px",
    background: "#e7e9df",
    borderRadius: "10px",
    overflow: "hidden",
    marginBottom: "35px",
  },
  progressFill: {
    width: "65%",
    height: "100%",
    background: "#315C43",
    borderRadius: "10px",
  },
  step: {
    color: "#64836b",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1.8px",
    marginBottom: "12px",
  },
  heading: {
    fontSize: "clamp(32px, 6vw, 48px)",
    lineHeight: 1.12,
    letterSpacing: "-2px",
    margin: "0 0 15px",
    fontWeight: 750,
  },
  description: {
    color: "#777e75",
    fontSize: "15px",
    lineHeight: 1.7,
    maxWidth: "580px",
    marginBottom: "38px",
  },
  section: {
    marginBottom: "34px",
  },
  sectionHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  helper: {
    color: "#858b81",
    fontSize: "13px",
    margin: "7px 0 17px",
  },
  topicList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  error: {
    color: "#b42318",
    background: "#fff0ee",
    padding: "12px 15px",
    borderRadius: "10px",
    fontSize: "13px",
  },
  submit: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    background: "#315C43",
    color: "#fff",
    padding: "17px 20px",
    fontSize: "15px",
    fontWeight: 700,
    marginTop: "12px",
  },
  footer: {
    color: "#92978e",
    textAlign: "center",
    fontSize: "12px",
    marginTop: "17px",
  },
};
