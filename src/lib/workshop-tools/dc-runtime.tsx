'use client';
/* Renders the Workshop Tools app as designed on the design canvas (app.generated.js, made by
   scripts/workshop-tools/build.mjs) with React.

   The canvas runs its apps in a page of their own with the browser's plain styles, so the app is drawn inside
   a shadow root: the site's Tailwind reset and styles never reach it, and it looks exactly as it did on the
   canvas. The logic class is the canvas's own (class Component extends DCLogic); DCLogic here is a few lines:
   state, setState and a redraw. */

import { createElement as h, Fragment, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Path = string[];
type Hole = { h: Path };
type Part = string | Hole;
type El = { t: string; a?: Record<string, unknown>; d?: Record<string, Hole | Part[]>; c?: Node[] };
type If = { if: Path; c: Node[] };
type For = { for: Path; as: string; c: Node[] };
type Node = string | Hole | El | If | For;
type Scope = { name: string; val: unknown; up: Scope } | null;
type Vals = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */
export class DCLogic {
  state: Record<string, any> = {};
  props: Record<string, any> = {};
  _redraw: (() => void) | null = null;
  _drawing = false;
  setState(patch: Record<string, any> | ((s: Record<string, any>) => Record<string, any> | null) | null) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    if (!p) return;
    this.state = Object.assign({}, this.state, p);
    if (!this._redraw) return;
    // a change made while drawing waits for the drawing to finish
    if (this._drawing) queueMicrotask(() => this._redraw && this._redraw());
    else this._redraw();
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function look(path: Path, scope: Scope, v: Vals): unknown {
  let cur: unknown;
  let s = scope;
  let found = false;
  while (s) {
    if (s.name === path[0]) { cur = s.val; found = true; break; }
    s = s.up;
  }
  if (!found) cur = v[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[path[i]];
  }
  return cur;
}

const styles = new Map<string, Record<string, string>>();
function styleObject(str: string): Record<string, string> {
  const hit = styles.get(str);
  if (hit) return hit;
  const o: Record<string, string> = {};
  let depth = 0, quote = '', cur = '';
  const decls: string[] = [];
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
  if (styles.size > 3000) styles.clear();
  styles.set(str, o);
  return o;
}

function text(x: unknown): ReactNode {
  if (x == null || typeof x === 'boolean' || typeof x === 'object' || typeof x === 'function') return null;
  return x as string | number;
}

function draw(nodes: Node[], scope: Scope, v: Vals): ReactNode[] {
  const out: ReactNode[] = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) out[i] = one(nodes[i], scope, v);
  return out;
}

function one(n: Node, scope: Scope, v: Vals): ReactNode {
  if (typeof n === 'string') return n;
  if ('h' in n) return text(look(n.h, scope, v));
  if ('if' in n) return look(n.if, scope, v) ? h(Fragment, null, ...draw(n.c, scope, v)) : null;
  if ('for' in n) {
    const list = look(n.for, scope, v);
    if (!Array.isArray(list)) return null;
    return list.map((item, i) => h(Fragment, { key: i }, ...draw(n.c, { name: n.as, val: item, up: scope }, v)));
  }
  const props: Record<string, unknown> = n.a ? { ...n.a } : {};
  if (n.d) {
    for (const k in n.d) {
      const spec = n.d[k];
      let val: unknown;
      if (Array.isArray(spec)) {
        let s = '';
        for (const p of spec) s += typeof p === 'string' ? p : String(look(p.h, scope, v) ?? '');
        val = s;
      } else {
        val = look(spec.h, scope, v);
      }
      if (k === 'style' && typeof val === 'string') val = styleObject(val);
      if (val === undefined) continue;
      props[k] = val;
    }
  }
  if ((n.t === 'input' || n.t === 'textarea') && 'value' in props && props.value == null) props.value = '';
  return n.c ? h(n.t, props, ...draw(n.c, scope, v)) : h(n.t, props);
}

export type DcApp = {
  CSS: string;
  TEMPLATE: Node[];
  defineComponent: (base: typeof DCLogic) => new () => DCLogic & {
    renderVals: () => Vals;
    componentDidMount?: () => void;
    componentWillUnmount?: () => void;
    [k: string]: unknown;
  };
};

/* `setup` runs once the app is on screen, with the app's instance (for the page to hand it what it knows:
   how this phone installs apps, whether Pro is on sale yet), and returns its own clean-up. */
export function DcRoot({ app, initial, setup, fallback, className }: {
  app: DcApp;
  initial?: Record<string, unknown>;
  setup?: (inst: DCLogic & Record<string, unknown>) => (() => void) | void;
  fallback?: ReactNode;
  className?: string;
}) {
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const inst = useRef<(DCLogic & { renderVals: () => Vals; componentDidMount?: () => void; componentWillUnmount?: () => void; [k: string]: unknown }) | null>(null);
  if (!inst.current) {
    const Comp = app.defineComponent(DCLogic);
    inst.current = new Comp();
    if (initial) inst.current.state = { ...initial };
  }
  const host = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const setupRef = useRef(setup);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setShadow(el.shadowRoot || el.attachShadow({ mode: 'open' }));
  }, []);

  useEffect(() => {
    if (!shadow) return;
    const i = inst.current!;
    i._redraw = redraw;
    i.componentDidMount?.();
    const undo = setupRef.current?.(i);
    return () => {
      if (typeof undo === 'function') undo();
      i.componentWillUnmount?.();
      i._redraw = null;
    };
  }, [shadow]);

  let tree: ReactNode = null;
  if (shadow) {
    const i = inst.current;
    i._drawing = true;
    let v: Vals;
    try {
      v = i.renderVals();
    } finally {
      i._drawing = false;
    }
    tree = createPortal(
      h(Fragment, null, h('style', null, ':host{all:initial;display:block;height:100%}\n' + app.CSS), ...draw(app.TEMPLATE, null, v)),
      shadow,
    );
  }
  return (
    <div ref={host} className={className}>
      {fallback}
      {tree}
    </div>
  );
}
