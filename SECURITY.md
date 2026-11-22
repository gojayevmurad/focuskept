# Security Policy

FocusKept takes the security of our platform and user community seriously. We welcome responsible security research and vulnerability reports.

## Reporting a Vulnerability

Report vulnerabilities privately:

- **GitHub Security Advisories (Preferred)**: [Submit a private advisory](https://github.com/gojayevmurad/focuskept/security/advisories/new)
- **Email**: [security@focuskept.com](mailto:security@focuskept.com)
- **RFC 9116 security.txt**: Available at `/.well-known/security.txt`

Do not open public GitHub issues or discussions for vulnerabilities.

### What to Include

Please provide:

- A clear description of the vulnerability and its potential impact.
- Affected components, routes, files, or commit versions.
- Step-by-step reproduction instructions or a minimal proof of concept.
- Relevant HTTP requests, responses, or logs with sensitive credentials and personal data redacted.

## Response & SLAs

- **Initial Acknowledgement**: Within 3 business days.
- **Triage & Assessment**: Within 7 business days of acknowledgement.
- **Remediation & Disclosure**: We will collaborate with reporters on a remediation plan and coordinate public disclosure once a fix has been deployed.

## Supported Versions

Only the latest `main` branch is supported for security updates. Please verify against current `main` before reporting an issue.

## Scope

In scope:

- Core application code, authentication, session lifecycle, and authorization.
- Video access control, signaling proxy, and WebRTC token generation.
- Billing integration, Polar webhook verification, and entitlement management.
- Realtime Server-Sent Events (SSE) and pub/sub message dispatch.
- Account privacy, GDPR data export, and deletion workflows.
- Background worker jobs and scheduled queue processing.

Out of scope:

- Denial of Service (DoS/DDoS) attacks against third-party infrastructure.
- Social engineering, phishing, or physical attacks.
- Automated scanner outputs without demonstrated exploitability or proof of concept.
- Self-XSS or attacks requiring root/admin access on the user's local machine.

## Safe Harbor

We consider security research conducted under this policy to be authorized. We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service interruption.
- Report discovered vulnerabilities promptly and keep details confidential until remediation is complete.
- Do not exploit a vulnerability beyond what is strictly necessary to prove its existence.
