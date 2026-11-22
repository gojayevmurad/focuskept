// SPDX-License-Identifier: AGPL-3.0-only

export type ArticleTopic =
  | "gettingStarted"
  | "sessionsVideo"
  | "bookingMatching"
  | "accountPrivacy"
  | "billing"
  | "safetyReporting"
  | "troubleshooting";

export type Article = {
  slug: string;
  topic: ArticleTopic;
  title: string;
  summary: string;
  body: string;
  keywords: string[];
};

export const TOPIC_ORDER: ArticleTopic[] = [
  "gettingStarted",
  "sessionsVideo",
  "bookingMatching",
  "accountPrivacy",
  "billing",
  "safetyReporting",
  "troubleshooting",
];

export const ARTICLES: Article[] = [
  // Getting started
  {
    slug: "how-sessions-work",
    topic: "gettingStarted",
    title: "How a focus session works from start to finish",
    summary:
      "Understand the structure of a session: the check-in, quiet visual focus, and wrap-up.",
    body: `FocusKept is structured around virtual coworking and body doubling in quiet lap-swimming lanes. Sessions start synchronously on the hour and half-hour, lasting 25, 50, or 75 minutes.

Here is what happens in each session:

1. Check-in (First 2–4 minutes):
You and your focus partner join with cameras turned on and microphones unmuted. You take turns briefly introducing yourselves and stating the single, concrete task you plan to complete during the session. Keep it specific and realistic for the time available.

2. Quiet Focus (The main block):
Both participants mute their microphones. Cameras remain on so you can see each other working in adjacent visual lanes. The signature PaceClock sweeps steadily on screen. You work independently without conversational chatter, knowing your partner is right there working alongside you.

3. Wrap-up (Final 2–3 minutes):
When the PaceClock indicates wrap-up time, unmute your microphones. Check in with each other, share what you accomplished, log your outcome in the app, and say goodbye.`,
    keywords: [
      "how it works",
      "structure",
      "check-in",
      "wrap-up",
      "intro",
      "start",
      "pace clock",
      "body doubling",
    ],
  },
  {
    slug: "preparing-for-first-session",
    topic: "gettingStarted",
    title: "Preparing for your first focus session",
    summary:
      "A quick checklist to get your workspace, video, and goals ready before you join.",
    body: `To make the most of your first coworking block, take a couple of minutes to prepare before your session start time:

- Choose one clear task: Avoid vague goals like "work on thesis." Instead, pick an actionable step like "draft 500 words of section 2" or "clear 15 emails from client folder."
- Check your camera and microphone: Test your webcam and audio beforehand in your browser settings. Make sure your face or workspace is well lit.
- Set up a distraction-free space: Close irrelevant browser tabs, mute phone notifications, and grab a glass of water.
- Arrive two minutes early: Join your session room a moment before the hour or half-hour so you're ready when your partner enters.`,
    keywords: [
      "preparation",
      "checklist",
      "first time",
      "goals",
      "webcam",
      "audio",
      "lighting",
    ],
  },

  // Sessions & video
  {
    slug: "why-cameras-stay-on",
    topic: "sessionsVideo",
    title: "Why cameras stay on and microphones stay muted",
    summary:
      "Why visual presence without audio noise provides the psychological anchor for deep focus.",
    body: `FocusKept is based on the proven psychology of body doubling. For many people—especially remote workers, students, writers, and individuals with ADHD—having another person visibly working nearby acts as a gentle, non-judgmental accountability anchor.

- Cameras On: Seeing your partner focused in their lane gently pulls your attention back whenever your mind wanders or you feel tempted to open social media.
- Microphones Muted: Working in silence eliminates conversational friction, self-consciousness, and acoustic distractions. You don't have to worry about typing noise, background sounds, or having to chat.

If you must step away momentarily for a biological break or to grab water, that's completely fine. For unexpected interruptions, you can leave a quick note in the session goal or step out quietly.`,
    keywords: [
      "camera",
      "video",
      "mute",
      "microphone",
      "adhd",
      "body doubling",
      "quiet",
      "presence",
    ],
  },
  {
    slug: "choosing-session-length",
    topic: "sessionsVideo",
    title: "Choosing between 25, 50, and 75-minute sessions",
    summary:
      "How to match your task and energy level to the right session duration.",
    body: `FocusKept offers three standard session lengths:

- 25-Minute Sessions: Ideal for high-friction tasks you've been dreading, quick administrative chores, inbox zero sprints, or when your energy is low and you need an easy win to overcome inertia.
- 50-Minute Sessions: The standard work block. Provides ample time to sink into deep work, draft documents, write code, or review complex materials without cognitive fatigue.
- 75-Minute Sessions: Perfect for deep immersion, reading dense academic papers, long creative sessions, or extended study sets.

Tip: If you're struggling to start, book a 25-minute block. Starting small is the easiest way to break procrastination.`,
    keywords: [
      "duration",
      "length",
      "25 min",
      "50 min",
      "75 min",
      "pomodoro",
      "deep work",
      "procrastination",
    ],
  },
  {
    slug: "group-sessions-and-rooms",
    topic: "sessionsVideo",
    title: "Group sessions and hosted rooms",
    summary:
      "How multi-person focus groups work and how to join a hosted community room.",
    body: `In addition to 1:1 pair sessions, FocusKept supports group coworking rooms hosted by approved community hosts:

- Group Rooms: Multiple participants work in visual lanes together governed by the same PaceClock.
- Host Guidance: The host welcomes participants, initiates the check-in, rings the focus bell, and guides the final wrap-up check-in.
- Open Rooms: When booking a 1:1 slot, if no individual partner is available five minutes before start time, you can seamlessly opt into an open fallback room so you never miss your scheduled focus block.`,
    keywords: [
      "group",
      "community",
      "hosts",
      "open room",
      "fallback",
      "multi-user",
    ],
  },

  // Booking & matching
  {
    slug: "how-matching-works",
    topic: "bookingMatching",
    title: "How partner matching works",
    summary:
      "When matching happens, how preferences are prioritized, and what happens if no partner is available.",
    body: `Our matching algorithm runs automatically 5 minutes before every scheduled session:

- Timing: You book your slot ahead of time. At T-5 minutes, our algorithm pairs participants scheduled for the same start time and length.
- Pairing Criteria: The system prioritizes mutual favorite partners, then community members, then participants with shared work interests or segments (such as writing, coding, or studying), while strictly separating blocked pairs.
- Odd Numbers: If an odd number of people book a slot, the most recently booked participant is offered a fallback open room or the option to reschedule without penalty.`,
    keywords: [
      "matching",
      "algorithm",
      "pairing",
      "partner",
      "schedule",
      "segments",
      "five minutes",
    ],
  },
  {
    slug: "cancellation-policy",
    topic: "bookingMatching",
    title: "Cancellation policy and late cancellations",
    summary:
      "How to cancel a session respectfully and avoid inconveniencing your partner.",
    body: `Because another human being is reserving their time to focus with you, consistent attendance is essential:

- Free Cancellation: You can cancel any booking for free up to 1 hour before the session start time.
- Late Cancellation: Cancelling with less than 60 minutes remaining is recorded as a late cancellation. This gives our algorithm time to find a replacement partner for the person you were scheduled with.
- No-shows: Missing a session without cancelling leaves your partner waiting. Repeated late cancellations or no-shows negatively impact matching priority and may lead to booking limits.`,
    keywords: [
      "cancel",
      "cancellation",
      "late cancel",
      "no show",
      "one hour",
      "policy",
      "attendance",
    ],
  },
  {
    slug: "favorite-partners-and-direct-booking",
    topic: "bookingMatching",
    title: "Favorite partners and direct booking links",
    summary:
      "How to star partners you enjoy and share your personal booking page.",
    body: `Working repeatedly with partners who match your rhythm builds accountability:

- Favoriting: After a great session, you can star your partner as a favorite. When you both book the same time slot in the future, our matching algorithm prioritizes placing you together.
- Personal Booking Page (/u/username): Every member has a personal public link. Friends or colleagues can view your availability and book a slot directly with you.`,
    keywords: [
      "favorites",
      "preferred",
      "personal page",
      "booking link",
      "direct",
      "username",
    ],
  },

  // Account & privacy
  {
    slug: "privacy-and-video-security",
    topic: "accountPrivacy",
    title: "What partners can see and our zero-recording policy",
    summary:
      "How your privacy is protected during live coworking sessions.",
    body: `FocusKept treats privacy as a fundamental human right:

- Zero Recording: We never record, capture, or store session video or audio. Media streams pass directly through encrypted peer-to-peer WebRTC connections via Cloudflare Realtime or LiveKit.
- What Partners See: Other participants see your live video stream, hear you during unmuted check-ins, and can view your display name, avatar, bio, and declared session goal.
- What Partners Cannot See: Partners never have access to your screen, documents, private tabs, email, or account settings. Screen sharing is disabled by default.
- No Recording Rule: Our terms strictly prohibit participants from recording, photographing, or screenshotting other members.`,
    keywords: [
      "privacy",
      "recording",
      "webrtc",
      "cloudflare",
      "livekit",
      "security",
      "camera",
      "screen share",
    ],
  },
  {
    slug: "exporting-or-deleting-account",
    topic: "accountPrivacy",
    title: "Exporting your data or deleting your account (GDPR)",
    summary:
      "How to download your complete data record or permanently close your account.",
    body: `In compliance with the GDPR and global privacy standards, you maintain full ownership of your data:

- Data Export: Under Settings > Account, you can download a complete JSON archive of all personal data we hold about you, including your profile, bookings, focus history, milestones, and support correspondence.
- Account Deletion: You can permanently delete your account directly in Settings. Deletion irreversibly purges your personal profile, credentials, and session participation history from active databases.`,
    keywords: [
      "gdpr",
      "export",
      "delete",
      "account",
      "data portability",
      "erasure",
      "settings",
    ],
  },

  // Billing (only shown when billing is enabled)
  {
    slug: "free-plan-vs-plus",
    topic: "billing",
    title: "Free plan vs FocusKept Plus",
    summary:
      "Details on the 3 weekly free sessions and unlimited sessions with Plus.",
    body: `FocusKept believes everyone should have access to focused coworking:

- Free Plan: Includes 3 sessions per calendar week. Free sessions reset every Monday at midnight UTC. Includes full video access, partner matching, and streak tracking.
- Plus Plan: Provides unlimited sessions, favorite partner prioritization, and advanced matching filters.
- Instance Note: When billing is disabled by an instance operator, all users enjoy full, unlimited Plus access at zero cost.`,
    keywords: [
      "free",
      "plus",
      "pricing",
      "plans",
      "unlimited",
      "three sessions",
      "billing",
    ],
  },
  {
    slug: "managing-your-subscription",
    topic: "billing",
    title: "Managing and cancelling your Plus subscription",
    summary:
      "How payments, 7-day trials, invoices, and cancellations are handled via Polar.",
    body: `All payments and subscriptions are managed securely via Polar as the merchant of record:

- 7-Day Free Trial: New Plus subscribers enjoy a 7-day trial. You can cancel at any point before the trial ends to avoid being charged.
- Cancelling: Navigate to Settings > Plan and click "Manage billing". This opens your Polar customer portal where you can cancel renewal with one click.
- Access After Cancellation: If you cancel an active subscription, you retain Plus benefits until the end of your prepaid billing period.`,
    keywords: [
      "subscription",
      "cancel",
      "polar",
      "trial",
      "invoices",
      "refunds",
      "credit card",
    ],
  },

  // Safety & reporting
  {
    slug: "how-reporting-and-blocking-works",
    topic: "safetyReporting",
    title: "How reporting and blocking works",
    summary:
      "How to immediately protect yourself if a partner behaves inappropriately.",
    body: `Your psychological and personal safety is paramount:

- Leaving a Session: If anyone makes you uncomfortable, click "Leave session" immediately. You do not owe anyone an explanation.
- Reporting Also Blocks: Whenever you submit a report regarding another member, the system automatically creates a permanent block between your accounts. You will never be matched with that person again.
- Reporting Details: Because sessions are not recorded, please describe what occurred as specifically as possible so our moderation team can review and take action.`,
    keywords: [
      "report",
      "block",
      "safety",
      "inappropriate",
      "harassment",
      "moderation",
      "leave",
    ],
  },
  {
    slug: "account-suspensions-and-reviews",
    topic: "safetyReporting",
    title: "How moderation reviews and suspensions operate",
    summary:
      "Our 3-report safety threshold, review procedures, and how to appeal.",
    body: `We maintain strict community standards to keep FocusKept safe:

- Automatic Safety Pause: If an account receives 3 reports within a rolling 30-day window, the system automatically pauses the account, preventing further bookings pending human review.
- Investigation: Administrators review report logs, session metadata, and past conduct. Zero-tolerance violations (such as nudity, harassment, or hate speech) result in permanent bans.
- Appeals: If you believe your account was suspended in error, you can submit an appeal through our Contact form or email us at our support address.`,
    keywords: [
      "suspension",
      "three reports",
      "moderation",
      "investigation",
      "appeal",
      "paused",
      "ban",
    ],
  },

  // Troubleshooting
  {
    slug: "camera-and-mic-troubleshooting",
    topic: "troubleshooting",
    title: "Troubleshooting camera and microphone permissions",
    summary:
      "Fixing browser permission denials, black screens, or audio issues in Chrome, Safari, and Firefox.",
    body: `If your camera or microphone isn't connecting to the session room, check these common fixes:

1. Browser Permission Icons:
Look at the left side of your browser's address bar (the lock or tune icon). Ensure Camera and Microphone permissions are set to "Allow".

2. macOS System Permissions:
On Apple Mac computers, check System Settings > Privacy & Security > Camera and Microphone. Verify that your browser (Chrome, Safari, Firefox, Arc) has permission to access your hardware.

3. Another Application Is Using the Camera:
Close other video applications (Zoom, Teams, Google Meet, FaceTime, Skype) that may be holding exclusive locks on your webcam.

4. Reload the Room:
After adjusting permissions, refresh the session page. In Chrome or Edge, you can also reset permissions by clicking the padlock icon in the URL bar and choosing "Reset permissions".`,
    keywords: [
      "camera permissions",
      "microphone",
      "black screen",
      "chrome",
      "safari",
      "firefox",
      "webrtc",
      "audio not working",
    ],
  },
  {
    slug: "network-and-webrtc-connection-issues",
    topic: "troubleshooting",
    title: "Fixing network connection and WebRTC lag",
    summary:
      "Resolving VPN conflicts, corporate firewalls, and unstable video connections.",
    body: `FocusKept uses WebRTC for real-time video transport. If you experience disconnections or failing media streams:

- VPNs and Proxies: Some VPNs block UDP traffic or WebRTC signaling. Try temporarily disconnecting your VPN to see if connectivity restores.
- Corporate Firewalls: Strict corporate or university networks may block WebRTC ports. If possible, test on an unrestricted network or mobile hotspot.
- Bandwidth Allocation: Live video requires approximately 300–500 kbps per stream. Ensure other devices on your local network are not saturating your upload bandwidth.`,
    keywords: [
      "webrtc",
      "vpn",
      "firewall",
      "lag",
      "disconnection",
      "network",
      "udp",
      "wifi",
    ],
  },
];

export function getArticles(billingEnabled: boolean): Article[] {
  if (billingEnabled) return ARTICLES;
  return ARTICLES.filter((article) => article.topic !== "billing");
}

export function getArticleBySlug(
  slug: string,
  billingEnabled: boolean,
): Article | undefined {
  const articles = getArticles(billingEnabled);
  return articles.find((a) => a.slug === slug);
}

export function getTopics(billingEnabled: boolean): ArticleTopic[] {
  if (billingEnabled) return TOPIC_ORDER;
  return TOPIC_ORDER.filter((topic) => topic !== "billing");
}
