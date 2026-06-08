const MAX_SCAN_CHARS = 400;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeScanText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, MAX_SCAN_CHARS);
}

function brandsInText(text: string, brandIds: readonly string[]): string[] {
  const normalized = normalizeScanText(text);
  if (normalized === "" || brandIds.length === 0) {
    return [];
  }

  const hits: string[] = [];
  for (let i = 0; i < brandIds.length; i++) {
    const brand = brandIds[i];
    const pattern = new RegExp(`\\b${escapeRegex(brand)}\\b`, "i");
    if (pattern.test(normalized)) {
      hits.push(brand);
    }
  }
  return hits;
}

function mergeUnique(existing: string[], extra: string[]): string[] {
  const out = [...existing];
  for (let i = 0; i < extra.length; i++) {
    const brand = extra[i];
    if (!out.includes(brand)) {
      out.push(brand);
    }
  }
  return out;
}

export function matchBrandsFromPage(
  brandIds: readonly string[],
  getTitle: () => string,
  getPrimaryTexts: () => string[],
  getSecondaryTexts: () => string[],
): {
  primary_brand_hits: string[];
  brand_hits: string[];
} {
  let primary: string[] = [];
  try {
    primary = mergeUnique(primary, brandsInText(getTitle(), brandIds));
  } catch {
    // ignore
  }

  try {
    const primaryTexts = getPrimaryTexts();
    for (let i = 0; i < primaryTexts.length; i++) {
      primary = mergeUnique(primary, brandsInText(primaryTexts[i], brandIds));
    }
  } catch {
    // ignore
  }

  let all = [...primary];
  try {
    const secondaryTexts = getSecondaryTexts();
    for (let i = 0; i < secondaryTexts.length; i++) {
      all = mergeUnique(all, brandsInText(secondaryTexts[i], brandIds));
    }
  } catch {
    // ignore
  }

  return {
    primary_brand_hits: primary,
    brand_hits: all,
  };
}
