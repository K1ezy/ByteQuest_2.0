"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useShellProfile } from "@/components/app-shell";
import type { ProgrammingLanguage, Quest, QuestGroup } from "@/lib/types";

type QuestStatusFilter = "all" | "next" | "completed";

function getBriefDescription(quest: Quest): string {
  if (quest.problem_statement) {
    const firstPara = quest.problem_statement.split(/\n\s*\n/)[0]?.trim() || "";
    const cleanText = firstPara.replace(/[#*`_~]/g, "").replace(/\s+/g, " ").trim();
    if (cleanText.length > 150) {
      return `${cleanText.slice(0, 147)}…`;
    }
    return cleanText;
  }
  return quest.activity_type === "quiz"
    ? `Practice and test your understanding of ${quest.topic_concept} with focused concept questions.`
    : `Implement a solution for ${quest.topic_concept} and verify your code with automated test cases.`;
}

function QuestsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profile = useShellProfile();
  const workshops = pathname === "/workshops";
  const categoryParam = searchParams.get("category"); // "code-challenge" | "lessons-review" | null
  const groupParam = workshops ? searchParams.get("group") : null;
  const [quests, setQuests] = useState<Quest[]>([]);
  const [groups, setGroups] = useState<QuestGroup[]>([]);
  const [groupError, setGroupError] = useState("");
  const [actionMode, setActionMode] = useState<"create" | "join" | "add" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupLanguage, setNewGroupLanguage] = useState<ProgrammingLanguage>(profile.enrolled_language);
  const [joinCode, setJoinCode] = useState("");
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [questFilter, setQuestFilter] = useState<QuestStatusFilter>("all");
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setIsError(false);
    setMessage("");
    try {
      const [questResult, groupResult] = await Promise.allSettled([
        apiRequest<Quest[]>("/quests"),
        workshops ? apiRequest<QuestGroup[]>("/quest-groups") : Promise.resolve([]),
      ]);
      if (questResult.status === "rejected") throw questResult.reason;
      setQuests(questResult.value);
      if (groupResult.status === "fulfilled") {
        setGroups(groupResult.value);
        setGroupError("");
      } else setGroupError(getErrorMessage(groupResult.reason));
    } catch (error) {
      setIsError(true);
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [workshops]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const completedCount = quests.filter((quest) => quest.is_completed).length;
  const nextQuest = quests.find((quest) => !quest.is_completed);
  const progressPercent = quests.length
    ? Math.round((completedCount / quests.length) * 100)
    : 0;
  const selectedGroup = groups.find((group) => group.id === groupParam);
  const canCreateQuest = profile?.role === "instructor" || profile?.role === "admin";
  const isStudent = profile?.role === "student";

  // Interactive selection state (Von Restorff + Direct Manipulation)
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  // Click whitespace/background to remove green highlight from cards
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
      if (groupParam && (!selectedGroup || !selectedGroup.activity_ids.includes(quest.id))) {
        return false;
      }
      // Status filter
      const matchesStatus =
        questFilter === "all" ||
        (questFilter === "completed" && quest.is_completed) ||
        (questFilter === "next" && !quest.is_completed);

      // Search filter
      const matchesSearch =
        !normalizedSearch ||
        `${quest.title ?? ""} ${quest.topic_concept} ${quest.activity_type}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [quests, groupParam, selectedGroup, questFilter, search]);

  const challengeCount = filteredQuests.filter((quest) => quest.activity_type === "challenge").length;
  const visibleQuests = filteredQuests.filter((quest) => categoryParam === "code-challenge"
    ? quest.activity_type === "challenge" : categoryParam === "lessons-review"
      ? quest.activity_type === "quiz" : true);

  // Keyboard navigation & activation (Enter launches selected card; arrows navigate grid)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (actionMode) {
        if (e.key === "Escape") setActionMode(null);
        return;
      }
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
          const targetUrl =
            targetQuest.activity_type === "challenge"
              ? `/arena/${targetQuest.id}`
              : `/quiz/${targetQuest.id}`;
          router.push(targetUrl);
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
  }, [selectedQuestId, visibleQuests, router, isStudent, actionMode]);

  function openAction(mode: "create" | "join" | "add") {
    setActionMode(mode);
    setActionError("");
    setSelectedActivityIds([]);
  }

  function handleCategorySelect(category: string) {
    const query = new URLSearchParams(searchParams);
    if (category) query.set("category", category);
    else query.delete("category");
    router.push(query.size ? pathname + "?" + query : pathname, { scroll: false });
  }

  async function copyInviteCode() {
    if (!selectedGroup?.join_code) return;
    try {
      await navigator.clipboard.writeText(selectedGroup.join_code);
      setCopiedGroupId(selectedGroup.id);
      setCopyError("");
    } catch {
      setCopiedGroupId(null);
      setCopyError("Could not copy the code. Select it above and copy it manually.");
    }
  }

  async function submitQuestAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionMode === "create" && !canCreateQuest) return;
    setActionBusy(true);
    setActionError("");
    try {
      let updatedGroup: QuestGroup;
      if (actionMode === "create") {
        updatedGroup = await apiRequest<QuestGroup>("/quest-groups", {
          method: "POST",
          body: JSON.stringify({
            name: newGroupName.trim(),
            description: newGroupDescription.trim() || null,
            language: newGroupLanguage,
            activity_ids: selectedActivityIds,
          }),
        });
        setNewGroupName("");
        setNewGroupDescription("");
      } else if (actionMode === "join") {
        updatedGroup = await apiRequest<QuestGroup>("/quest-groups/join", {
          method: "POST",
          body: JSON.stringify({ code: joinCode.trim() }),
        });
        setJoinCode("");
      } else if (actionMode === "add" && selectedGroup) {
        updatedGroup = await apiRequest<QuestGroup>(`/quest-groups/${selectedGroup.id}/activities`, {
          method: "POST",
          body: JSON.stringify({ activity_ids: selectedActivityIds }),
        });
      } else {
        return;
      }
      setGroups((current) => [updatedGroup, ...current.filter((group) => group.id !== updatedGroup.id)]);
      setActionMode(null);
      setSelectedActivityIds([]);
      router.push(`/workshops?group=${updatedGroup.id}`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setActionBusy(false);
    }
  }

  const availableActivities = quests.filter((quest) =>
    actionMode === "add" && selectedGroup
      ? quest.language === selectedGroup.language && !selectedGroup.activity_ids.includes(quest.id)
      : quest.language === newGroupLanguage,
  );

  return (
    <div className="bq-quest-page">
      {loading ? <section className="panel" role="status">Loading {workshops ? "workshops" : "quest map"}…</section>
      : isError ? <section className="panel"><p role="alert">{message}</p><button type="button" className="button button-outline" onClick={() => void loadData()}>Retry</button></section>
      : (
        <div className="quests-workspace-expanded qm-panel" id="quest-groups">
          <div className="qm-panel-heading">
            <div>
              <h1>{selectedGroup?.name || (workshops ? "Workshops" : "Quest Map")}</h1>
              <p>{selectedGroup ? `${selectedGroup.language.toUpperCase()} · ${selectedGroup.member_count} members · ${selectedGroup.activity_ids.length} activities` : workshops ? "Join a workshop or open one you already belong to." : "Explore the published activities in your track."}</p>
            </div>
          </div>
          {(!workshops || selectedGroup || groups.length > 0 || groupError) && (isStudent || canCreateQuest) &&
            <button type="button" className="button button-outline" onClick={() => openAction(isStudent ? "join" : "create")}>{isStudent ? "Join Workshop" : "Create Workshop"}</button>}
          {groupError && <p className="notice warning" role="status">Quest groups are unavailable: {groupError}</p>}
          {selectedGroup && <div className="qm-group-info">
            {selectedGroup.description && <p>{selectedGroup.description}</p>}
            {selectedGroup.join_code && <div className="qm-code-row">
              <span>Invite code: <strong className="qm-invite-code">{selectedGroup.join_code}</strong></span>
              <button type="button" className="qm-code-copy" data-tooltip="Copy this code to invite learners to the quest." onClick={() => void copyInviteCode()}>Copy code</button>
              {copiedGroupId === selectedGroup.id && <span className="qm-code-status" role="status">Copied!</span>}
            </div>}
            {copyError && <p className="qm-code-error" role="alert">{copyError}</p>}
            <div className="qm-group-actions">
              <Link href="/workshops">← All workshops</Link>
              {selectedGroup.is_owner && <button type="button" onClick={() => openAction("add")}>+ Add published activities</button>}
            </div>
          </div>}
          {workshops && !selectedGroup && groups.length > 0 && <div className="qm-groups-grid">
            {groups.map((group) => <Link href={`/workshops?group=${group.id}`} className="qm-group-card" key={group.id}>
              <span className="qm-group-symbol" aria-hidden="true">✦</span>
              <strong>{group.name}</strong>
              <span>{group.language.toUpperCase()} · {group.activity_ids.length} activities · {group.member_count} members</span>
            </Link>)}
          </div>}
          {workshops && !groupError && !groupParam && groups.length === 0 && <div className="qm-empty-hero">
            <Image src="/illustrations/quest-scroll-purple.png" alt="Purple quest scroll and black feather" width={220} height={220} priority />
            <h2>No workshops yet</h2>
            <p>{canCreateQuest ? "Create a workshop to group published activities." : "Use the code shared by your instructor."}</p>
            <div className="qm-empty-actions">
              {canCreateQuest && <button type="button" className="qm-empty-action" data-tooltip="Like Google Classroom: create a workshop space that students join with a code." onClick={() => openAction("create")}>Create Workshop</button>}
              {isStudent && <button type="button" className="qm-empty-action" data-tooltip="Like Google Classroom: join a workshop using the code your instructor shared." onClick={() => openAction("join")}>Join Workshop</button>}
            </div>
          </div>}
          {message && (
            <p className={`notice ${isError ? "error" : ""}`} role="status">
              {message}
            </p>
          )}

          {workshops && groupParam && !selectedGroup && !groupError && <p role="status">This workshop is unavailable. <Link href="/workshops">Back to workshops</Link></p>}
          {(!workshops || selectedGroup) && (
          <>
          {quests.length === 0 || (selectedGroup && selectedGroup.activity_ids.length === 0) ? (
            selectedGroup ? <div className="qm-activity-empty">
              <p>No published activities are in this quest yet.</p>
              {selectedGroup.is_owner && <button className="qm-add-link" type="button" onClick={() => openAction("add")}>Add an activity</button>}
            </div> : <section className="empty-state quest-filter-empty">
              <h2>No published activities yet</h2>
              <p>Check again after your instructor publishes an activity for your track.</p>
            </section>
          ) : (
            <>
              {/* Track Progress Banner */}
              {isStudent && <section className="panel quest-progress" aria-label="Quest progress">
                <div className="quest-progress-heading">
                  <div>
                    <p className="eyebrow-label">TRACK PROGRESS</p>
                    <h2>
                      {completedCount} of {quests.length} quests complete
                    </h2>
                  </div>
                  <span className="quest-progress-percent">{progressPercent}%</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Quest completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                >
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="quest-progress-next">
                  {nextQuest ? (
                    <>
                      Up next: <strong>{nextQuest.title || nextQuest.topic_concept}</strong>
                    </>
                  ) : (
                    "You’ve completed every quest in this track."
                  )}
                </p>
              </section>}

              {/* Toolbar: Search, Status Filters & Leaderboard Link */}
              <div className="quest-toolbar">
                <label className="quest-search">
                  <span className="sr-only">Search quests</span>
                  <input
                    ref={searchInput}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search quests or concepts"
                    type="search"
                  />
                </label>
                <div className="quest-filters" role="group" aria-label="Activity type">
                  {([["", "All", filteredQuests.length], ["code-challenge", "Code Challenges", challengeCount],
                    ["lessons-review", "Concept Checks", filteredQuests.length - challengeCount]] as const).map(([value, label, count]) => (
                    <button type="button" key={value} className={`filter-button${(categoryParam || "") === value ? " selected" : ""}`}
                      aria-pressed={(categoryParam || "") === value} onClick={() => handleCategorySelect(value)}>{label} ({count})</button>
                  ))}
                </div>
                {isStudent && <div className="quest-filters" role="group" aria-label="Filter quests">
                  {(["all", "next", "completed"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`filter-button${questFilter === filter ? " selected" : ""}`}
                      aria-pressed={questFilter === filter}
                      onClick={() => setQuestFilter(filter)}
                    >
                      {filter === "all"
                        ? `All ${quests.length}`
                        : filter === "next"
                        ? `To do ${quests.length - completedCount}`
                        : `Done ${completedCount}`}
                    </button>
                  ))}
                </div>}
              </div>

              {/* Quest Card Grid: Decluttered, balanced 2-column layout */}
              {visibleQuests.length === 0 ? (
                <div className="empty-state quest-filter-empty">
                  <h2>No quests match that view</h2>
                  <p>Try another filter or a different search term.</p>
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => {
                      setQuestFilter("all");
                      setSearch("");
                      if (categoryParam) handleCategorySelect("");
                    }}
                  >
                    Show all quests
                  </button>
                </div>
              ) : (
                <div className="quest-grid-expanded">
                  {visibleQuests.map((quest) => {
                    const isNext = isStudent && quest.id === nextQuest?.id && !quest.is_completed;
                    const isHighlighted = quest.id === selectedQuestId;
                    const cleanTopicCategory = quest.topic_concept.includes(":")
                      ? quest.topic_concept.split(":")[0].trim()
                      : quest.topic_concept.length > 28
                      ? `${quest.topic_concept.slice(0, 26)}…`
                      : quest.topic_concept;

                    return (
                      <article
                        className={`quest-card ${isHighlighted ? "is-selected-card" : ""}`}
                        id={`quest-${quest.id}`}
                        key={quest.id}
                        tabIndex={0}
                        role="region"
                        onClick={() => setSelectedQuestId(quest.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && isStudent) {
                            e.preventDefault();
                            const url =
                              quest.activity_type === "challenge"
                                ? `/arena/${quest.id}`
                                : `/quiz/${quest.id}`;
                            router.push(url);
                          }
                        }}
                      >
                        <div className="quest-card-body">
                          <div className="quest-card-head">
                            <div className="quest-card-badges">
                              <span className="tag">
                                {quest.activity_type === "quiz"
                                  ? "CONCEPT CHECK"
                                  : "CODE CHALLENGE"}
                              </span>
                              {isNext && (
                                <span className="next-badge" aria-label="Next recommended quest">
                                  <span className="status-dot pulsing" aria-hidden="true" /> NEXT UP
                                </span>
                              )}
                              {quest.is_completed && (
                                <span className="completion">✓ Complete</span>
                              )}
                            </div>
                            {/* Miller's Law: Chunk metadata into at most 3 scannable pills */}
                            <div className="quest-meta">
                              <span className="tag" title={quest.topic_concept}>{cleanTopicCategory}</span>
                              <span className="tag">Difficulty {quest.difficulty_level}</span>
                              <span className="tag xp">✦ {quest.xp_reward} XP</span>
                            </div>
                          </div>

                          <h2>{quest.title || quest.topic_concept}</h2>
                          <p className="quest-card-desc">{getBriefDescription(quest)}</p>
                        </div>

                        <div className="quest-card-actions">
                          <span className="quest-instructions-hint">
                            {quest.activity_type === "challenge"
                              ? "Full instructions & test cases open in arena"
                              : "Questions & explanations open in quiz"}
                          </span>
                          {isStudent && (quest.activity_type === "challenge" ? (
                            <Link
                              className={`button ${
                                isNext
                                  ? "button-primary"
                                  : quest.is_completed
                                  ? "button-outline"
                                  : "button-primary"
                              }`}
                              href={`/arena/${quest.id}`}
                            >
                              {quest.is_completed
                                ? "Practice again"
                                : isNext
                                ? "Start next challenge →"
                                : "Start challenge →"}
                            </Link>
                          ) : (
                            <Link
                              className={`button ${
                                isNext
                                  ? "button-primary"
                                  : quest.is_completed
                                  ? "button-outline"
                                  : "button-primary"
                              }`}
                              href={`/quiz/${quest.id}`}
                            >
                              {quest.is_completed
                                ? "Review quiz"
                                : isNext
                                ? "Start next quiz →"
                                : "Start quiz →"}
                            </Link>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
          </>)}
        </div>
      )}
      {actionMode && <div className="qm-dialog-backdrop" onMouseDown={() => setActionMode(null)}>
        <section className="qm-dialog" role="dialog" aria-modal="true" aria-labelledby="qm-dialog-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") setActionMode(null); }}>
          <div className="qm-dialog-heading">
            <h2 id="qm-dialog-title">{actionMode === "create" ? "Create Workshop" : actionMode === "join" ? "Join Workshop" : "Add activities"}</h2>
            <button type="button" className="qm-icon-button" aria-label="Close dialog" data-tooltip="Close this quest dialog." onClick={() => setActionMode(null)}>×</button>
          </div>
          <form onSubmit={(event) => void submitQuestAction(event)}>
            {actionMode === "create" && !canCreateQuest && <p className="qm-dialog-note">You can preview workshop creation here. Saving a workshop currently requires Instructor or Administrator access.</p>}
            {actionMode === "create" && <>
              <label>Workshop name<input autoFocus required minLength={3} maxLength={80} value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="e.g. Python Fundamentals" /></label>
              <label>Description <span>(optional)</span><textarea maxLength={500} rows={2} value={newGroupDescription} onChange={(event) => setNewGroupDescription(event.target.value)} placeholder="What will members learn?" /></label>
              <label>Language<select value={newGroupLanguage} onChange={(event) => { setNewGroupLanguage(event.target.value as ProgrammingLanguage); setSelectedActivityIds([]); }}><option value="python">Python</option><option value="cpp">C++</option><option value="java">Java</option></select></label>
            </>}
            {actionMode === "join" && <>
              <p>Enter the 8-character code shared by the workshop creator.</p>
              <label>Workshop code<input autoFocus required minLength={8} maxLength={12} autoCapitalize="characters" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABCD2345" /></label>
            </>}
            {(actionMode === "create" || actionMode === "add") && <fieldset className="qm-activity-picker">
              <legend>Published activities {actionMode === "create" ? "(optional)" : "to add"}</legend>
              {availableActivities.length ? availableActivities.map((quest) => <label key={quest.id} className="qm-activity-option">
                <input type="checkbox" checked={selectedActivityIds.includes(quest.id)} onChange={(event) => setSelectedActivityIds((current) => event.target.checked ? [...current, quest.id] : current.filter((id) => id !== quest.id))} />
                <span>{quest.title || quest.topic_concept}<small>{quest.activity_type === "challenge" ? "Code challenge" : "Quiz"} · {quest.language.toUpperCase()}</small></span>
              </label>) : <p>No published activities are available in this language yet. You can add them after publishing in Instructor Studio.</p>}
            </fieldset>}
            {actionError && <p className="qm-dialog-error" role="alert">{actionError}</p>}
            <div className="qm-dialog-actions">
              <button type="button" className="qm-text-action" onClick={() => setActionMode(null)}>Cancel</button>
              <button type="submit" className="qm-primary-action" disabled={actionBusy || (actionMode === "create" && !canCreateQuest) || (actionMode === "add" && selectedActivityIds.length === 0)}>{actionBusy ? "Saving…" : actionMode === "create" ? "Create Workshop" : actionMode === "join" ? "Join Workshop" : "Add activities"}</button>
            </div>
          </form>
        </section>
      </div>}
    </div>
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
