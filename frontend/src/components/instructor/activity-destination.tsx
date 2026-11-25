import type { Workshop } from "@/lib/types";
import { useApi } from "@/components/workspace/ui";

export function useActivityWorkshops() {
  const request = useApi<Workshop[]>("/workshops", true);
  return { ...request, workshops: (request.data ?? []).filter((workshop) => workshop.owned_by_me && !workshop.archived) };
}

export function ActivityDestination({ id, value, onChange, request, disabled }: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  request: ReturnType<typeof useActivityWorkshops>;
  disabled?: boolean;
}) {
  return <div className="ws-field">
    <label htmlFor={id}>Workshop destination</label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required
      aria-describedby={`${id}-help`} disabled={disabled || request.loading || Boolean(request.error)}>
      <option value="">Choose a workshop</option>
      {request.workshops.map((workshop) => <option key={workshop.id} value={workshop.id}>{workshop.name}</option>)}
    </select>
    <p className="ws-muted" id={`${id}-help`}>{request.loading ? "Loading workshops…" : request.error
      ? "Workshops could not load."
      : request.workshops.length ? "The activity uses this workshop’s language and is shared with its members when published."
        : "Create a workshop before publishing activities to it."}</p>
    {request.error && <button className="button button-outline" type="button" onClick={request.reload}>Retry loading workshops</button>}
  </div>;
}
