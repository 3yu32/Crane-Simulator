/**
 * Bring-your-own-key input for the AI mode. The key stays in this browser
 * (session by default; "保存" opts into localStorage) and is only ever sent to
 * Google's Gemini API — see game/geminiKey.ts.
 */

import { useState } from "react";
import { LOCAL_BACKEND_AVAILABLE } from "../../game/aiPlayer";
import { clearApiKey, isKeyPersisted, setApiKey, useApiKey } from "../../game/geminiKey";

export function ApiKeyField() {
  const key = useApiKey();
  const [draft, setDraft] = useState("");
  const [persist, setPersist] = useState(false);

  if (key) {
    return (
      <div className="ai-key set">
        <span>
          🔑 自分のAPIキーを使用中 (…{key.slice(-4)}
          {isKeyPersisted() ? "・保存済み" : "・このタブのみ"})
        </span>
        <button type="button" onClick={() => clearApiKey()}>
          削除
        </button>
      </div>
    );
  }

  return (
    <form
      className="ai-key"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) {
          setApiKey(draft, persist);
          setDraft("");
        }
      }}
    >
      <div className="ai-key-title">
        Gemini APIキー{LOCAL_BACKEND_AVAILABLE ? "（任意：未入力ならローカルのバックエンドを使用）" : "（AIプレイに必要）"}
      </div>
      <div className="ai-key-row">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()}>
          設定
        </button>
      </div>
      <label className="ai-key-persist">
        <input
          type="checkbox"
          checked={persist}
          onChange={(e) => setPersist(e.target.checked)}
        />
        このブラウザに保存する（共有PCでは非推奨）
      </label>
      <div className="ai-key-note">
        キーはこのブラウザ内にのみ保持され、Google の Gemini API 以外へは送信されません。
        キーは{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer noopener">
          Google AI Studio
        </a>{" "}
        で取得できます。
      </div>
    </form>
  );
}
