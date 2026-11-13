# Mapping internal policy to guardrails

## Procedure

1. List the policy documents and their classification. Skip any you are not approved to read.
2. Extract clauses. A clause is one obligation: a "must", "must not", "should", "only", "never", "requires approval". Note its source (`<document> §<section>`).
3. Classify each clause with the decision table below.
4. Build the coverage table as you go. Do not reconstruct it from memory at the end.

## Decision table

| The clause… | Do this |
|---|---|
| says the same thing as a catalog rule | Leave the rule on. Coverage row: clause → rule id. |
| is stricter than the catalog rule | Keep the rule and add a custom rule with the stricter wording, citing the clause. |
| is looser than, or contradicts, a catalog rule | Put the rule id in `off` and add a custom rule with the policy's wording. Tell the user. |
| names approved tools or vendors | `tools` |
| names an owner, team or reporting channel | `contact` (a role or channel, never a personal email or phone number) |
| defines classification levels or handling | `levels`, `hostedMax`, `local` |
| names clients, projects or codenames that are confidential | `terms` (enforced locally; never written into instruction files) |
| lists data types that must not be shared | `redact` classes where one fits; otherwise a custom rule |
| is specific to a department | a custom rule with that department's domain in `d` |
| is an organizational process (training, audits, vendor review) | the matching catalog rule if one exists, otherwise a custom rule; it will be **attested** |
| does not concern AI use, data, security, communication or conduct | Out of scope. List it once in the report. |

## Writing custom rules

- One obligation per rule, in the imperative: "Do not …", "Get approval from … before …".
- Keep the organization's own terms (system names, role titles).
- Under 60 words. Put the source in `src`, not in the text.
- `l` is `must` for "must / shall / never / only", `should` for "should / recommended / where possible".
- Do not copy confidential specifics (customer names, internal URLs, credentials) into a rule. Instruction files are loaded into hosted models on every session.

## Coverage table format

| Policy clause | Guardrail | Level | Upheld by | Note |
|---|---|---|---|---|
| Security Policy §4.2 "No credentials in third-party tools" | `core.no-secrets` | MUST | Enforced | Hook blocks keys, tokens and passwords |
| Code of Conduct §7 "Recruiters make the hiring decision" | `hr.no-auto-decisions` | MUST | Instructed | |
| AI Policy §3.1 "Staff complete AI training yearly" | `core.literacy` | SHOULD | Attested | Needs an owner |
| Brand Guide §2 "Never use the word 'revolutionary'" | custom (`marketing`) | MUST | Instructed | |
| Travel Policy §1 to §9 | none | | | Out of scope |

Then list **gaps** in both directions: policy clauses with no guardrail, and enabled catalog rules that no policy clause backs. The second list is useful to the policy owner: it shows what the written policy is missing.
