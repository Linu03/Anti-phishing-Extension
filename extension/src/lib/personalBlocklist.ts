// chrome.storage.local 

const STORAGE_KEY = "personalBlocklistUrls";

export async function getPersonalBlocklist(): Promise<string[]>{

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const value = data[STORAGE_KEY];

  if (value === undefined || value === null){
    return [];
  }

  if (!Array.isArray(value)){
    return [];
  }

  const urls: string[] = [];

  for (let i = 0; i < value.length; i++){
    const item = value[i];
    if (typeof item === "string" && item.length > 0){
      urls.push(item);
    }
  }
  
  return urls;
}

async function setPersonalBlocklist(urls: string[]): Promise<void>{
  const toSave: Record<string, string[]> = {};
  toSave[STORAGE_KEY] = urls;
  await chrome.storage.local.set(toSave);
}

export async function addPersonalBlock(url: string): Promise<void>{
  const clean = url.trim();
  if (clean === ""){
    return;
  }

  const list = await getPersonalBlocklist();

  for (let i = 0; i < list.length; i++){
    if (list[i] === clean){
      return;
    }
  }
  list.push(clean);
  await setPersonalBlocklist(list);
}

export async function removePersonalBlock(url: string): Promise<void>{

  const clean = url.trim();
  const list = await getPersonalBlocklist();
  const next: string[] = [];

  for (let i = 0; i < list.length; i++){
    if (list[i] !== clean){
      next.push(list[i]);
    }
  }
  await setPersonalBlocklist(next);
}

export async function isUrlPersonallyBlocked(url: string): Promise<boolean>{

  const clean = url.trim();
  const list = await getPersonalBlocklist();

  for (let i = 0; i < list.length; i++){
    if (list[i] === clean){
      return true;
    }
  }
  return false;
}
