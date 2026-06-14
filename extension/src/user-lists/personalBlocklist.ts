import { hostFromInput } from "../layers/urlHost";

const STORAGE_KEY = "personalBlocklistUrls";
const WHITELIST_STORAGE_KEY = "personalAllowlistHosts";

export function normalizeUrlForPersonalBlock(url: string): string {
  const t = url.trim();
  if (t === "") {
    return "";
  }
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return t;
  }
  const proto = u.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") {
    return t;
  }
  let host = u.hostname.toLowerCase();
  if (host === "") {
    return t;
  }
  const port = u.port;
  const authority = port ? `${host}:${port}` : host;
  let path = u.pathname;
  if (path === "") {
    path = "/";
  }
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return `${proto}//${authority}${path}${u.search}`;
}

async function isHostOnWhitelist(host: string): Promise<boolean> {
  const data = await chrome.storage.local.get(WHITELIST_STORAGE_KEY);
  const value = data[WHITELIST_STORAGE_KEY];
  if (!Array.isArray(value)) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== "string") {
      continue;
    }
    const h = hostFromInput(item);
    if (h === host) {
      return true;
    }
  }
  return false;
}

async function saveHostList(hosts: string[]): Promise<void> {
  const bag: Record<string, string[]> = {};
  bag[STORAGE_KEY] = hosts;
  await chrome.storage.local.set(bag);
}

async function getPersonalBlocklist(): Promise<string[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const value = data[STORAGE_KEY];
  if (value === undefined || value === null || !Array.isArray(value)) {
    return [];
  }

  let hadFullUrl = false;
  const hosts: string[] = [];

  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== "string" || item.length === 0) {
      continue;
    }
    if (item.includes("://")) {
      hadFullUrl = true;
    }
    const h = hostFromInput(item);
    if (h === "") {
      continue;
    }
    let dup = false;
    for (let j = 0; j < hosts.length; j++) {
      if (hosts[j] === h) {
        dup = true;
        break;
      }
    }
    if (!dup) {
      hosts.push(h);
    }
  }

  if (hadFullUrl) {
    await saveHostList(hosts);
  }

  return hosts;
}

export async function addPersonalBlock(url: string): Promise<boolean> {
  const host = hostFromInput(url);
  if (host === "") {
    return false;
  }

  if (await isHostOnWhitelist(host)) {
    return false;
  }

  const list = await getPersonalBlocklist();

  for (let i = 0; i < list.length; i++) {
    if (list[i] === host) {
      return false;
    }
  }
  list.push(host);
  await saveHostList(list);
  return true;
}

export async function removePersonalBlock(url: string): Promise<void> {
  const host = hostFromInput(url);
  const list = await getPersonalBlocklist();
  const next: string[] = [];

  for (let i = 0; i < list.length; i++) {
    if (list[i] !== host) {
      next.push(list[i]);
    }
  }
  await saveHostList(next);
}

export async function isUrlPersonallyBlocked(url: string): Promise<boolean> {
  const host = hostFromInput(url);
  if (host === "") {
    return false;
  }
  const list = await getPersonalBlocklist();

  for (let i = 0; i < list.length; i++) {
    if (list[i] === host) {
      return true;
    }
  }
  return false;
}

export async function listPersonalBlocklistHosts(): Promise<string[]> {
  return getPersonalBlocklist();
}
