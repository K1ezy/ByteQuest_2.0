"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { AccessibilitySettings } from "@/components/accessibility-settings";
import { ActivityHubView } from "@/components/activity-hub-view";
import { FacultyView } from "@/components/faculty-view";
import { JourneyView } from "@/components/journey-view";
import { useSignOut } from "@/hooks/use-sign-out";
import { QuestNavIcon } from "@/components/workspace/quest-nav-icon";
import type { Profile, ProgrammingLanguage, Quest, QuestGroup } from "@/lib/types";

interface LeaderboardEntry {
  pseudonym_id: string;
  xp_points: number;
  current_level: number;
  is_me: boolean;
}

type QuestStatusFilter = "all" | "next" | "completed";

function formatPseudonym(name?: string | null, maxLen = 14): string {
  if (!name) return "Learner";
  if (name.length <= maxLen) return name;
  return `${name.slice(0, 8)}...${name.slice(-4)}`;
}

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
  const { isSigningOut, error: signOutError, signOut } = useSignOut();
  const categoryParam = searchParams.get("category"); // "code-challenge" | "lessons-review" | null
  const viewParam = searchParams.get("view"); // "leaderboard" | "accessibility" | "journey" | "faculty" | "activity-hub" | null
  const groupParam = searchParams.get("group");
  const isLeaderboardView = viewParam === "leaderboard";
  const isAccessibilityView = viewParam === "accessibility";
  const isJourneyView = viewParam === "journey";
  const isFacultyView = viewParam === "faculty";
  const isActivityHubView = viewParam === "activity-hub";
  const isHubView =
    isAccessibilityView ||
    isJourneyView ||
    isFacultyView ||
    isActivityHubView;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [groups, setGroups] = useState<QuestGroup[]>([]);
  const [groupError, setGroupError] = useState("");
  const [actionMode, setActionMode] = useState<"create" | "join" | "add" | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isMobileRail, setIsMobileRail] = useState<boolean | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupLanguage, setNewGroupLanguage] = useState<ProgrammingLanguage>("python");
  const [joinCode, setJoinCode] = useState("");
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [questFilter, setQuestFilter] = useState<QuestStatusFilter>("all");
  const [search, setSearch] = useState("");

  const isSidebarVisible =
    isMobileRail === null
      ? undefined
      : isMobileRail
      ? sidebarHidden
      : !sidebarHidden;

  const loadData = useCallback(async () => {
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) {
        setHasSession(false);
        setMessage("Sign in to see your quest map.");
        return;
      }
      setHasSession(true);
      const me = await apiRequest<Profile>("/profile/me");
      setProfile(me);
      setNewGroupLanguage(me.enrolled_language);

      const [questResult, leaderboardResult, groupResult] = await Promise.allSettled([
        apiRequest<Quest[]>("/quests"),
        apiRequest<LeaderboardEntry[]>("/quests/leaderboard"),
        apiRequest<QuestGroup[]>("/quest-groups"),
      ]);

      if (questResult.status === "rejected") throw questResult.reason;
      setQuests(questResult.value);

      if (groupResult.status === "fulfilled") {
        setGroups(groupResult.value);
        setGroupError("");
      } else {
        setGroupError(getErrorMessage(groupResult.reason));
      }

      if (leaderboardResult.status === "fulfilled") {
        setLeaders(leaderboardResult.value);
        setLeaderboardError("");
      } else {
        setLeaderboardError(getErrorMessage(leaderboardResult.reason));
      }
    } catch (error) {
      setIsError(true);
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // The same hamburger controls two presentations: a collapsible rail on
  // desktop and an off-canvas drawer on mobile. Track the breakpoint so
  // aria-expanded describes what is actually visible.
  useEffect(() => {
    const query = window.matchMedia("(max-width: 850px)");
    const syncRailMode = () => setIsMobileRail(query.matches);
    syncRailMode();
    query.addEventListener("change", syncRailMode);
    return () => query.removeEventListener("change", syncRailMode);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

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
  const visibleQuests = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return quests.filter((quest) => {
      if (groupParam && (!selectedGroup || !selectedGroup.activity_ids.includes(quest.id))) {
        return false;
      }
      // Category filter from drawer
      if (categoryParam === "code-challenge" && quest.activity_type !== "challenge") {
        return false;
      }
      if (categoryParam === "lessons-review" && quest.activity_type !== "quiz") {
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
  }, [quests, groupParam, selectedGroup, categoryParam, questFilter, search]);

  const activeCategoryTitle =
    categoryParam === "code-challenge"
      ? "Code Challenges"
      : categoryParam === "lessons-review"
      ? "Lessons Review"
      : null;

  // Keyboard navigation & activation (Enter launches selected card; arrows navigate grid)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (actionMode) {
        if (e.key === "Escape") setActionMode(null);
        return;
      }
      // Hub views are settings/content workspaces, so do not hijack their
      // arrow-key scrolling or Enter activation for quest cards.
      if (isHubView) return;
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
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedQuestId((currentId) => {
            if (!currentId) return visibleQuests[0].id;
            const idx = visibleQuests.findIndex((q) => q.id === currentId);
            const nextIdx = (idx + 1) % visibleQuests.length;
            return visibleQuests[nextIdx].id;
          });
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
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
  }, [selectedQuestId, visibleQuests, router, isStudent, actionMode, isHubView]);

  function openAction(mode: "create" | "join" | "add") {
    setActionMode(mode);
    setActionMenuOpen(false);
    setActionError("");
    setSelectedActivityIds([]);
  }

  function handleCategorySelect(category: string) {
    closeMobileSidebar();
    if (category) {
      router.push(`/quests?category=${category}`);
    } else {
      router.push("/quests");
    }
  }

  function closeMobileSidebar() {
    // The off-canvas rail should close after navigation on mobile. On desktop
    // the hamburger remains the learner's explicit show/hide control.
    if (isMobileRail) {
      setSidebarHidden(false);
    }
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
      router.push(`/quests?group=${updatedGroup.id}`);
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
    <div className="quest-map-page">
      <header className="qm-topbar">
        <button className="qm-icon-button" type="button" aria-label="Toggle quest menu" data-tooltip="Show or hide Quest Map navigation." aria-expanded={isSidebarVisible} aria-controls="quest-map-navigation" onClick={() => setSidebarHidden((hidden) => !hidden)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <Link href="/quests" className="qm-brand" data-tooltip="Return to the Quest Map overview.">
          <Image src="/branding/ByteQuest_websitelogo.svg" alt="" width={36} height={36} />
          <span>Quest Map</span>
        </Link>
        <div className="qm-top-actions">
          <div className="qm-add-wrap">
            <button className="qm-icon-button qm-add-button" type="button" aria-label="Quest actions" data-tooltip={canCreateQuest ? "Create a quest group or join one with a code." : "Preview quest creation or join one with a code."} aria-expanded={actionMenuOpen} onClick={() => setActionMenuOpen((open) => !open)}>+</button>
            {actionMenuOpen && <div className="qm-action-menu">
              <button type="button" onClick={() => openAction("create")}>Create Quest</button>
              <button type="button" onClick={() => openAction("join")}>Join Quest</button>
            </div>}
          </div>
          {hasSession && profile ? (
            <div className="ws-account" ref={accountRef}>
              <button
                type="button"
                className="qm-avatar ws-avatar-button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label={`Account menu for ${profile.display_name || profile.pseudonym_id}`}
                onClick={() => setAccountOpen((open) => !open)}
              >
                {(profile.display_name || profile.pseudonym_id).slice(0, 1).toUpperCase()}
              </button>
              {accountOpen && (
                <div className="ws-account-menu" role="menu">
                  <div className="ws-account-identity">
                    <strong>{profile.display_name || profile.pseudonym_id}</strong>
                    <span>{profile.role === "admin" ? "Administrator" : profile.role === "instructor" ? "Faculty" : "Student"}</span>
                  </div>
                  <Link role="menuitem" href="/quests?view=accessibility" onClick={() => setAccountOpen(false)}>
                    Accessibility settings
                  </Link>
                  <Link role="menuitem" href="/quests" onClick={() => setAccountOpen(false)}>
                    Student Quest Map
                  </Link>
                  <button role="menuitem" type="button" disabled={isSigningOut} onClick={() => void signOut()}>
                    {isSigningOut ? "Signing out…" : "Sign out"}
                  </button>
                  {signOutError && <p className="ws-account-error" role="alert">{signOutError}</p>}
                </div>
              )}
            </div>
          ) : (
            <span className="qm-avatar" aria-hidden="true">B</span>
          )}
        </div>
      </header>
      <div className={`qm-layout${sidebarHidden ? " is-sidebar-collapsed" : ""}`}>
        <aside id="quest-map-navigation" className={`qm-sidebar${sidebarHidden ? " is-open" : ""}`} aria-label="Quest navigation">
          <nav>
            <Link
              className={!categoryParam && !groupParam && !isLeaderboardView && !isHubView ? "is-active" : ""}
              href="/quests"
              data-tooltip="See your quest groups and published activities."
              aria-current={!categoryParam && !groupParam && !isLeaderboardView && !isHubView ? "page" : undefined}
              onClick={closeMobileSidebar}
            >
              <QuestNavIcon name="home" /> Quest Map
            </Link>
            <Link className={categoryParam === "code-challenge" ? "is-active" : ""} href="/quests?category=code-challenge" data-tooltip="Find hands-on programming challenges." aria-current={categoryParam === "code-challenge" ? "page" : undefined} onClick={closeMobileSidebar}><QuestNavIcon name="code" /> Code Challenges</Link>
            <Link className={categoryParam === "lessons-review" ? "is-active" : ""} href="/quests?category=lessons-review" data-tooltip="Review lessons with concept quizzes." aria-current={categoryParam === "lessons-review" ? "page" : undefined} onClick={closeMobileSidebar}><QuestNavIcon name="review" /> Lessons Review</Link>
            <Link
              className={isLeaderboardView ? "is-active" : ""}
              href="/quests?view=leaderboard"
              data-tooltip="Compare XP and levels with learners in your track."
              aria-current={isLeaderboardView ? "page" : undefined}
              onClick={closeMobileSidebar}
            >
              <QuestNavIcon name="leaderboard" /> Leaderboard
            </Link>
            <Link
              className={isAccessibilityView ? "is-active" : ""}
              href="/quests?view=accessibility"
              data-tooltip="Adjust contrast, typography, motion, and assistive navigation."
              aria-current={isAccessibilityView ? "page" : undefined}
              onClick={closeMobileSidebar}
            >
              <QuestNavIcon name="accessibility" />
              Accessibility
            </Link>
            <Link
              className={isJourneyView ? "is-active" : ""}
              href="/quests?view=journey"
              data-tooltip="Open your level, XP, badges, recommendations, and submissions."
              aria-current={isJourneyView ? "page" : undefined}
              onClick={closeMobileSidebar}
            >
              <QuestNavIcon name="person" />
              Your Journey
            </Link>
            <Link
              className={isFacultyView ? "is-active" : ""}
              href={profile?.role === "instructor" ? "/faculty" : profile?.role === "admin" ? "/admin" : "/quests?view=faculty"}
              data-tooltip={profile?.role === "instructor" ? "Open your faculty workspace." : profile?.role === "admin" ? "Open the administration workspace." : "Open Instructor Studio for faculty publishing tools."}
              aria-current={isFacultyView ? "page" : undefined}
              onClick={closeMobileSidebar}
            >
              <QuestNavIcon name="faculty" />
              {profile?.role === "admin" ? "Administration" : "Faculty & Instructor"}
            </Link>
            <Link
              className={isActivityHubView ? "is-active" : ""}
              href="/quests?view=activity-hub"
              data-tooltip="Choose between coding challenges and lessons review."
              aria-current={isActivityHubView ? "page" : undefined}
              onClick={closeMobileSidebar}
            >
              <QuestNavIcon name="grid" />
              Activity Hub
            </Link>
            <Link
              className={pathname === "/chat" ? "is-active" : ""}
              href="/chat"
              data-tooltip="Ask the learning assistant for concept explanations and hints."
              aria-current={pathname === "/chat" ? "page" : undefined}
              onClick={closeMobileSidebar}
            >
              <QuestNavIcon name="chat" />
              Chat Assistant
            </Link>
          </nav>
        </aside>
        <div className="qm-content">
          {/* Leaderboard page heading keeps the existing focused-view hierarchy. */}
          {isLeaderboardView && <div className="page-heading">
            <div>
              <p className="eyebrow-label">QUEST MAP</p>
              <h1>Language Leaderboard</h1>
              <p>
                Compare XP progress with peers in your language track using privacy-safe pseudonyms.
              </p>
            </div>
          </div>}

          {isAccessibilityView ? (
            <AccessibilitySettings />
          ) : isJourneyView ? (
            <JourneyView />
          ) : isFacultyView ? (
            <FacultyView />
          ) : isActivityHubView ? (
            <ActivityHubView
              currentCategory={categoryParam}
              onSelectCategory={handleCategorySelect}
            />
          ) : loading ? (
        <section className="panel" role="status">
          Loading your quest map…
        </section>
      ) : message && quests.length === 0 ? (
        <section className="panel">
          <p className={`notice ${isError ? "error" : ""}`} role="status">
            {message}
          </p>
          <Link className="button button-primary" href="/onboarding">
            Sign in or choose a track
          </Link>
        </section>
      ) : isLeaderboardView ? (
        /* Focused leaderboard view within the shared Quest Map workspace */
        <div className="leaderboard-full-view">
          <div className="leaderboard-header-row">
            <div>
              <p className="eyebrow-label">TRACK RANKINGS</p>
              <h2>Top learners in {profile?.enrolled_language.toUpperCase() || "your"} track</h2>
              <p className="leaderboard-desc">
                Earn XP by completing coding challenges and answering concept quizzes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/quests")}
              className="button button-outline"
            >
              ← Back to Quest map
            </button>
          </div>

          <section className="panel leaderboard-panel" aria-label="Leaderboard rankings">
            {leaderboardError ? (
              <p className="notice warning">{leaderboardError}</p>
            ) : leaders.length === 0 ? (
              <p className="muted">No leaderboard entries yet.</p>
            ) : (
              <div className="leaderboard-table-container">
                <div className="leaderboard-table-head">
                  <span className="col-rank">Rank</span>
                  <span className="col-learner">Learner</span>
                  <span className="col-level">Level</span>
                  <span className="col-xp">Experience</span>
                </div>
                <div className="leaderboard-table-rows">
                  {leaders.map((entry, index) => {
                    const isTopThree = index < 3;
                    return (
                      <div
                        className={`leader-row-card ${entry.is_me ? "is-current-user" : ""} ${
                          isTopThree ? `rank-top-${index + 1}` : ""
                        }`}
                        key={entry.pseudonym_id}
                      >
                        <span className={`leader-rank-badge ${isTopThree ? "top-rank" : ""}`}>
                          {index === 0
                            ? "🥇 01"
                            : index === 1
                            ? "🥈 02"
                            : index === 2
                            ? "🥉 03"
                            : String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="leader-identity">
                          <span className="leader-name-tag" title={entry.pseudonym_id}>
                            {formatPseudonym(entry.pseudonym_id, 16)}
                          </span>
                          {entry.is_me && <span className="leader-you-pill">YOU</span>}
                        </div>
                        <span className="leader-level-pill">Level {entry.current_level}</span>
                        <span className="leader-xp-highlight">{entry.xp_points} XP</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="divider" style={{ margin: "24px 0 16px" }} />
            <p className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
              Identities are pseudonymized to safeguard student privacy. Your position updates automatically whenever you submit passing code or complete a review quiz.
            </p>
          </section>
        </div>
      ) : (
        /* Decluttered, Full-Width Quest Map Workspace */
        <div className="quests-workspace-expanded qm-panel" id="quest-groups">
          <div className="qm-panel-heading">
            <div>
              <h1>{selectedGroup?.name || "Quests"}</h1>
              <p>{selectedGroup ? `${selectedGroup.language.toUpperCase()} · ${selectedGroup.member_count} members · ${selectedGroup.activity_ids.length} activities` : "Your shared quest spaces and published activities"}</p>
            </div>
          </div>
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
              <Link href="/quests">← All quests</Link>
              {selectedGroup.is_owner && <button type="button" onClick={() => openAction("add")}>+ Add published activities</button>}
            </div>
          </div>}
          {!selectedGroup && groups.length > 0 && <div className="qm-groups-grid">
            {groups.map((group) => <Link href={`/quests?group=${group.id}`} className="qm-group-card" key={group.id}>
              <span className="qm-group-symbol" aria-hidden="true">✦</span>
              <strong>{group.name}</strong>
              <span>{group.language.toUpperCase()} · {group.activity_ids.length} activities · {group.member_count} members</span>
            </Link>)}
          </div>}
          {!selectedGroup && groups.length === 0 && <div className="qm-empty-hero">
            <Image src="/illustrations/quest-scroll-purple.png" alt="Purple quest scroll and black feather" width={220} height={220} priority />
            <h2>Add a quest to get started</h2>
            <p>{canCreateQuest ? "Create a quest space or join one with a code." : "Explore quest creation or join with a code from your faculty member."}</p>
            <div className="qm-empty-actions">
              <button type="button" className="qm-empty-action" onClick={() => openAction("create")}>Create Quest</button>
              <button type="button" className="qm-empty-action" onClick={() => openAction("join")}>Join Quest</button>
            </div>
          </div>}
          {message && (
            <p className={`notice ${isError ? "error" : ""}`} role="status">
              {message}
            </p>
          )}

          {/* Active Category Filter Banner (when filtered via hamburger drawer) */}
          {activeCategoryTitle && (
            <div className="active-category-banner">
              <div className="active-category-info">
                <span className="active-category-icon">
                  {categoryParam === "code-challenge" ? "</>" : "✓"}
                </span>
                <span>
                  Filtering by <strong>{activeCategoryTitle}</strong> ({visibleQuests.length}{" "}
                  {visibleQuests.length === 1 ? "activity" : "activities"} available)
                </span>
              </div>
              <button
                type="button"
                onClick={() => router.push("/quests")}
                className="clear-category-filter-btn"
              >
                ✕ Clear filter (Show all)
              </button>
            </div>
          )}

          {quests.length === 0 || (selectedGroup && selectedGroup.activity_ids.length === 0) ? (
            selectedGroup && <div className="qm-activity-empty">
              <p>No published activities are in this quest yet.</p>
              {selectedGroup.is_owner && <button className="qm-add-link" type="button" onClick={() => openAction("add")}>Add an activity</button>}
            </div>
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
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search quests or concepts"
                    type="search"
                  />
                </label>
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
                      if (categoryParam) router.push("/quests");
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
                          {!isStudent ? (
                            <button className="button button-outline" type="button" onClick={() => setSelectedQuestId(isHighlighted ? null : quest.id)}>
                              {isHighlighted ? "Hide details" : "View details"}
                            </button>
                          ) : quest.activity_type === "challenge" ? (
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
                          )}
                        </div>
                        {!isStudent && isHighlighted && <p className="qm-preview-text">{quest.problem_statement || "No additional instructions."}</p>}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
        </div>
      </div>
      {actionMode && <div className="qm-dialog-backdrop" onMouseDown={() => setActionMode(null)}>
        <section className="qm-dialog" role="dialog" aria-modal="true" aria-labelledby="qm-dialog-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") setActionMode(null); }}>
          <div className="qm-dialog-heading">
            <h2 id="qm-dialog-title">{actionMode === "create" ? "Create Quest" : actionMode === "join" ? "Join Quest" : "Add activities"}</h2>
            <button type="button" className="qm-icon-button" aria-label="Close dialog" data-tooltip="Close this quest dialog." onClick={() => setActionMode(null)}>×</button>
          </div>
          <form onSubmit={(event) => void submitQuestAction(event)}>
            {actionMode === "create" && !canCreateQuest && <p className="qm-dialog-note">You can preview quest creation here. Saving a quest currently requires faculty or admin access.</p>}
            {actionMode === "create" && <>
              <label>Quest name<input autoFocus required minLength={3} maxLength={80} value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="e.g. Python Fundamentals" /></label>
              <label>Description <span>(optional)</span><textarea maxLength={500} rows={2} value={newGroupDescription} onChange={(event) => setNewGroupDescription(event.target.value)} placeholder="What will members learn?" /></label>
              <label>Language<select value={newGroupLanguage} onChange={(event) => { setNewGroupLanguage(event.target.value as ProgrammingLanguage); setSelectedActivityIds([]); }}><option value="python">Python</option><option value="cpp">C++</option><option value="java">Java</option></select></label>
            </>}
            {actionMode === "join" && <>
              <p>Enter the 8-character code shared by the quest creator.</p>
              <label>Quest code<input autoFocus required minLength={8} maxLength={12} autoCapitalize="characters" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABCD2345" /></label>
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
              <button type="submit" className="qm-primary-action" disabled={actionBusy || (actionMode === "create" && !canCreateQuest) || (actionMode === "add" && selectedActivityIds.length === 0)}>{actionBusy ? "Saving…" : actionMode === "create" ? "Create Quest" : actionMode === "join" ? "Join Quest" : "Add activities"}</button>
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
