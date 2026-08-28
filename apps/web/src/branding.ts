import { formatAppDisplayName } from "./branding.logic";

export const HOSTED_APP_CHANNEL = null;
export const HOSTED_APP_CHANNEL_LABEL = null;
export const APP_BASE_NAME = "Nero";
export const APP_STAGE_LABEL = import.meta.env.DEV ? "Dev" : "Alpha";
export const APP_DISPLAY_NAME = formatAppDisplayName({
  baseName: APP_BASE_NAME,
  stageLabel: APP_STAGE_LABEL,
});
export const APP_VERSION = import.meta.env.APP_VERSION || "0.0.0";
