export const PAGE_TEMPLATE_USER_MESSAGES = {
  restricted:
    "Browser pages can't be scanned. Only regular websites are supported.",
  notActive:
    "Page analysis isn't active yet. Address and certificate checks still apply.",
  collectionFailed:
    "Couldn't read this page's structure. Address and certificate were checked — proceed with caution.",
  collectionFailedTrusted:
    "Couldn't read this page's structure, but you've marked this site as trusted.",
} as const;
