/**
 * Small-screen toolbar (phones, short landscape windows). On a large screen the
 * ARM / PRIZE / BRIDGE panels are always on screen; on a small one they would
 * bury the scene, so each becomes a sheet that this toolbar opens one at a
 * time. Hidden by CSS on large screens.
 */

export type CompactPanel = "arm" | "prize" | "bridge";

const TABS: { id: CompactPanel; label: string }[] = [
  { id: "arm", label: "ARM" },
  { id: "prize", label: "景品" },
  { id: "bridge", label: "バー" },
];

interface Props {
  panel: CompactPanel | null;
  onChange: (panel: CompactPanel | null) => void;
}

export function CompactToolbar({ panel, onChange }: Props) {
  return (
    <div className="compact-toolbar" role="toolbar" aria-label="設定パネル">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={panel === t.id ? "compact-tab on" : "compact-tab"}
          onClick={() => onChange(panel === t.id ? null : t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
