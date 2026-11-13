(() => {
  // src/web/site.js
  var ONLINE = /^https?:$/.test(location.protocol);
  var JA = document.documentElement.lang === "ja";
  var BASE = ONLINE ? new URL(JA ? ".." : ".", location.href).href.replace(/\/$/, "") : JA ? ".." : ".";
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
      button.textContent = JA ? "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F" : "Copied";
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
  var DEMO_EN = {
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
  var DEMO_JA = {
    enforced: [
      ["\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\u30DD\u30EA\u30B7\u30FC 4.2: ", ["warn", "\u8A8D\u8A3C\u60C5\u5831\u3092\u5916\u90E8\u30C4\u30FC\u30EB\u3068\u5171\u6709\u3057\u3066\u306F\u306A\u3089\u306A\u3044"], "\u3002"],
      [["rule", "core.no-secrets"], " \u5FC5\u9808 \xB7 \u8A8D\u8A3C\u60C5\u5831\u306F\u6C7A\u3057\u3066\u5165\u308C\u306A\u3044\u3002API \u30AD\u30FC\u3001\u30D1\u30B9\u30EF\u30FC\u30C9\u3001\u30C8\u30FC\u30AF\u30F3\u3092\u30D7\u30ED\u30F3\u30D7\u30C8\u3001\u30D5\u30A1\u30A4\u30EB\u3001\u51FA\u529B\u306B\u5165\u308C\u306A\u3044\u3002"],
      ["\u30EB\u30FC\u30EB\u306F ", ["file", "AGENTS.md"], " \u306B\u3001\u305D\u306E\u30C1\u30A7\u30C3\u30AF\u306F ", ["file", ".claude/hooks/komainu-guard.mjs"], " \u306B\u66F8\u304D\u8FBC\u307E\u308C\u307E\u3059\u3002"],
      ["\u30AD\u30FC\u3092\u8CBC\u308A\u4ED8\u3051\u308B\u3068: ", ["warn", "AKIA\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7"], "\u3002\u30D5\u30C3\u30AF\u304C\u9001\u4FE1\u524D\u306B\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u6B62\u3081\u307E\u3059: \u300C", ["rule", "[REDACTED_SECRET]"], " \u306B\u7F6E\u304D\u63DB\u3048\u3066\u304F\u3060\u3055\u3044\u300D\u3002"]
    ],
    instructed: [
      ["\u884C\u52D5\u898F\u7BC4 7: ", ["warn", "\u63A1\u7528\u306E\u5224\u65AD\u306F\u63A1\u7528\u62C5\u5F53\u8005\u304C\u884C\u3046\u3002"]],
      [["rule", "hr.no-auto-decisions"], " \u5FC5\u9808 \xB7 \u4EBA\u306B\u95A2\u3059\u308B\u5224\u65AD\u306F\u4EBA\u304C\u884C\u3046\u3002AI \u306B\u63A1\u7528\u306E\u5224\u65AD\u3092\u3055\u305B\u305A\u3001\u552F\u4E00\u306E\u6839\u62E0\u306B\u3082\u3057\u306A\u3044\u3002"],
      ["\u30EB\u30FC\u30EB\u306F ", ["file", "AGENTS.md"], " \u3068\u3001\u4EBA\u4E8B\u5411\u3051\u30D1\u30C3\u30AF ", ["file", "assistant-instructions/hr.md"], " \u306B\u66F8\u304D\u8FBC\u307E\u308C\u307E\u3059\u3002"],
      ["\u6700\u9069\u306A\u5019\u88DC\u8005\u3092\u9078\u3076\u3088\u3046\u983C\u307E\u308C\u308B\u3068\u3001\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306F\u5C65\u6B74\u66F8\u3092\u8981\u7D04\u3057\u3001", ["rule", "hr.no-auto-decisions"], " \u3092\u793A\u3057\u3066\u3001\u5224\u65AD\u306F\u3042\u306A\u305F\u304C\u884C\u3046\u3068\u4F1D\u3048\u307E\u3059\u3002"]
    ],
    attested: [
      ["AI \u30DD\u30EA\u30B7\u30FC 3.1: ", ["warn", "\u8077\u54E1\u306F\u6BCE\u5E74 AI \u7814\u4FEE\u3092\u4FEE\u4E86\u3059\u308B\u3002"]],
      [["rule", "core.literacy"], " \u63A8\u5968 \xB7 \u4F7F\u3046\u524D\u306B\u7814\u4FEE\u3092\u53D7\u3051\u308B\u3002\u696D\u52D9\u3067 AI \u3092\u4F7F\u3046\u4EBA\u306F\u5168\u54E1\u3001\u5F79\u5272\u306B\u5FDC\u3058\u305F\u7814\u4FEE\u3092\u4FEE\u4E86\u3059\u308B\u3002"],
      ["\u30EB\u30FC\u30EB\u306F ", ["file", "ai-acceptable-use-policy.md"], " \u306B\u30C1\u30A7\u30C3\u30AF\u30EA\u30B9\u30C8\u306E 1 \u884C\u3068\u3057\u3066\u5165\u308A\u307E\u3059: \u300C\u4F7F\u3046\u524D\u306B\u7814\u4FEE\u3092\u53D7\u3051\u308B\u3001\u62C5\u5F53: ______\u300D\u3002"],
      ["\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u4E2D\u3067\u306F\u4F55\u3082\u8D77\u3053\u308A\u307E\u305B\u3093\u3002\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306B\u306F\u78BA\u8A8D\u3067\u304D\u306A\u3044\u305F\u3081\u3001", ["rule", "\u6307\u540D\u3055\u308C\u305F\u62C5\u5F53\u8005"], " \u304C\u78BA\u8A8D\u3057\u307E\u3059\u3002"]
    ]
  };
  var DEMO = JA ? DEMO_JA : DEMO_EN;
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
