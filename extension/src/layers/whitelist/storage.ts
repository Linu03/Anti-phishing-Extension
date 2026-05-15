import { hostFromInput } from "../../lib/urlHost";

const WHITELIST_STORAGE_KEY = "personalAllowlistHosts";
const BLOCKLIST_STORAGE_KEY = "personalBlocklistUrls";

async function saveWhitelistHosts(hosts: string[]): Promise<void> {
  const bag: Record<string, string[]> = {};
  bag[WHITELIST_STORAGE_KEY] = hosts;
  await chrome.storage.local.set(bag);
}

async function getWhitelistHosts(): Promise<string[]> {
  const data = await chrome.storage.local.get(WHITELIST_STORAGE_KEY);
  const value = data[WHITELIST_STORAGE_KEY];
  
  if (value === undefined || value === null || !Array.isArray(value)) 
  {
    return [];
  }

  const hosts: string[] = [];

  for (let i = 0; i < value.length; i++){

    const item = value[i];

    if (typeof item !== "string" || item.length === 0){
      continue;
    }
    const h = hostFromInput(item);
    if (h === ""){
      continue;
    }
    let alreadyInList = false;
    for (let j = 0; j < hosts.length; j++){
      if (hosts[j] === h){
        alreadyInList = true;
        break;
      }
    }
    if (!alreadyInList){
      hosts.push(h);
    }
  }
  return hosts;
}

async function isHostOnPersonalBlocklist(host: string): Promise<boolean> {
  const data = await chrome.storage.local.get(BLOCKLIST_STORAGE_KEY);
  const value = data[BLOCKLIST_STORAGE_KEY];

  if (!Array.isArray(value)){
    return false;
  }

  for (let i = 0; i < value.length; i++){

    const item = value[i];

    if (typeof item !== "string"){
      continue;
    }
    const h = hostFromInput(item);
    if (h === host){
      return true;
    }
  }

  return false;

}

export async function isUrlWhitelisted(url: string): Promise<boolean> {
  const host = hostFromInput(url);

  if (host === "") {
    return false;
  }

  const list = await getWhitelistHosts();

  for (let i = 0; i < list.length; i++){
    if (list[i] === host) {
      return true;
    }
  }

  return false;
}


export async function addWhitelist(url: string): Promise<boolean> {
  const host = hostFromInput(url);

  if (host === "") {
    return false;
  }

  if (await isHostOnPersonalBlocklist(host)){
    return false;
  }

  const list = await getWhitelistHosts();

  for (let i = 0; i < list.length; i++){
    if (list[i] === host) {
      return false;
    }
  }

  list.push(host);
  await saveWhitelistHosts(list);
  return true;

}

export async function removeWhitelist(url: string): Promise<void> {

  const host = hostFromInput(url);
  const list = await getWhitelistHosts();
  const next: string[] = [];

  for (let i = 0; i < list.length; i++){
    if (list[i] !== host) {
      next.push(list[i]);
    }
  }
  
  await saveWhitelistHosts(next);
}
