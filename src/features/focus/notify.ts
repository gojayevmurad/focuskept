"use client";

/** Ask once, from a user gesture (starting the first session), never on page load. */
export async function requestNotificationPermission() {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "default"
  )
    return;
  try {
    await Notification.requestPermission();
  } catch {}
}

/** Shows a system notification only when the tab is hidden. */
export async function notifyWhenHidden(title: string, body: string) {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return;
  if (!document.hidden) return;
  const options: NotificationOptions = {
    body,
    tag: "focuskept-timer",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, {
        ...options,
        data: { url: location.href },
      });
      return;
    }
  } catch {}
  try {
    new Notification(title, options);
  } catch {}
}
