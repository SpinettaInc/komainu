(() => {
  // src/web/site.js
  var ONLINE = /^https?:$/.test(location.protocol);
  var BASE = ONLINE ? new URL(".", location.href).href.replace(/\/$/, "") : ".";
  for (const el of document.querySelectorAll("[data-base]")) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) node.nodeValue = node.nodeValue.replaceAll("{{BASE}}", BASE);
  }
  if (!ONLINE) for (const el of document.querySelectorAll("[data-online]")) el.hidden = true;
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", async () => {
      const source = document.querySelector(button.getAttribute("data-copy"));
      if (!source || !navigator.clipboard) return;
      await navigator.clipboard.writeText(source.textContent.trim());
      const label = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = label;
      }, 1400);
    });
  }
  var tabs = [...document.querySelectorAll(".tabs [role=tab]")];
  function selectTab(tab) {
    for (const other of tabs) {
      const on = other === tab;
      other.setAttribute("aria-selected", String(on));
      other.tabIndex = on ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !on;
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });
  var DEMO = {
    enforced: [
      ["Security Policy \xA74.2: ", ["warn", "Credentials must never be shared"], " with third-party tools."],
      [["rule", "core.no-secrets"], " MUST \xB7 No credentials, ever. Never put API keys, passwords or tokens into prompts, files or outputs."],
      ["The rule goes into ", ["file", "AGENTS.md"], ", and its check into ", ["file", ".claude/hooks/komainu-guard.mjs"], "."],
      ["You paste a key: ", ["warn", "AKIA\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7"], '. The hook stops the prompt before it is sent: "replace it with ', ["rule", "[REDACTED_SECRET]"], '".']
    ],
    instructed: [
      ["Code of Conduct \xA77: ", ["warn", "Recruiters make the hiring decision."]],
      [["rule", "hr.no-auto-decisions"], " MUST \xB7 People decide about people. AI must not make, or be the sole basis for, hiring decisions."],
      ["The rule goes into ", ["file", "AGENTS.md"], " and into the HR pack ", ["file", "assistant-instructions/hr.md"], "."],
      ["Asked to pick the best candidate, the assistant summarizes the CVs and says the decision is yours, citing ", ["rule", "hr.no-auto-decisions"], "."]
    ],
    attested: [
      ["AI Policy \xA73.1: ", ["warn", "Staff complete AI training every year."]],
      [["rule", "core.literacy"], " SHOULD \xB7 Train before use. Everyone who uses AI at work completes the training for their role."],
      ["The rule goes into ", ["file", "ai-acceptable-use-policy.md"], ' as a checklist line: "Train before use, owner: ______".'],
      ["Nothing happens in the session. No assistant can check this one, so ", ["rule", "a named person"], " confirms it."]
    ]
  };
  var demo = document.getElementById("demo");
  var note = document.getElementById("demo-note");
  var modeButtons = [...demo.querySelectorAll("[data-mode]")];
  function render(mode) {
    DEMO[mode].forEach((parts, paneIndex) => {
      const target = demo.querySelector(`[data-pane="${paneIndex}"]`);
      target.textContent = "";
      parts.forEach((part, index) => {
        if (typeof part === "string") {
          target.append(part);
          return;
        }
        const span = document.createElement("span");
        span.className = "ent " + part[0];
        span.style.animationDelay = `${paneIndex * 90 + index * 25}ms`;
        span.textContent = part[1];
        target.append(span);
      });
    });
    note.textContent = note.getAttribute("data-" + mode) || "";
    for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.getAttribute("data-mode") === mode));
    demo.classList.remove("animate");
    void demo.offsetWidth;
    demo.classList.add("animate");
  }
  for (const button of modeButtons) button.addEventListener("click", () => render(button.getAttribute("data-mode")));
  render("enforced");
})();
