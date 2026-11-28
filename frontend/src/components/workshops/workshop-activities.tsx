"use client";

import { useEffect, useRef, useState } from "react";
import { useShellProfile } from "@/components/app-shell";
import { QuestCard } from "@/components/quest-card";
import { Button, useApi } from "@/components/workspace/ui";
import { apiRequest, getErrorMessage } from "@/lib/api";
import type { Quest, Workshop } from "@/lib/types";
import { useWorkshop } from "./workshop-layout";
import { WorkshopDialog, WorkshopError, WorkshopForm, workshopDateTime } from "./workshop-ui";

type WorkshopQuest = Quest & { can_open: boolean; opens_at: string | null };
type ActivityOption = Pick<Quest, "id" | "title" | "activity_type">;
type ActivityLink = Workshop["activities"][number];
type ActivityDialog = { kind: "add" | "topic" } | { kind: "edit" | "remove"; activity: WorkshopQuest; link: ActivityLink };
type UpdateActivity = (path: string, method: string, body?: object) => Promise<void>;

function ActivityPicker({ path, single }: { path: string; single: boolean }) {
  const { data, loading, error, reload } = useApi<ActivityOption[]>(path, true);
  if (loading) return <p role="status">Loading published activities…</p>;
  if (error) return <WorkshopError message={error} retry={reload} />;
  if (!data?.length) return <p>No other published activities can be shared in this track.</p>;
  if (single) return <div className="workshop-field">
    <label htmlFor="workshop-published-option">Published activity</label>
    <select id="workshop-published-option" name="activity_ids" defaultValue="" required>
      <option value="" disabled>Select an activity</option>
      {data.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
    </select>
  </div>;
  return <fieldset className="workshop-picker">
    <legend>Published activities</legend>
    {data.map((activity) => <label key={activity.id}>
      <input type="checkbox" name="activity_ids" value={activity.id} />
      <span>{activity.title}<small>{activity.activity_type === "challenge" ? "Code challenge" : "Concept check"}</small></span>
    </label>)}
  </fieldset>;
}

function ActivityEditor({ dialog, quests, topics, base, close, update }: {
  dialog: ActivityDialog;
  quests: WorkshopQuest[];
  topics: string[];
  base: string;
  close: () => void;
  update: UpdateActivity;
}) {
  const title = { add: "Add published activities", topic: "Add topic", edit: "Change topic", remove: "Remove activity" }[dialog.kind];
  const activity = "activity" in dialog ? dialog.activity : null;
  const remove = dialog.kind === "remove";
  const isNewTopic = dialog.kind === "topic";
  const moveToTopic = isNewTopic && quests.length > 0;

  async function save(fields: FormData) {
    if (remove && activity) {
      await update(`${base}/${activity.id}`, "DELETE");
    } else {
      const topic = String(fields.get("topic") ?? "").trim() || null;
      if (isNewTopic && !topic) throw new Error("Enter a topic name.");
      if (activity || moveToTopic) {
        await update(`${base}/${activity?.id ?? fields.get("activity_id")}`, "PATCH", { topic });
      } else {
        const activityIds = fields.getAll("activity_ids");
        if (!activityIds.length) throw new Error("Select at least one published activity.");
        await update(base, "POST", { topic, activity_ids: activityIds });
      }
    }
    close();
  }

  return <WorkshopDialog title={title} close={close}>
    <WorkshopForm submitLabel={remove ? "Remove activity" : dialog.kind === "add" ? "Add activities" : "Save topic"}
      close={close} onSubmit={save} danger={remove}>
      {remove ? <p>Remove {activity?.title ?? activity?.topic_concept} from this workshop? Students keep their attempts and rewards.</p> : <>
        {(dialog.kind === "add" || (isNewTopic && !moveToTopic)) && <ActivityPicker path={`${base}/catalog`} single={isNewTopic} />}
        {moveToTopic && <div className="workshop-field">
          <label htmlFor="workshop-topic-activity">Activity to move</label>
          <select id="workshop-topic-activity" name="activity_id" defaultValue="" required>
            <option value="" disabled>Select an activity</option>
            {quests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title ?? quest.topic_concept}</option>)}
          </select>
        </div>}
        <label>{isNewTopic ? "Topic name" : "Topic (optional)"}
          <input name="topic" list="workshop-topic-options" maxLength={80} required={isNewTopic}
            defaultValue={dialog.kind === "edit" ? dialog.link.topic ?? "" : ""} />
        </label>
        <datalist id="workshop-topic-options">{topics.map((topic) => <option key={topic} value={topic} />)}</datalist>
        {isNewTopic && <p>Pick the first activity for this topic.</p>}
      </>}
    </WorkshopForm>
  </WorkshopDialog>;
}

