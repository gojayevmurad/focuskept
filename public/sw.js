// SPDX-License-Identifier: AGPL-3.0-only
// Service worker: shows push notifications and opens the linked page on click.
self.addEventListener("push", (event) => {
  let data = { title: "Reminder", body: "", url: "/dashboard", tag: undefined };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon.svg",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(url.origin));
      if (open) {
        open.navigate(url.href);
        return open.focus();
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
