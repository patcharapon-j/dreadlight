/**
 * Persistent HUD element displaying the GM's Omen pool.
 * Visible to all clients; only the GM can modify the value.
 */
export class OmenTracker {
  /** @type {HTMLElement|null} */
  static #element = null;

  /**
   * Initialise the tracker — call once from the `ready` hook.
   * Creates the DOM element, appends it to #ui-top, and wires up
   * the updateSetting hook for cross-client reactivity.
   */
  static init() {
    const omen = game.settings.get("dreadlight", "omenPool");
    this.#element = this.#buildElement(omen);
    document.getElementById("ui-top").appendChild(this.#element);

    // Sync across clients when the setting changes
    Hooks.on("updateSetting", (setting) => {
      if (setting.key !== "dreadlight.omenPool") return;
      this.#refresh(setting.value);
    });
  }

  /* -------------------------------------------------- */
  /*  DOM Construction                                   */
  /* -------------------------------------------------- */

  /**
   * Build the tracker DOM element from scratch.
   * @param {number} omen - Current omen value
   * @returns {HTMLElement}
   */
  static #buildElement(omen) {
    const el = document.createElement("div");
    el.classList.add("dreadlight", "omen-tracker");
    el.dataset.omen = this.#escalationBucket(omen);
    el.innerHTML = `
      <span class="omen-icon">&#9670;</span>
      <span class="omen-label">${game.i18n.localize("DREADLIGHT.Omen")}</span>
      <span class="omen-value">${omen}</span>
    `;

    if (game.user.isGM) {
      el.style.cursor = "pointer";
      el.addEventListener("click", this.#onLeftClick.bind(this));
      el.addEventListener("contextmenu", this.#onRightClick.bind(this));
    }

    return el;
  }

  /* -------------------------------------------------- */
  /*  Update                                             */
  /* -------------------------------------------------- */

  /**
   * Update the displayed value and escalation state.
   * @param {number} omen - New omen value
   */
  static #refresh(omen) {
    if (!this.#element) return;
    const valueEl = this.#element.querySelector(".omen-value");
    valueEl.textContent = omen;
    this.#element.dataset.omen = this.#escalationBucket(omen);

    // Pulse animation
    valueEl.classList.remove("omen-pulse");
    void valueEl.offsetWidth; // force reflow to restart animation
    valueEl.classList.add("omen-pulse");
  }

  /**
   * Map an omen value to an escalation bucket for CSS styling.
   * @param {number} omen
   * @returns {string} "0", "active", or "high"
   */
  static #escalationBucket(omen) {
    if (omen === 0) return "0";
    if (omen >= 5) return "high";
    return "active";
  }

  /* -------------------------------------------------- */
  /*  Event Handlers (GM only)                           */
  /* -------------------------------------------------- */

  /** Left click — increment by 1 */
  static #onLeftClick(event) {
    event.preventDefault();
    const current = game.settings.get("dreadlight", "omenPool");
    game.settings.set("dreadlight", "omenPool", current + 1);
  }

  /** Right click — decrement by 1, minimum 0 */
  static #onRightClick(event) {
    event.preventDefault();
    const current = game.settings.get("dreadlight", "omenPool");
    if (current > 0) {
      game.settings.set("dreadlight", "omenPool", current - 1);
    }
  }
}