export function WorkshopActivities() {
  const { workshop, setWorkshop } = useWorkshop();
  const { role } = useShellProfile();
  const base = `/workshops/${workshop.id}/activities`;
  const { data, error, loading, reload } = useApi<WorkshopQuest[]>(base, true);
  const [dialog, setDialog] = useState<ActivityDialog | null>(null);
  const [notice, setNotice] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moving, setMoving] = useState(false);
  const inFlight = useRef(false);
  const addMenu = useRef<HTMLDetailsElement>(null);
  const managing = workshop.is_owner && !workshop.archived;
  const quests = data ?? [];
  const questById = new Map(quests.map((quest) => [quest.id, quest]));
  const groups = new Map<string | null, ActivityLink[]>();
  const indexes = new Map<string, number>();
  workshop.activities.forEach((link, index) => {
    if (!questById.has(link.activity_id)) return;
    const members = groups.get(link.topic) ?? [];
    members.push(link);
    groups.set(link.topic, members);
    indexes.set(link.activity_id, index);
  });
  const topics = [...groups.keys()].filter((topic) => topic !== null);

  useEffect(() => {
    if (!data || !window.location.hash.startsWith("#quest-")) return;
    // The deep-linked card arrives after the Workshop and activity requests complete.
    const card = document.getElementById(window.location.hash.slice(1));
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: "nearest" });
  }, [data]);

  function closeMenu() {
    if (!addMenu.current) return;
    addMenu.current.open = false;
    addMenu.current.querySelector("summary")?.focus();
  }

  async function update(path: string, method: string, body?: object) {
    const updated = await apiRequest<Workshop>(path, { method, body: body && JSON.stringify(body) });
    setWorkshop(updated);
    if (method === "POST") reload();
    setNotice(method === "POST" ? "Activities added." : method === "DELETE" ? "Activity removed." : "Activities updated.");
  }

  async function move(link: ActivityLink, next: ActivityLink) {
    if (inFlight.current) return;
    inFlight.current = true;
    setMoving(true);
    setMoveError("");
    setNotice("");
    try {
      await update(`${base}/${link.activity_id}`, "PATCH", { position: indexes.get(next.activity_id) });
    } catch (cause) {
      setMoveError(getErrorMessage(cause));
    } finally {
      inFlight.current = false;
      setMoving(false);
    }
  }

  return <div className="workshop-stack">
    <div className="workshop-heading">
      <h2>Activities</h2>
      {managing && <details className="workshop-add" ref={addMenu} onKeyDown={(event) => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.preventDefault();
          closeMenu();
        }
      }}>
        <summary className="button button-primary">Add</summary>
        <div className="workshop-add-options">
          <Button onClick={() => { closeMenu(); setDialog({ kind: "add" }); }}>Published activity</Button>
          <Button onClick={() => { closeMenu(); setDialog({ kind: "topic" }); }}>Topic</Button>
        </div>
      </details>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {moveError && <p className="notice error" role="alert">{moveError}</p>}
    {error && <WorkshopError message={error} retry={reload} />}
    {loading && <p role="status">Loading activities…</p>}
    {!loading && !error && groups.size === 0 && <section className="workshop-panel"><p>No published activities have been shared yet.</p></section>}
    {[...groups].map(([topic, links]) => <section className="workshop-stack workshop-activity-topic" key={topic === null ? "untitled" : `topic-${topic}`}>
      <h3>{topic ?? "No topic"}</h3>
      {links.map((link, rowIndex) => {
        const quest = questById.get(link.activity_id)!;
        const title = quest.title || quest.topic_concept;
        let availability = quest.is_closed ? "Closed for submissions" : undefined;
        if (role === "student" && !quest.can_open) {
          if (quest.opens_at) availability = `Opens ${workshopDateTime(quest.opens_at)}`;
        }
        return <div className="workshop-activity-row" key={link.activity_id}>
          <QuestCard quest={quest} learner={quest.can_open} workshop availability={availability} />
          {managing && <div className="workshop-actions workshop-activity-controls" role="group" aria-label={`Manage ${title}`}>
            <Button aria-label={`Move ${title} up`} aria-disabled={moving || rowIndex === 0}
              onClick={() => { if (rowIndex > 0) void move(link, links[rowIndex - 1]); }}>↑ Move up</Button>
            <Button aria-label={`Move ${title} down`} aria-disabled={moving || rowIndex === links.length - 1}
              onClick={() => { if (rowIndex + 1 < links.length) void move(link, links[rowIndex + 1]); }}>↓ Move down</Button>
            <Button onClick={() => setDialog({ kind: "edit", activity: quest, link })}>Change topic</Button>
            <Button onClick={() => setDialog({ kind: "remove", activity: quest, link })}>Remove</Button>
          </div>}
        </div>;
      })}
    </section>)}
    {dialog && managing && <ActivityEditor dialog={dialog} quests={quests} topics={topics} base={base} update={update} close={() => setDialog(null)} />}
  </div>;
}
