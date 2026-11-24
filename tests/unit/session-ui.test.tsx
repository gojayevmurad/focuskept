// SPDX-License-Identifier: AGPL-3.0-only
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { sessionLabel, partnerPresenceMessage } from "@/src/lib/sessions/label";
import type { RoomState } from "@/src/lib/sessions/lifecycle";
import { Room, RoomStage } from "../../app/[locale]/session/[id]/room";
import {
  Calendar,
  type CalendarData,
} from "../../app/[locale]/(app)/book/calendar";
import { ThemeToggle } from "@/src/components/theme-toggle";
vi.mock("@/src/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/src/lib/realtime/client", () => ({ useRealtime: vi.fn() }));
vi.mock("@/src/lib/video/client", () => ({ createVideoClient: vi.fn() }));
vi.mock("@/src/lib/analytics/client", () => ({
  trackSessionJoined: vi.fn(),
  trackVideoFailed: vi.fn(),
  trackBookingViewed: vi.fn(),
}));
vi.mock("../../app/[locale]/(app)/people/actions", () => ({
  toggleFavorite: vi.fn(),
}));
vi.mock("../../app/[locale]/(app)/book/actions", () => ({
  bookSlot: vi.fn(),
  cancel: vi.fn(),
  chooseFallback: vi.fn(),
  joinGroup: vi.fn(),
}));

