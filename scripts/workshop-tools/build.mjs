#!/usr/bin/env node
/* Workshop Tools: turns the app as designed on the 'Raf Workshop Tools' design canvas (Main.dc.html, copied
   here) into src/lib/workshop-tools/app.generated.js, which src/lib/workshop-tools/dc-runtime.tsx renders
   with React on /tools/workshop/app.

   The canvas file has three parts: <helmet> (fonts and a few CSS rules), the template (HTML with {{ holes }},
   <sc-if value> and <sc-for list as>) and the logic (class Component extends DCLogic, with renderVals()).
   The template becomes a small tree (JSON), already in React's prop names, static styles already objects;
   the logic class is copied word for word. Nothing is changed by hand in the generated file.

   After changing the app on the canvas: copy Main.dc.html over scripts/workshop-tools/Main.dc.html, then
   `node scripts/workshop-tools/build.mjs`. No dependencies. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const src = readFileSync(process.argv[2] || join(here, 'Main.dc.html'), 'utf8');
const out = process.argv[3] || join(root, 'src/lib/workshop-tools/app.generated.js');

// ---------- split the file ----------
const dc = src.slice(src.indexOf('<x-dc>') + 6, src.lastIndexOf('</x-dc>'));
const helmet = (dc.match(/<helmet>([\s\S]*?)<\/helmet>/) || ['', ''])[1];
const css = (helmet.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1].trim();
const template = dc.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
const logicMatch = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (!logicMatch) throw new Error('No <script type="text/x-dc"> in the file');
const logic = logicMatch[1].trim();
if (!/^class Component extends DCLogic\b/.test(logic)) throw new Error('The logic should start with class Component extends DCLogic');

// ---------- a small HTML parser (the template is plain, well-formed HTML) ----------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', times: '×', middot: '·', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', pound: '£', deg: '°', frac12: '½', sup2: '²', divide: '÷', minus: '−' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  if (ENT[e] === undefined) throw new Error('Unknown entity ' + m);
  return ENT[e];
});

function parse(html) {
  const top = { tag: '#root', attrs: [], kids: [] };
  const stack = [top];
  let i = 0;
  const line = (at) => html.slice(0, at).split('\n').length;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) { i = html.indexOf('-->', i) + 3; continue; }
    if (html[i] === '<' && html[i + 1] === '/') {
      const j = html.indexOf('>', i);
      const name = html.slice(i + 2, j).trim();
      const el = stack.pop();
      if (!el || el.tag !== name) throw new Error(`</${name}> at line ${line(i)} closes <${el && el.tag}>`);
      i = j + 1;
      continue;
    }
    if (html[i] === '<' && /[A-Za-z]/.test(html[i + 1] || '')) {
      let j = i + 1;
      while (/[A-Za-z0-9-]/.test(html[j])) j++;
      const el = { tag: html.slice(i + 1, j), attrs: [], kids: [], line: line(i) };
      let selfClose = false;
      for (;;) {
        while (/\s/.test(html[j])) j++;
        if (html[j] === '>') { j++; break; }
        if (html[j] === '/' && html[j + 1] === '>') { selfClose = true; j += 2; break; }
        let k = j;
        while (html[k] && !/[\s=>/]/.test(html[k])) k++;
        const name = html.slice(j, k);
        if (!name) throw new Error(`Bad attribute at line ${line(j)}`);
        j = k;
        while (/\s/.test(html[j])) j++;
        let value = null;
        if (html[j] === '=') {
          j++;
          while (/\s/.test(html[j])) j++;
          const q = html[j];
          if (q === '"' || q === "'") {
            const end = html.indexOf(q, j + 1);
            value = html.slice(j + 1, end);
            j = end + 1;
          } else {
            let e = j;
            while (html[e] && !/[\s>]/.test(html[e])) e++;
            value = html.slice(j, e);
            j = e;
          }
          value = decode(value);
        }
        el.attrs.push([name, value]);
      }
      stack[stack.length - 1].kids.push(el);
      if (!selfClose && !VOID.has(el.tag)) stack.push(el);
      i = j;
      continue;
    }
    let j = html.indexOf('<', i + 1);
    if (j < 0) j = html.length;
    stack[stack.length - 1].kids.push({ text: html.slice(i, j) });
    i = j;
  }
  if (stack.length !== 1) throw new Error(`<${stack[stack.length - 1].tag}> from line ${stack[stack.length - 1].line} is never closed`);
  return top.kids;
}

// ---------- text the way JSX reads it: indentation and line breaks between tags go ----------
function cleanText(value) {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) lastNonEmpty = i; });
  let str = '';
  lines.forEach((l, i) => {
    let t = l.replace(/\t/g, ' ');
    if (i !== 0) t = t.replace(/^[ ]+/, '');
    if (i !== lines.length - 1) t = t.replace(/[ ]+$/, '');
    if (t) { if (i !== lastNonEmpty) t += ' '; str += t; }
  });
  return str;
}

// ---------- holes ----------
const HOLE = /\{\{\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*\}\}/g;
function parts(s) {
  const out = [];
  let last = 0;
  for (const m of s.matchAll(HOLE)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push({ h: m[1].split('.') });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  if (s.replace(HOLE, '').includes('{{')) throw new Error('A hole that is not a plain name: ' + s);
  return out;
}
const onlyHole = (s) => { const p = parts(s); return p.length === 1 && typeof p[0] === 'object' ? p[0] : null; };

// ---------- React prop names and styles ----------
const NAMES = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', autocomplete: 'autoComplete', inputmode: 'inputMode', enterkeyhint: 'enterKeyHint', spellcheck: 'spellCheck', autocapitalize: 'autoCapitalize', autocorrect: 'autoCorrect', colspan: 'colSpan', rowspan: 'rowSpan', crossorigin: 'crossOrigin', 'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace' };
function propName(n) {
  if (NAMES[n]) return NAMES[n];
  if (/^(aria|data)-/.test(n)) return n;
  return n.includes('-') ? n.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : n;
}
export function styleObject(str) {
  const o = {};
  let depth = 0, quote = '', cur = '';
  const decls = [];
  for (const ch of str) {
    if (quote) { if (ch === quote) quote = ''; cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { decls.push(cur); cur = ''; continue; }
    cur += ch;
  }
  decls.push(cur);
  for (const d of decls) {
    const k = d.indexOf(':');
    if (k < 0) continue;
    const prop = d.slice(0, k).trim();
    const val = d.slice(k + 1).trim();
    if (!prop || !val) continue;
    const key = prop.startsWith('--') ? prop
      : prop.replace(/^-ms-/, 'ms-').replace(/^-(webkit|moz)-/, (m, p) => p[0].toUpperCase() + p.slice(1) + '-').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[key] = val;
  }
  return o;
}

// ---------- the tree ----------
let count = { el: 0, ifs: 0, fors: 0, holes: 0 };
function convert(nodes) {
  const out = [];
  for (const n of nodes) {
    if ('text' in n) {
      const t = cleanText(decode(n.text));
      if (!t) continue;
      for (const p of parts(t)) { out.push(p); if (typeof p === 'object') count.holes++; }
      continue;
    }
    const attrs = Object.fromEntries(n.attrs);
    if (n.tag === 'sc-if') {
      const h = onlyHole(attrs.value || '');
      if (!h) throw new Error(`<sc-if> at line ${n.line} needs value="{{ name }}"`);
      count.ifs++;
      out.push({ if: h.h, c: convert(n.kids) });
      continue;
    }
    if (n.tag === 'sc-for') {
      const h = onlyHole(attrs.list || '');
      if (!h || !attrs.as) throw new Error(`<sc-for> at line ${n.line} needs list="{{ name }}" and as`);
      count.fors++;
      out.push({ for: h.h, as: attrs.as, c: convert(n.kids) });
      continue;
    }
    if (n.tag.startsWith('sc-')) throw new Error(`<${n.tag}> at line ${n.line} is not known`);
    count.el++;
    const el = { t: n.tag };
    const a = {}, d = {};
    for (const [name, value] of n.attrs) {
      if (name.startsWith('hint-')) continue;
      const key = propName(name);
      if (value === null) { a[key] = true; continue; }
      const p = parts(value);
      const dynamic = p.some((x) => typeof x === 'object');
      if (!dynamic) { a[key] = key === 'style' ? styleObject(value) : value; continue; }
      count.holes++;
      d[key] = p.length === 1 ? p[0] : p;
    }
    if (Object.keys(a).length) el.a = a;
    if (Object.keys(d).length) el.d = d;
    const c = convert(n.kids);
    if (c.length) el.c = c;
    out.push(el);
  }
  return out;
}

const tree = convert(parse(template));

/* The canvas shows the app in a frame the size of a phone screen, so 100vh there is the screen. On a phone
   100vh is taller than what Safari leaves between its bars, so the app uses 100dvh, and the outer box fills
   whatever the page gives it (height 100%: the page sizes it, see src/app/tools/workshop/app). */
(function sizes(nodes) {
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    if (n.a && n.a.style) for (const k in n.a.style) if (n.a.style[k] === '100vh') n.a.style[k] = '100dvh';
    if (n.c) sizes(n.c);
  }
})(tree);
const first = tree.find((n) => n && typeof n === 'object' && n.t);
if (!first || !first.a || !first.a.style || first.a.style.height !== '100dvh') throw new Error('Expected the app to start with a full-height box');
first.a.style.height = '100%';

const code = `/* eslint-disable */
// @ts-nocheck
/* GENERATED by scripts/workshop-tools/build.mjs from scripts/workshop-tools/Main.dc.html
   (the 'Raf Workshop Tools' design canvas). Do not edit: change the canvas, copy the file over and run the script. */

export const CSS = ${JSON.stringify(css)};

export const TEMPLATE = ${JSON.stringify(tree)};

export function defineComponent(DCLogic) {
${logic}
  return Component;
}
`;
writeFileSync(out, code);
console.log(`Wrote ${out}: ${count.el} elements, ${count.ifs} sc-if, ${count.fors} sc-for, ${count.holes} holes, ${(code.length / 1024).toFixed(0)} KB`);
