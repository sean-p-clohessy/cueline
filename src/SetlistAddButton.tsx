import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Plus } from "lucide-react";

/** Keep confirmation beside the action, including while the picker stays open. */
export function SetlistAddButton({
  label,
  disabled,
  confirmed = false,
  add,
}: {
  label: string;
  disabled: boolean;
  confirmed?: boolean;
  add: () => Promise<void>;
}) {
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const complete = added || confirmed;
  useEffect(() => () => clearTimeout(cooldown.current), []);

  async function handleAdd() {
    if (disabled || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      await add();
      setAdded(true);
      // A second tap must be deliberate, especially with a finger on a tablet.
      cooldown.current = setTimeout(() => {
        locked.current = false;
        setBusy(false);
      }, 1000);
    } catch {
      locked.current = false;
      setBusy(false);
      setError(true);
    }
  }

  return (
    <div className="setlist-add-action">
      <button
        className={`btn setlist-add-button ${complete ? "is-added" : ""}`}
        aria-label={complete ? `${label} again` : label}
        disabled={disabled || busy}
        onClick={() => void handleAdd()}
      >
        {complete ? (
          <Check size={20} />
        ) : busy ? (
          <LoaderCircle size={20} />
        ) : (
          <Plus size={20} />
        )}
        {complete ? "Added!" : busy ? "Adding…" : "Add"}
      </button>
      {error && (
        <small className="setlist-add-error" role="alert">
          Couldn’t add. Try again.
        </small>
      )}
    </div>
  );
}
