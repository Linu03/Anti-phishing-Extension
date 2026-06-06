import type { AnalysisSnapshot } from "../types";
import { runFullTabAnalysis } from "./runFullTabAnalysis";

export async function loadActiveTabPhishingAnalysis(): Promise<AnalysisSnapshot> {
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

  return runFullTabAnalysis(url, title);
}
