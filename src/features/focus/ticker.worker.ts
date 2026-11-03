// Dedicated worker timers are not throttled like background-tab timers, so
// phase ends are detected on time even when the tab is hidden.
let interval: ReturnType<typeof setInterval> | undefined;
let alarm: ReturnType<typeof setTimeout> | undefined;

self.onmessage = (
  event: MessageEvent<{ type: "start" | "stop" | "alarm"; at?: number }>,
) => {
  const message = event.data;
  if (message.type === "start") {
    clearInterval(interval);
    interval = setInterval(() => self.postMessage({ type: "tick" }), 1000);
  } else if (message.type === "stop") {
    clearInterval(interval);
    clearTimeout(alarm);
  } else if (message.type === "alarm") {
    clearTimeout(alarm);
    if (message.at)
      alarm = setTimeout(
        () => self.postMessage({ type: "due" }),
        Math.max(0, message.at - Date.now()),
      );
  }
};