const now = new Date().toISOString();
function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="UTC"
      now={new Date(now)}
    >
      {node}
    </NextIntlClientProvider>,
  );
}
function roomState(): RoomState {
  return {
    session: {
      id: "session",
      type: "pair",
      title: null,
      hostId: null,
      startAt: now,
      durationMin: 50,
      status: "live",
      isFallbackRoom: false,
      focusAt: null,
      wrapAt: null,
    },
    window: "open",
    serverTime: now,
    me: "me",
    participants: ["me", "partner"].map((userId) => ({
      userId,
      displayName: userId === "me" ? "Me" : "Alex",
      username: userId,
      avatarUrl: null,
      bio: userId === "partner" ? "Writing a novel, one chapter at a time." : "",
      goalText: null,
      outcome: null,
      joined: true,
      present: userId !== "me",
      tracks: null,
    })),
  };
}
function renderRoom(state: RoomState) {
  return render(
    <Room
      initial={state}
      appName="FocusKept"
      provider="none"
      microphoneDefault={false}
      timeZone="UTC"
      canFavorite
      favorites={[]}
    />,
  );
}
describe("session room", () => {
  it("offers Rejoin after reloading a joined but absent participant, without the summary", () => {
    const html = renderRoom(roomState());
    expect(html).toContain("You left the session");
    expect(html).toContain("Rejoin</button>");
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain(messages.room.howDidItGo);
    expect(html).not.toContain(messages.room.favorite);
  });
  it("shows Summary once an early-ended session is over", () => {
    const state = roomState();
    state.session.status = "ended";
    state.window = "over";
    const html = renderRoom(state);
    expect(html).toContain(messages.room.howDidItGo);
    expect(html).not.toContain("Rejoin</button>");
  });
  it("shows Summary when the scheduled time ends even if the worker has not run", () => {
    const state = roomState();
    state.session.startAt = new Date(Date.now() - 51 * 60_000).toISOString();
    expect(renderRoom(state)).toContain(messages.room.howDidItGo);
  });
  it("centres the pre-join camera check, partner bio, goal suggestions and timeline", () => {
    const state = roomState();
    state.participants[0].present = true;
    const html = renderRoom(state);
    expect(html).toContain("Focus session with Alex");
    expect(html).toContain("Your camera preview");
    expect(html).toContain("Writing a novel, one chapter at a time.");
    expect(html).toContain("Draft the intro");
    expect(html).toContain("Clear my inbox");
    expect(html).toContain("Study chapter 4");
    expect(html).toContain("Hello + goal");
    expect(html).toContain("Quiet focus");
    expect(html).toContain("Check-in");
    expect(html).toContain("Join with camera");
    expect(html).toContain("Sessions are never recorded.");
    expect(html).not.toContain('data-layout="pair"');
    expect(html).not.toContain("PhoneOff");
  });
  function stage(state: RoomState) {
    return render(<RoomStage state={state} remote={{}} localVideo={{ current: null }} micOn={false} provider="none" />);
  }
  it("places the partner on the main stage and self in picture in picture", () => {
    const html = stage(roomState());
    expect(html).toContain('data-layout="pair"');
    expect(html.indexOf('data-role="partner"')).toBeLessThan(html.indexOf('data-role="self"'));
    expect(html).toMatch(/class="[^"]*pip[^"]*" data-role="self"/);
  });
  it("distinguishes a partner who left from a partner yet to arrive", () => {
    const state = roomState();
    state.participants[1].present = false;
    expect(stage(state)).toContain("Left the session");
    state.participants[1].joined = false;
    expect(stage(state)).toContain("Waiting for Alex…");
  });
  it("keeps two-person open rooms in the pair layout and highlights the host in real groups", () => {
    const state = roomState();
    state.session.type = "group";
    state.session.isFallbackRoom = true;
    expect(stage(state)).toContain('data-layout="pair"');
    state.participants.push({ ...state.participants[1], userId: "third", displayName: "Sam" });
    expect(stage(state)).toContain('data-layout="group"');
    state.session.isFallbackRoom = false;
    state.session.hostId = "partner";
    expect(stage(state)).toContain('data-role="partner" data-host="true"');
  });
  it("includes the clock, remaining time and goal reminder after leaving", () => {
    const state = roomState();
    state.participants[0].goalText = "Finish the introduction";
    const html = renderRoom(state);
    expect(html).toContain("the session is still running");
    expect(html).toContain("Finish the introduction");
    expect(html).toContain(messages.room.backDashboard);
  });
  it("summarizes duration, goals, partner outcomes and quiet labelled safety actions", () => {
    const state = roomState();
    state.window = "over";
    state.participants[0].goalText = "Finish the introduction";
    state.participants[1].goalText = "Study chapter 4";
    state.participants[1].outcome = "partial";
    const html = renderRoom(state);
    expect(html).toContain("Session length: 50 minutes");
    expect(html).toContain("Finish the introduction");
    expect(html).toContain("Study chapter 4");
    expect(html).toContain("Partly");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('href="/book"');
    expect(html).toContain('aria-label="Report"');
  });
  it("distinguishes a first join from a return in live presence notices", () => {
    const t = createTranslator({ locale: "en", messages, namespace: "room" });
    expect(
      partnerPresenceMessage({ displayName: "Alex", joined: true }, false, t),
    ).toBe("Alex left the session");
    expect(
      partnerPresenceMessage({ displayName: "Alex", joined: true }, true, t),
    ).toBe("Alex is back");
    expect(
      partnerPresenceMessage({ displayName: "Alex", joined: false }, true, t),
    ).toBeNull();
    expect(partnerPresenceMessage(undefined, undefined, t)).toBeNull();
  });
});
describe("fallback room labels shared by room, calendar and dashboard", () => {
  const t = createTranslator({
    locale: "en",
    messages,
    namespace: "sessionLabels",
  });
  const fallback = {
    isFallbackRoom: true,
    type: "group",
    title: "Ignored fallback title",
  };
  it("uses Open room with zero other joined participants", () => {
    expect(sessionLabel(fallback, [], t)).toBe("Open room");
    expect(sessionLabel(fallback, [{ name: "Alex", joined: false }], t)).toBe(
      "Open room",
    );
  });
  it("uses the sole joined partner’s name, even when other seats have never joined", () => {
    expect(
      sessionLabel(
        fallback,
        [
          { name: "Alex", joined: true },
          { name: "Sam", joined: false },
        ],
        t,
      ),
    ).toBe("Focus session with Alex");
  });
  it("keeps larger open rooms and actual group labels distinct", () => {
    expect(
      sessionLabel(
        fallback,
        [
          { name: "Alex", joined: true },
          { name: "Sam", joined: true },
        ],
        t,
      ),
    ).toBe("Open room");
    expect(
      sessionLabel({ ...fallback, isFallbackRoom: false, title: null }, [], t),
    ).toBe("Group session");
    expect(
      sessionLabel(
        { ...fallback, isFallbackRoom: false, title: "Writing hour" },
        [],
        t,
      ),
    ).toBe("Writing hour");
  });
});
function calendarData(startAt: string, sessionId: string | null): CalendarData {
  return {
    timeZone: "UTC",
    now,
    days: [
      {
        key: "today",
        start: now,
        slots: [{ at: startAt, demand: {}, popular: false }],
      },
    ],
    mine: [
      {
        id: "booking",
        startAt,
        durationMin: 50,
        sessionId,
        status: sessionId ? "matched" : "booked",
        kind: "pair",
        partner: "Alex",
        label: null,
        fallbackOffered: true,
      },
    ],
    groups: [],
    favorites: [],
    plan: "plus",
    billingEnabled: false,
    usage: null,
    usedByDay: {},
    prefill: { start: startAt, partner: null, duration: null },
    prevWeek: null,
    nextWeek: now,
  };
}
describe("booking management after start", () => {
  it("offers a primary Join now link instead of cancel or late-cancel copy", () => {
    const html = render(
      <Calendar
        data={calendarData(
          new Date(Date.now() - 60_000).toISOString(),
          "session",
        )}
      />,
    );
    expect(html).toContain('href="/session/session" class="button">Join now');
    expect(html).not.toContain(messages.book.cancelBooking);
    expect(html).not.toContain(messages.book.lateCancel);
  });
  it("explains waiting and offers the existing open-room action", () => {
    const html = render(
      <Calendar
        data={calendarData(new Date(Date.now() - 60_000).toISOString(), null)}
      />,
    );
    expect(html).toContain(messages.book.startedWaiting);
    expect(html).toContain("Join the open room</button>");
    expect(html).not.toContain(messages.book.cancelBooking);
  });
  it("keeps cancellation and late-cancel policy before the start", () => {
    const html = render(
      <Calendar
        data={calendarData(
          new Date(Date.now() + 30 * 60_000).toISOString(),
          "session",
        )}
      />,
    );
    expect(html).toContain(messages.book.cancelBooking);
    expect(html).toContain(messages.book.lateCancel);
  });
  it("shows the supplied fallback room label in the calendar and booking dialog", () => {
    const data = calendarData(now, "session");
    data.mine[0].label = "Focus session with Alex";
    data.mine[0].kind = "group";
    const html = render(<Calendar data={data} />);
    expect(html.match(/Focus session with Alex/g)).toHaveLength(2);
    expect(html).not.toContain(messages.book.groupSeat);
  });
});
it("theme control names its current System state", () => {
  expect(render(<ThemeToggle />)).toContain(
    'aria-label="Color theme: System. Activate to change."',
  );
});
