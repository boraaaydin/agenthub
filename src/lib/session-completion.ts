export type SessionCloseOnExit = "never" | "always" | "on-success";

export type SessionOutcomeNotice = {
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
};

export type SessionCompletion = {
  closeOnExit: SessionCloseOnExit;
  success?: SessionOutcomeNotice;
  failure?: SessionOutcomeNotice;
};

const CLOSE_ON_EXIT_VALUES: readonly SessionCloseOnExit[] = [
  "never",
  "always",
  "on-success",
];

const MAX_NOTICE_TITLE_LENGTH = 200;
const MAX_NOTICE_MESSAGE_LENGTH = 5_000;
const MAX_NOTICE_ACTION_LABEL_LENGTH = 200;
const MAX_NOTICE_ACTION_HREF_LENGTH = 2_000;

function isRelativeHref(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_NOTICE_ACTION_HREF_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return false;
  }

  try {
    return new URL(value, "http://agenthub.local").origin === "http://agenthub.local";
  } catch {
    return false;
  }
}

function isNoticeAction(
  value: unknown,
): value is NonNullable<SessionOutcomeNotice["action"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const action = value as Record<string, unknown>;
  return (
    typeof action.label === "string" &&
    action.label.trim().length > 0 &&
    action.label.length <= MAX_NOTICE_ACTION_LABEL_LENGTH &&
    isRelativeHref(action.href)
  );
}

function isOutcomeNotice(value: unknown): value is SessionOutcomeNotice {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const notice = value as Record<string, unknown>;
  return (
    typeof notice.title === "string" &&
    notice.title.trim().length > 0 &&
    notice.title.length <= MAX_NOTICE_TITLE_LENGTH &&
    typeof notice.message === "string" &&
    notice.message.trim().length > 0 &&
    notice.message.length <= MAX_NOTICE_MESSAGE_LENGTH &&
    (notice.action === undefined || isNoticeAction(notice.action))
  );
}

export function isSessionCompletion(value: unknown): value is SessionCompletion {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const completion = value as Record<string, unknown>;
  return (
    typeof completion.closeOnExit === "string" &&
    CLOSE_ON_EXIT_VALUES.includes(completion.closeOnExit as SessionCloseOnExit) &&
    (completion.success === undefined || isOutcomeNotice(completion.success)) &&
    (completion.failure === undefined || isOutcomeNotice(completion.failure))
  );
}

function isSuccess(exitCode: number) {
  return exitCode === 0;
}

export function shouldCloseOnExit(
  completion: SessionCompletion | undefined,
  exitCode: number,
) {
  return (
    completion?.closeOnExit === "always" ||
    (completion?.closeOnExit === "on-success" && isSuccess(exitCode))
  );
}

export function completionNotice(
  completion: SessionCompletion | undefined,
  exitCode: number,
) {
  return isSuccess(exitCode)
    ? completion?.success ?? null
    : completion?.failure ?? null;
}
