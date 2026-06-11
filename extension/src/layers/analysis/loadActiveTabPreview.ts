export type TabPreview = {
  url: string;
  title: string;
};

export async function loadActiveTabPreview(): Promise<TabPreview> {
  const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabList[0];
  let url = "";
  if (currentTab && currentTab.url) {
    url = currentTab.url;
  }
  let title = "";
  if (currentTab && currentTab.title) {
    title = currentTab.title;
  }
  return { url, title };
}
