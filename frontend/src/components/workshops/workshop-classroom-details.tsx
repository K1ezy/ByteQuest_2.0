"use client";

import { useId } from "react";
import type { WorkshopClassroomDetails } from "@/lib/types";

const yearLevels = [1, 2, 3, 4];

export function readClassroomDetails(fields: FormData) {
  const text = (name: "block" | "subject" | "room") => String(fields.get(name) ?? "").trim() || null;
  const year = fields.get("year_level");
  return {
    block: text("block"),
    year_level: year ? Number(year) : null,
    subject: text("subject"),
    room: text("room"),
  };
}

export function classroomSummary(details: WorkshopClassroomDetails) {
  return [
    details.subject,
    details.year_level && `Year ${details.year_level}`,
    details.block && `Block ${details.block}`,
    details.room && `Room ${details.room}`,
  ].filter(Boolean).join(" · ");
}

export function WorkshopClassroomFields({ details }: { details?: WorkshopClassroomDetails }) {
  const prefix = useId();
  return <fieldset className="workshop-classroom-fields">
    <legend>Classroom details (optional)</legend>
    <div className="workshop-classroom-grid">
      <label htmlFor={`${prefix}-block`}>Block
        <input id={`${prefix}-block`} name="block" maxLength={24} defaultValue={details?.block ?? ""}
          placeholder="e.g. 3CS-A" />
      </label>
      <div className="workshop-field">
        <label htmlFor={`${prefix}-year`}>Year level</label>
        <select id={`${prefix}-year`} name="year_level" defaultValue={details?.year_level ?? ""}>
          <option value="">Select year</option>
          {yearLevels.map((year) => <option key={year} value={year}>Year {year}</option>)}
        </select>
      </div>
      <label htmlFor={`${prefix}-subject`}>Subject
        <input id={`${prefix}-subject`} name="subject" maxLength={80} defaultValue={details?.subject ?? ""}
          placeholder="e.g. Data Structures" />
      </label>
      <label htmlFor={`${prefix}-room`}>Room
        <input id={`${prefix}-room`} name="room" maxLength={40} defaultValue={details?.room ?? ""}
          placeholder="e.g. 501 or Lab 2" />
      </label>
    </div>
  </fieldset>;
}
