/**
 * Debug overlay (spec §20, §26): shows the current state machine state and the
 * acquisition flag, and mounts the Leva tuning panel. Toggled with the DEBUG
 * button or `?debug` in the URL.
 */

import { Leva } from "leva";
import { setDebug, useGameState } from "../../game/gameStore";

export function DebugPanel() {
  const debug = useGameState((s) => s.debug);
  const craneState = useGameState((s) => s.craneState);
  const prizeGet = useGameState((s) => s.prizeGet);

  return (
    <>
      <Leva hidden={!debug} collapsed titleBar={{ title: "Tuning" }} />
      <button
        type="button"
        className={`debug-toggle ${debug ? "on" : ""}`}
        onClick={() => setDebug(!debug)}
      >
        DEBUG
      </button>
      {debug && (
        <div className="debug-readout">
          <div>
            state: <strong>{craneState}</strong>
          </div>
          <div>prizeGet: {prizeGet ? "true" : "false"}</div>
        </div>
      )}
    </>
  );
}
