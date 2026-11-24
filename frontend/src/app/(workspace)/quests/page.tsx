"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useShellProfile } from "@/components/app-shell";
import { ActivityDateFilter } from "@/components/activity-date-filter";
import { activityDateMatches } from "@/lib/activity-date";
import { QuestCard, questHref } from "@/components/quest-card";
import { StudentExamList } from "@/components/student-exam-list";
import type { Quest } from "@/lib/types";

type QuestStatusFilter = "all" | "next" | "completed";

const categories = [
  ["", "All quests", undefined],
  ["code-challenge", "Code challenges", "Show activities where you write and test code."],
  ["lessons-review", "Concept check quiz", "Show short quizzes on programming concepts."],
  ["exams", "Exams", "Show the exams assigned to you."],
] as const;

type PracticeCategory = Exclude<(typeof categories)[number][0], "exams">;

function QuestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get("category");
  const category = categories.find(([value]) => value === requestedCategory)?.[0] ?? "";

  function handleCategorySelect(value: string) {
    const query = new URLSearchParams(searchParams);
    if (value) query.set("category", value);
    else query.delete("category");
    router.push(query.size ? "/quests?" + query : "/quests", { scroll: false });
  }

  return (
    <div className="bq-quest-page bq-quest-map">
      <div className="quests-workspace-expanded" id="quest-panel">
        <div className="qm-panel-heading">
          <div>
            <h1>Quest Map</h1>
            <p>Find practice quests and assigned exams.</p>
          </div>
        </div>
        <div className="quest-map-toolbar">
          <div className="quest-filters" role="group" aria-label="Activity type">
            {categories.map(([value, label, description]) => (
              <button type="button" key={value} className="filter-button" data-tooltip={description}
                aria-pressed={category === value} onClick={() => { if (category !== value) handleCategorySelect(value); }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {category === "exams" ? <StudentExamList /> : <PracticeQuestList category={category} />}
      </div>
    </div>
  );
}

function PracticeQuestList({ category }: { category: PracticeCategory }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profile = useShellProfile();
  const language = profile.enrolled_language;
  const isStudent = profile.role === "student";
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [questFilter, setQuestFilter] = useState<QuestStatusFilter>("all");
  const selectedConcept = searchParams.get("concept");
  // The box shows a chosen concept but owns its text, so typing never waits on the URL update.
  const [search, setSearch] = useState(selectedConcept ?? "");
  const [shownConcept, setShownConcept] = useState(selectedConcept);
  if (shownConcept !== selectedConcept) {
    setShownConcept(selectedConcept);
    if (selectedConcept !== null) setSearch(selectedConcept);
  }
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const searchInput = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setIsError(false);
    setMessage("");
    try {
      setQuests(await apiRequest<Quest[]>("/quests"));
    } catch (error) {
      setIsError(true);
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (language) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadData();
    }
  }, [language, loadData]);

  const nextQuest = quests.find((quest) => !quest.is_completed);
  // Interactive selection state (Von Restorff + Direct Manipulation)
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  // Click outside the quest controls to clear the card selection.
  useEffect(() => {
    function handleBackgroundClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // If clicking outside any quest-card, toolbar, or interactive element, clear highlight
      if (!target.closest(".quest-card, .quest-toolbar, button, a, input, select, textarea")) {
        setSelectedQuestId(null);
      }
    }
    window.addEventListener("click", handleBackgroundClick);
    return () => window.removeEventListener("click", handleBackgroundClick);
  }, []);

  // Filter quests by category (URL parameter), status filter, and search query
  const filteredQuests = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return quests.filter((quest) => {
      // Status filter
      const matchesStatus =
        questFilter === "all" ||
        (questFilter === "completed" && quest.is_completed) ||
        (questFilter === "next" && !quest.is_completed);

      // Search filter
      const matchesSearch = selectedConcept !== null
        ? quest.topic_concept === selectedConcept
        : !normalizedSearch || `${quest.title ?? ""} ${quest.topic_concept} ${quest.activity_type}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch && activityDateMatches(quest.added_at, dateRange.from, dateRange.to);
    });
  }, [quests, questFilter, search, selectedConcept, dateRange]);

  const visibleQuests = filteredQuests.filter((quest) => category === "code-challenge"
    ? quest.activity_type === "challenge" : category === "lessons-review"
      ? quest.activity_type === "quiz" : true);
  const hasFilters = Boolean(category || selectedConcept || search.trim() || questFilter !== "all" || dateRange.from || dateRange.to);

  // Keyboard navigation & activation (Enter launches selected card; arrows navigate grid)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest("button, a, .monaco-editor, [role='textbox']"))
      ) {
        return;
      }

      if (e.key === "/" && searchInput.current) {
        e.preventDefault();
        searchInput.current.focus();
        return;
      }

      if (e.key === "Escape") {
        setSelectedQuestId(null);
        return;
      }

      if (e.key === "Enter" && selectedQuestId && isStudent) {
        const targetQuest = visibleQuests.find((q) => q.id === selectedQuestId);
        if (targetQuest) {
          e.preventDefault();
          router.push(questHref(targetQuest));
        }
        return;
      }

      // Spatial Arrow-key navigation across visible quest cards
      if (visibleQuests.length > 0) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "]") {
          e.preventDefault();
          setSelectedQuestId((currentId) => {
            if (!currentId) return visibleQuests[0].id;
            const idx = visibleQuests.findIndex((q) => q.id === currentId);
            const nextIdx = (idx + 1) % visibleQuests.length;
            return visibleQuests[nextIdx].id;
          });
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "[") {
          e.preventDefault();
          setSelectedQuestId((currentId) => {
            if (!currentId) return visibleQuests[visibleQuests.length - 1].id;
            const idx = visibleQuests.findIndex((q) => q.id === currentId);
            const prevIdx = (idx - 1 + visibleQuests.length) % visibleQuests.length;
            return visibleQuests[prevIdx].id;
          });
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedQuestId, visibleQuests, router, isStudent]);

  function clearFilters() {
    setQuestFilter("all");
    setSearch("");
    setDateRange({ from: "", to: "" });
    const query = new URLSearchParams(searchParams);
    query.delete("category");
    query.delete("concept");
    router.push(query.size ? pathname + "?" + query : pathname, { scroll: false });
  }

  if (!profile.enrolled_language) {
    return <section className="empty-state quest-filter-empty">
      <h2>Choose your programming language</h2>
      <p>Join a workshop to pick your language and see its practice quests.</p>
      <Link className="button button-primary" href="/workshops">Go to Workshops</Link>
    </section>;
  }
  if (loading) return <section className="panel" role="status">Loading quest map…</section>;
  if (isError) {
    return <section className="panel">
      <p role="alert">{message}</p>
      <button type="button" className="button button-outline" onClick={() => void loadData()}>Retry</button>
    </section>;
  }
  if (!quests.length) {
    return <section className="empty-state quest-filter-empty">
      <h2>No published activities yet</h2>
      <p>Check again after your instructor publishes an activity for your track.</p>
    </section>;
  }

  return (
    <>
      <div className="quest-toolbar quest-map-toolbar">
        <div className="quest-browse-controls">
          <div className="quest-refine-controls">
            <label className="quest-search">
              <span className="sr-only">Search quests</span>
              <input
                ref={searchInput}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (selectedConcept) {
                    const query = new URLSearchParams(searchParams);
                    query.delete("concept");
                    router.replace(query.size ? pathname + "?" + query : pathname, { scroll: false });
                  }
                }}
                placeholder="Search quests"
                type="search"
              />
            </label>
            {isStudent && <select className="quest-status-select" aria-label="Completion status"
              value={questFilter} onChange={(event) => setQuestFilter(event.target.value as QuestStatusFilter)}>
              <option value="all">All statuses</option>
              <option value="next">To do</option>
              <option value="completed">Completed</option>
            </select>}
          </div>
          <ActivityDateFilter from={dateRange.from} to={dateRange.to}
            onChange={(from, to) => setDateRange({ from, to })} />
        </div>
        <div className="quest-results-summary">
          <p className="quest-result-count" role="status">
            {visibleQuests.length} {visibleQuests.length === 1 ? "quest" : "quests"} found
          </p>
          {hasFilters && visibleQuests.length > 0 && <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>}
        </div>
      </div>

      {/* Quest Card Grid: Decluttered, balanced 2-column layout */}
      {visibleQuests.length === 0 ? (
        <div className="empty-state quest-filter-empty">
          <h2>No quests match that view</h2>
          <p>Try another filter or a different search term.</p>
          <button
            className="button button-outline"
            type="button"
            onClick={clearFilters}
          >
            Show all quests
          </button>
        </div>
      ) : (
        <div className="quest-grid-expanded">
          {visibleQuests.map((quest) => <QuestCard
            key={quest.id}
            quest={quest}
            learner={isStudent}
            next={isStudent && quest.id === nextQuest?.id && !quest.is_completed}
            selected={quest.id === selectedQuestId}
            onSelect={() => setSelectedQuestId(quest.id)}
            onOpen={isStudent ? () => router.push(questHref(quest)) : undefined}
          />)}
        </div>
      )}
    </>
  );
}

export default function QuestsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <section className="panel" role="status">
            Loading quest map…
          </section>
        </div>
      }
    >
      <QuestsPageContent />
    </Suspense>
  );
}
