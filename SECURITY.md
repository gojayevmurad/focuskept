# Security

Report vulnerabilities privately to [security@focuskept.com](mailto:security@focuskept.com) or through [GitHub private vulnerability reporting](https://github.com/gojayevmurad/focuskept/security/advisories/new). Do not open public issues for vulnerabilities.

Include:

- A description of the issue and its likely impact.
- Affected files, routes, and the commit or version tested.
- Reproduction steps or a minimal proof of concept.
- Relevant logs with secrets and personal data removed.

We aim to acknowledge reports within 3 business days. We will follow up with questions, findings, and a fix plan where applicable. Please coordinate public disclosure with us while we investigate.

## Supported versions

Only the latest `main` is supported. Update to current `main` before checking whether an issue is already fixed.

## Scope

Application code, authentication, authorization, billing, video access, and the worker are in scope. Long-lived video provider credentials stay server side; browsers receive only the session-scoped credentials needed to join. Rate limits and block/report handling are part of the open code. Include the video provider and relevant configuration in reports, without sharing keys.
