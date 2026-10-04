import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, catalog, pack] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/data/catalog.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../public/data/rule-pack.json', import.meta.url), 'utf8').then(JSON.parse),
]);

// A DOM test double, not a second application. It supports the browser
// operations used during boot and user navigation, and reads the real HTML.
class Element {
  constructor(document, tag, attributes = {}) {
    this.document = document;
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.dataset = Object.fromEntries(Object.entries(attributes)
      .filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
    this.id = attributes.id || '';
    this.disabled = Object.hasOwn(attributes, 'disabled');
    this.value = attributes.value || '';
    this.open = false;
    this.children = [];
    this.scrollWidth = this.clientWidth = 0;
    this.validity = { valid: true };
    const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)),
      contains: value => classes.has(value),
      toggle: (value, force) => {
        const on = force ?? !classes.has(value);
        if (on) classes.add(value); else classes.delete(value);
        return on;
      },
    };
    this._html = '';
    this.textContent = '';
  }
  set innerHTML(value) {
    this._html = String(value);
    this.children = this.document.parse(this._html);
  }
  get innerHTML() { return this._html; }
  setAttribute(key, value) {
    this.attributes.set(key, String(value));
    if (key === 'disabled') this.disabled = true;
  }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) {
    this.attributes.delete(key);
    if (key === 'disabled') this.disabled = false;
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return selector.slice(1).split('.').every(value => this.classList.contains(value));
    const attr = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);
    if (attr) return this.attributes.has(attr[1]) && (attr[2] === undefined || this.attributes.get(attr[1]) === attr[2]);
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  querySelectorAll(selector) { return this.document.select(selector, this.children); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  click() { if (!this.disabled) return this.onclick?.({target: this, preventDefault() {}}); }
  focus() { this.document.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  scrollIntoView() {}
}
class Document {
  constructor(markup) {
    this.listeners = new Map();
    this.elements = this.parse(markup);
    this.documentElement = this.elements.find(element => element.tagName === 'HTML');
    this.activeElement = this.elements.find(element => element.tagName === 'BODY');
  }
  parse(markup) {
    return [...markup.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)].map(([, tag, raw]) => {
      const attributes = Object.fromEntries([...raw.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
        .map(([, name, double, single, bare]) => [name, double ?? single ?? bare ?? '']));
      return new Element(this, tag, attributes);
    });
  }
  select(selector, elements = this.elements) {
    const all = elements.flatMap(element => [element, ...this.descendants(element)]);
    return [...new Set(selector.split(',').flatMap(part => {
      const tokens = part.trim().split(/\s+/);
      if (tokens.length === 1) return all.filter(element => element.matches(tokens[0]));
      return all.filter(element => element.matches(tokens[0]))
        .flatMap(parent => this.select(tokens.slice(1).join(' '), parent.children));
    }))];
  }
  descendants(element) { return element.children.flatMap(child => [child, ...this.descendants(child)]); }
  querySelectorAll(selector) { return this.select(selector); }
  querySelector(selector) { return this.select(selector)[0] || null; }
  getElementById(id) { return this.querySelector('#' + id); }
  createElement(tag) { return new Element(this, tag); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  keydown(options) {
    const event = { key: '', target: this.activeElement, preventDefault() {}, ...options };
    for (const callback of this.listeners.get('keydown') || []) callback(event);
  }
}
function deferred() {
  let resolve, settled = false;
  const promise = new Promise(done => { resolve = value => { if (!settled) { settled = true; done(value); } }; });
  return { promise, resolve };
}
let imports = 0;
async function boot(t) {
  const document = new Document(html), ready = deferred();
  const responses = new Map([
    ['./data/catalog.json', deferred()], ['./data/rule-pack.json', deferred()],
  ]);
  const called = new Set(), storage = new Map();
  let reloads = 0;
  const globals = {
    document,
    window: { scrollTo() {}, print() {} },
    location: { href: 'https://example.test/lawdiff/', origin: 'https://example.test', search: '', reload() { reloads++; } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) },
    fetch: async input => {
      const url = String(input);
      if (responses.has(url)) {
        called.add(url);
        if (called.size === 2) ready.resolve();
        return responses.get(url).promise;
      }
      // Optional integrity reports are deliberately unavailable; startup must
      // not turn that into a failure or require network access in this test.
      return { ok: false, status: 404, json: async () => null };
    },
  };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  const url = new URL('../public/app.mjs',import.meta.url);
  url.searchParams.set('startup-test',String(++imports));
  const loaded = import(url.href);
  loaded.catch(() => {});
  t.after(async () => {
    for (const response of responses.values()) response.resolve({ok:false,status:503,json:async()=>null});
    await loaded.catch(() => {});
    await new Promise(done => setImmediate(done));
    for (const [key,descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  });
  await Promise.race([ready.promise, loaded.then(() => {throw Error('App finished before requesting both startup files');})]);
  return { document, window: globals.window, loaded, responses, reloads: () => reloads,
    resolve(name, value, ok = true) { responses.get('./data/'+name+'.json').resolve({ok,status:ok?200:503,json:async()=>structuredClone(value)}); } };
}
const controls = document => document.querySelectorAll('[data-view], #command-button, #import-button, #download-pack, #pack-file');
function assertLocked(document) {
  const items = controls(document);
  assert.equal(items.length,8,'four data views, search, import, export and file input');
  for (const item of items) assert.equal(item.disabled,true,item.id || item.dataset.view);
}
function tryEarlyActions(document) {
  // Native .click() must be disabled. A queued/direct handler also must not
  // render absent data; Cmd/Ctrl-K bypasses button disabled semantics entirely.
  const integrity = document.querySelectorAll('[data-view]').find(x => x.dataset.view === 'integrity');
  assert.doesNotThrow(() => integrity.click());
  assert.doesNotThrow(() => integrity.onclick());
  assert.doesNotThrow(() => document.querySelector('#command-button').onclick());
  assert.doesNotThrow(() => document.keydown({key:'k',metaKey:true}));
  assert.doesNotThrow(() => document.keydown({key:'K',ctrlKey:true}));
  assert.doesNotThrow(() => document.querySelector('#import-button').onclick());
  assert.equal(document.querySelector('#command-dialog').open,false);
  assert.equal(document.querySelector('#import-dialog').open,false);
}

test('startup keeps navigation, search and import locked until both real data files validate', {timeout:10000}, async t => {
  const app = await boot(t), d = app.document;
  assertLocked(d);
  tryEarlyActions(d);
  assert.equal(app.window.lawdiff,undefined);
  assert.equal(d.querySelector('#workspace').getAttribute('aria-busy'),'true');
  app.resolve('catalog',catalog);
  await new Promise(done => setImmediate(done));
  assertLocked(d);
  tryEarlyActions(d);
  app.resolve('rule-pack',pack);
  await app.loaded;
  for (const item of controls(d)) assert.equal(item.disabled,false,item.id || item.dataset.view);
  assert.equal(app.window.lawdiff.getState().rules,pack.rules.length);
  assert.equal(d.querySelector('#workspace').getAttribute('aria-busy'),'false');
  const integrity = d.querySelectorAll('[data-view]').find(x => x.dataset.view === 'integrity');
  assert.doesNotThrow(() => integrity.click());
  assert.match(d.querySelector('#workspace').innerHTML,/Confidence needs evidence/);
  d.keydown({key:'k',metaKey:true});
  assert.equal(d.querySelector('#command-dialog').open,true);
  assert.match(d.querySelector('#command-results').innerHTML,/EXPLORE THE SAMPLE/);
  d.querySelector('#import-button').click();
  assert.equal(d.querySelector('#import-dialog').open,true);
});

test('failed startup remains locked, renders a retry action and never opens search', {timeout:10000}, async t => {
  const app = await boot(t), d = app.document;
  app.resolve('catalog',null,false);
  await app.loaded;
  assertLocked(d);
  tryEarlyActions(d);
  assert.equal(app.window.lawdiff,undefined);
  assert.equal(d.querySelector('#workspace').getAttribute('aria-busy'),'false');
  assert.match(d.querySelector('#workspace').innerHTML,/We could not open this collection/);
  const retry=d.querySelector('#retry-load');
  assert.ok(retry,'failure provides an actionable retry');
  assert.equal(retry.disabled,false);
  retry.click();
  assert.equal(app.reloads(),1);
});

test('a successful HTTP response with an invalid rule pack does not unlock the app', {timeout:10000}, async t => {
  const app=await boot(t), d=app.document;
  app.resolve('catalog',catalog);
  app.resolve('rule-pack',{rules:[{team_rule_id:'invalid-record'}]});
  await app.loaded;
  assertLocked(d);
  tryEarlyActions(d);
  assert.equal(app.window.lawdiff,undefined);
  assert.ok(d.querySelector('#retry-load'));
  assert.match(d.querySelector('#workspace').innerHTML,/We could not open this collection/);
});
