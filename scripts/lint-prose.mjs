// Checks the prose in the repository: documentation, the website, the skill,
// and the comments and messages in the code.
//
// The checks follow https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing.
// A line can opt out with a trailing "prose-lint: ignore" comment.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SELF = path.relative(root, fileURLToPath(import.meta.url));
const SKIP_DIRS = new Set(['node_modules', 'public', 'coverage', '.git', 'fonts']);
const EXTENSIONS = new Set(['.md', '.html', '.js', '.mjs', '.css', '.json', '.jsonc', '.yml']);
const SKIP_FILES = new Set(['package-lock.json', SELF]);

// Words the guideline lists as overused, plus the marketing words that travel with them.
const WORDS = [
    'additionally', 'boasts?', 'bolster(?:s|ed|ing)?', 'crucial', 'delv(?:e|es|ed|ing)', 'emphasi[sz]ing', 'enduring', 'garner(?:s|ed|ing)?',
    'intricate', 'intricacies', 'interplay', 'landscape', 'meticulous(?:ly)?', 'pivotal', 'underscor(?:e|es|ed|ing)', 'tapestry', 'testament',
    'valuable', 'vibrant', 'align(?:s|ed|ing)? with', 'enhanc(?:e|es|ed|ing)', 'foster(?:s|ed|ing)?', 'highlighting', 'showcas(?:e|es|ed|ing)',
    'dependable', 'leverag(?:e|es|ed|ing)', 'multifaceted', 'prioriti[sz](?:e|es|ed|ing)', 'robust', 'deep dive', 'nestled', 'profound',
    'seamless(?:ly)?', 'effortless(?:ly)?', 'cutting-edge', 'game-chang\\w+', 'empower(?:s|ed|ing)?', 'elevat(?:e|es|ed|ing)', 'streamlin(?:e|es|ed|ing)',
    'harness(?:es|ed|ing)?', 'supercharg\\w+', 'comprehensive', 'holistic', 'furthermore', 'moreover', 'ensuring', 'symboli[sz]ing', 'encompass\\w*'
];

const PHRASES = [
    ['not only', 'negative parallelism'], ['not just', 'negative parallelism'], ["isn't just", 'negative parallelism'], ['more than just', 'negative parallelism'],
    ['rather than', 'negative parallelism; say what the thing does'],
    ['serves? as', 'copula avoidance; use "is"'], ['stands? as', 'copula avoidance; use "is"'], ['functions? as', 'copula avoidance; use "is"'],
    ['plays? an? \\w+ role', 'inflated significance'], ['important to note', 'didactic disclaimer'], ['worth noting', 'didactic disclaimer'],
    ['in conclusion', 'summary formula'], ['in summary', 'summary formula'], ['overall,', 'summary formula'], ['when it comes to', 'filler'],
    ['at its core', 'filler'], ['dive into', 'filler'], ["in today's", 'filler'], ["whether you're", 'sales framing'], ['look no further', 'sales framing'],
    ['i hope this', 'chat residue'], ['let me know', 'chat residue'], ['feel free to', 'chat residue'], ['happy to help', 'chat residue']
];

const wordRe = new RegExp(`\\b(${WORDS.join('|')})\\b`, 'i');
const phraseRes = PHRASES.map(([p, why]) => [new RegExp(`\\b${p}\\b`, 'i'), why]);
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'you', 'not', 'are', 'what']);

function titleCase(heading) {
    const words = heading.replace(/`[^`]*`/g, '').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
    if (words.length < 3) return false;
    const rest = words.slice(1).filter((w) => !SMALL.has(w.toLowerCase()) && !/^[A-Z0-9/.-]+$/.test(w));
    return rest.length >= 2 && rest.every((w) => /^[A-Z]/.test(w));
}

function check(line, file) {
    const out = [];
    const md = file.endsWith('.md');
    if (/—/.test(line)) out.push('em dash; use a comma, colon, parentheses or a new sentence');
    if (/\s–\s/.test(line)) out.push('spaced en dash used as punctuation');
    if (/[“”‘’]/.test(line)) out.push('curly quotation mark; use a straight one');
    if (/\p{Extended_Pictographic}/u.test(line.replace(/[↔-⇿©®™]/g, ''))) out.push('emoji');
    const word = line.match(wordRe);
    if (word) out.push(`"${word[1]}" is on the overused-vocabulary list`);
    for (const [re, why] of phraseRes) {
        const m = line.match(re);
        if (m) out.push(`"${m[0]}": ${why}`);
    }
    if (md) {
        if (/^\s*(?:[-*+]|\d+\.)\s+\*\*[^*]+\*\*\s*[:.]?\s/.test(line) && !/^\s*[-*+]\s+\*\*(MUST|SHOULD)\*\*/.test(line)) out.push('list item that opens with a bold inline header');
        const h = line.match(/^#{1,6}\s+(.*)$/);
        if (h && titleCase(h[1])) out.push('heading in title case; use sentence case');
    }
    return out;
}

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
        } else if (EXTENSIONS.has(path.extname(entry.name))) {
            yield path.join(dir, entry.name);
        }
    }
}

let problems = 0;
let files = 0;
for (const abs of walk(root)) {
    const file = path.relative(root, abs);
    if (SKIP_FILES.has(file)) continue;
    files++;
    fs.readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes('prose-lint: ignore')) return;
        for (const message of check(line, file)) {
            problems++;
            console.log(`${file}:${i + 1}  ${message}`);
        }
    });
}

if (problems) {
    console.log(`\n${problems} prose problem(s) in ${files} files.`);
    process.exit(1);
}
console.log(`Prose is clean (${files} files).`);
