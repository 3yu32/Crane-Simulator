/**
 * Feature switches. Flip a flag and redeploy to turn a feature on or off.
 */

/**
 * Style 3 (AI play / LLM calls). `false` hides the スタイル3 button and makes
 * the store refuse to enter it or fire an AI request, so no Gemini call can
 * happen from the UI. Set back to `true` to restore it.
 */
export const AI_PLAY_ENABLED = false;
