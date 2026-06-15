import { emptyCaptchaSurfaceHints } from "./captchaSurface";
import { emptyManipulationSurfaceHints } from "./manipulationSurface";
import { sanitizedTabUrl } from "./urlSanitize";
import type { FieldProfile, PageSnapshot } from "./types";
import { hostFromInput } from "../urlHost";

export function emptyFieldProfile(): FieldProfile {
  return {
    has_password: false,
    has_hidden_password: false,
    has_email: false,
    has_tel: false,
    has_file: false,
    has_otp: false,
    has_payment: false,
    has_identity: false,
  };
}

export function buildEmptySnapshot(pageUrl: string, collectionError: string): PageSnapshot {
  const pageOrigin = sanitizedTabUrl(pageUrl);
  const pageHost = hostFromInput(pageUrl);

  return {
    page_url: pageOrigin !== "" ? pageOrigin : pageUrl.trim().slice(0, 8192),
    page_host: pageHost,
    page_origin: pageOrigin,
    collection_ok: false,
    collection_error: collectionError,
    has_credential_form: false,
    forms: [],
    submit_buttons: [],
    iframes: [],
    meta_refresh_target: "",
    meta_refresh_delay_sec: null,
    base_href_origin: "",
    canonical_host: "",
    external_script_origins: [],
    total_resource_count: 0,
    external_resource_count: 0,
    external_resource_ratio: 0,
    brand_hits: [],
    primary_brand_hits: [],
    hidden_input_count: 0,
    is_framed: false,
    field_profile: emptyFieldProfile(),
    prominent_image: null,
    favicon: null,
    captcha_surface: emptyCaptchaSurfaceHints(),
    manipulation_surface: emptyManipulationSurfaceHints(),
  };
}
