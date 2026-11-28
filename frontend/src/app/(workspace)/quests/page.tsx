"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useShellProfile } from "@/components/app-shell";
import { ActivityDateFilter } from "@/components/activity-date-filter";
import { activityDateMatches } from "@/lib/activity-date";
import { QuestCard, questHref, questNumber, type QuestWorkshopSource } from "@/components/quest-card";
import { ActivityPerformancePreview } from "@/components/activity-performance-preview";
import { workshopLanguages } from "@/components/workshops/workshop-ui";
import type { ProgrammingLanguage, Quest, Workshop } from "@/lib/types";

type QuestStatusFilter = "all" | "next" | "completed";

const categories = [
  ["", "All quests", undefined],
  ["code-challenge", "Code challenges", "Show activities where you write and test code."],
  ["lessons-review", "Concept check quiz", "Show short quizzes on programming concepts."],
] as const;

type PracticeCategory = (typeof categories)[number][0];

function QuestsPageContent() {
  const searchParams = useSearchParams();
  const { role, workshop_languages: studentLanguages } = useShellProfile();
  const isStudent = role === "student";
  const requestedCategory = searchParams.get("category");
  const category = categories.find(([value]) => value === requestedCategory)?.[0] ?? "";
  // Workshops decide what a student sees (ADR 0001); the language filter only narrows that list.
  const requestedLanguage = searchParams.get("language");
  const language = studentLanguages.find((value) => value === requestedLanguage) ?? null;

  function selectFilter(key: "language" | "category", value: string) {
    const query = new URLSearchParams(searchParams);
    if (value) query.set(key, value);
    else query.delete(key);
    window.history.pushState(null, "", query.size ? "/quests?" + query : "/quests");
  }

  return (
    <div className="bq-quest-page bq-quest-map">
      <div className="quests-workspace-expanded" id="quest-panel">
        <div className="qm-panel-heading">
          <div>
            <h1>Quest Map</h1>
            <p>{isStudent ? "Find coding challenges and concept checks shared in your Workshops." : "Find coding challenges and practice quizzes."}</p>
          </div>
        </div>
        <div className="quest-map-toolbar">
          {isStudent && studentLanguages.length > 1 && <div className="quest-filters" role="group" aria-label="Language">
            {[null, ...studentLanguages].map((value) => (
              <button type="button" key={value ?? "all"} className="filter-button" aria-pressed={language === value}
                onClick={() => { if (language !== value) selectFilter("language", value ?? ""); }}>
                {value ? workshopLanguages[value] : "All languages"}
              </button>
            ))}
          </div>}
          <div className="quest-filters" role="group" aria-label="Activity type">
            {categories.map(([value, label, description]) => (
              <button type="button" key={value} className="filter-button" data-tooltip={description}
                aria-pressed={category === value} onClick={() => { if (category !== value) selectFilter("category", value); }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <PracticeQuestList category={category} language={language} />
      </div>
    </div>
  );
}

function PracticeQuestList({ category, language }: { category: PracticeCategory; language: ProgrammingLanguage | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profile = useShellProfile();
  // A student with no Workshop has nothing to list yet (ADR 0001).
  const needsWorkshop = profile.role === "student" && !profile.workshop_languages.length;
  const isStudent = profile.role === "student";
  const [quests, setQuests] = useState<Quest[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[] | null>(null);
  const [workshopError, setWorkshopError] = useState<string | null>(null);
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
  const request = useRef<AbortController>(null);

  const loadData = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const { signal } = controller;
    setLoading(true);
    setIsError(false);
    setMessage("");
    if (isStudent) {
      setWorkshops(null);
      setWorkshopError(null);
      void apiRequest<Workshop[]>("/workshops", { signal }).then(
        (activeWorkshops) => { if (!signal.aborted) setWorkshops(activeWorkshops); },
        (error) => { if (!signal.aborted) setWorkshopError(getErrorMessage(error)); },
      );
    }
    try {
      const activities = await apiRequest<Quest[]>("/quests", { signal });
      if (!signal.aborted) setQuests(activities);
    } catch (error) {
      if (signal.aborted) return;
      setIsError(true);
      setMessage(getErrorMessage(error));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    if (!needsWorkshop) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadData();
    }
    return () => request.current?.abort();
  }, [needsWorkshop, loadData]);

  const workshopsByQuest = useMemo(() => {
    const sources = new Map<string, QuestWorkshopSource[]>();
    for (const workshop of workshops ?? []) {
      if (workshop.archived) continue;
      for (const activity of workshop.activities) {
        const activityWorkshops = sources.get(activity.activity_id) ?? [];
        activityWorkshops.push({ id: workshop.id, name: workshop.name, sharedAt: activity.added_at });
        sources.set(activity.activity_id, activityWorkshops);
      }
    }
    return sources;
  }, [workshops]);
  const scopedQuests = useMemo(() => language ? quests.filter((quest) => quest.language === language) : quests,
    [language, quests]);
  const nextQuest = scopedQuests.find((quest) => !quest.is_completed);
  // Interactive selection state (Von Restorff + Direct Manipulation)
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  // Click outside the quest controls to clear the card selection.
  useEffect(() => {
    if (isStudent) return;
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
  }, [isStudent]);

  // Filter quests by category (URL parameter), status filter, and search query
  const filteredQuests = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    // "4" or "#4" finds quest #4 exactly, rather than every title that contains a 4.
    const searchedNumber = /^#?\d+$/.test(normalizedSearch) ? Number(normalizedSearch.replace("#", "")) : null;
    return scopedQuests.filter((quest) => {
      // Status filter
      const matchesStatus =
        questFilter === "all" ||
        (questFilter === "completed" && quest.is_completed) ||
        (questFilter === "next" && !quest.is_completed);

      // Search filter
      const matchesSearch = selectedConcept !== null
        ? quest.topic_concept === selectedConcept
        : searchedNumber !== null ? questNumber(quest) === searchedNumber
        : !normalizedSearch || `${quest.title ?? ""} ${quest.topic_concept} ${quest.activity_type} ${workshopsByQuest.get(quest.id)?.map(({ name }) => name).join(" ") ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch && activityDateMatches(quest.added_at, dateRange.from, dateRange.to);
    });
  }, [scopedQuests, questFilter, search, selectedConcept, dateRange, workshopsByQuest]);

  const visibleQuests = filteredQuests.filter((quest) => category === "code-challenge"
    ? quest.activity_type === "challenge" : category === "lessons-review"
      ? quest.activity_type === "quiz" : true);
  const hasFilters = Boolean(category || language || selectedConcept || search.trim() || questFilter !== "all" || dateRange.from || dateRange.to);
  if (selectedQuestId && !visibleQuests.some((quest) => quest.id === selectedQuestId)) setSelectedQuestId(null);

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
    clearConcept(query);
    router.push(query.size ? pathname + "?" + query : pathname, { scroll: false });
  }

  function clearConcept(query: URLSearchParams) {
    query.delete("concept");
  }

  if (needsWorkshop) {
    return <section className="empty-state quest-filter-empty">
      <h2>Join a workshop to see its activities</h2>
      <p>Enter the join code your instructor gave you. Its coding challenges and quizzes appear here, in any language.</p>
      <Link className="button button-primary" href="/workshops">Go to Workshops</Link>
    </section>;
  }
  if (isError || (isStudent && workshopError !== null)) {
    return <section className="panel">
      <p role="alert">{isError ? message : workshopError}</p>
      <button type="button" className="button button-outline" onClick={() => void loadData()}>Retry</button>
    </section>;
  }
  if (loading || (isStudent && workshops === null)) {
    return <section className="panel" role="status">Loading quest map…</section>;
  }
  if (isStudent && !quests.length) {
    return <section className="empty-state quest-filter-empty">
      <h2>No Workshop activities yet</h2>
      <p>When your instructor shares an activity in a Workshop you’ve joined, it appears here once it opens.</p>
      <Link className="button button-primary" href="/workshops">Go to Workshops</Link>
    </section>;
  }
  if (!quests.length) {
    return <section className="empty-state quest-filter-empty">
      <h2>No published activities yet</h2>
      <p>Check again after your instructor publishes an activity.</p>
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
                    clearConcept(query);
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
        <div className="quest-grid-expanded activity-preview-list">
          {visibleQuests.map((quest) => <QuestCard
            key={quest.id}
            quest={quest}
            sourceWorkshops={isStudent ? workshopsByQuest.get(quest.id) ?? [] : undefined}
            learner={isStudent}
            next={isStudent && quest.id === nextQuest?.id && !quest.is_completed}
            selected={quest.id === selectedQuestId}
            onSelect={() => setSelectedQuestId(quest.id)}
            onOpen={isStudent ? () => router.push(questHref(quest)) : undefined}
            preview={isStudent && quest.id === selectedQuestId && (quest.activity_type === "challenge" || quest.activity_type === "quiz") && (
              <ActivityPerformancePreview kind={quest.activity_type} activityId={quest.id} title={quest.title || quest.topic_concept}
                details={{ number: questNumber(quest), topic: quest.topic_concept, difficulty: quest.difficulty_level,
                  xp: quest.xp_reward, closesAt: quest.closes_at, isClosed: quest.is_closed }}
                onClose={() => setSelectedQuestId(null)} />
            )}
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
