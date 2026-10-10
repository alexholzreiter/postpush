function minutes(value) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

export function isWithinActiveWindow(date, activeFrom, activeUntil) {
  const current = date.getHours() * 60 + date.getMinutes();
  const start = minutes(activeFrom);
  const end = minutes(activeUntil);
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function evaluateMailEvent(settings, { now = new Date(), lastAcceptedAt = 0 } = {}) {
  if (!settings.enabled) return { accepted: false, reason: "disabled" };
  if (
    settings.scheduleEnabled &&
    !isWithinActiveWindow(now, settings.activeFrom, settings.activeUntil)
  ) {
    return { accepted: false, reason: "quiet-hours" };
  }
  if (now.getTime() - lastAcceptedAt < settings.cooldownSeconds * 1000) {
    return { accepted: false, reason: "cooldown" };
  }
  return { accepted: true, reason: "accepted" };
}

export function isMailPayload(payload) {
  const text = String(payload ?? "").trim();
  if (["mail", "on", "true", "1"].includes(text.toLowerCase())) return true;
  try {
    const parsed = JSON.parse(text);
    return parsed?.event === "mail" || parsed?.post === true;
  } catch {
    return false;
  }
}
