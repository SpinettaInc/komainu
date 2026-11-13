# komainu.json reference

Only fields that differ from the defaults need to be present.

```json
{
  "v": 1,
  "org": "Example Org",
  "strictness": "balanced",
  "domains": ["core", "coding", "security", "data", "hr"],
  "on": ["coding.security-review"],
  "off": ["coding.git"],
  "custom": [
    { "d": "hr", "l": "must", "x": "Get approval from the People team before using AI on performance data.", "src": "AI Policy §5.2" }
  ],
  "tools": "the tools on the approved-tools register",
  "contact": "the AI governance channel",
  "levels": ["Public", "Internal", "Confidential", "Restricted"],
  "hostedMax": "Internal",
  "local": "the on-premises model endpoint",
  "redact": ["secrets", "cc", "iban", "ssn"],
  "terms": ["Project Falcon"],
  "targets": ["agents", "claude", "hooks", "policy"],
  "cite": true
}
```

| Field | Meaning |
|---|---|
| `v` | Always `1`. |
| `org` | Organization name shown in generated files. Optional. |
| `strictness` | `advisory` (tier 1 rules; hook asks instead of blocking), `balanced` (tiers 1–2; default), `strict` (all tiers). |
| `domains` | Domain ids to include. `core` is always included. |
| `on` / `off` | Rule ids to force on or off, overriding the strictness tier. |
| `custom` | Organization-specific rules: `d` domain id, `l` `must` or `should`, `x` rule text, `src` optional source clause. |
| `tools` | Approved AI tools, free text. |
| `contact` | Who answers questions and receives incident reports. Use a role or channel. |
| `levels` | Data classification levels, lowest to highest. |
| `hostedMax` | Highest level that may go to hosted AI services. Must be one of `levels`. |
| `local` | The route for data above `hostedMax`. Empty means "an approved local or private endpoint". |
| `redact` | Detector classes the hook, `check` and `redact` use: `secrets`, `cc`, `iban`, `ssn`, `email`, `phone`. |
| `terms` | Sensitive names blocked and redacted locally. Never copied into instruction files. |
| `targets` | Where guardrails are installed: `agents`, `claude`, `hooks`, `cursor`, `copilot`, `gemini`, `windsurf`, `policy`, `assistants`, `mcp`. |
| `cite` | Include framework references in the policy document. |

Rule ids, tiers and targets are listed in `catalog.md`. Text placeholders available in custom rules: `{tools}`, `{contact}`, `{levels}`, `{hostedMax}`, `{local}`.

Note: `terms` are stored in `komainu.json` and in the generated hook, both of which live in the repository. Do not list a name there if the repository itself is shared with people who must not see it.
