# Security policy

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** option if private vulnerability reporting is enabled. Include the affected revision, a clear description, reproduction steps, likely impact, and a minimal non-sensitive proof of concept.

If private reporting is unavailable, open a public issue asking the maintainer for a private contact channel. Do not disclose exploit details, credentials, personal files, or sensitive logs in that issue. No response-time guarantee is currently published.

## Supported scope

Security fixes are considered for the current default branch. There is no published support schedule for older versions.

The app processes files in the browser. Its compression flow does not upload file contents, requires no account, and does not persist a server-side file history. File buffers and results remain in memory until the page is closed or the queue is cleared. Downloaded files are then managed by the browser and operating system.

The app still loads its own assets, font resources, and platform scripts over the network. Local file processing does not mean that the webpage makes no network requests. Deployment-host behavior and browser extensions are outside this repository's control.

## Areas that warrant scrutiny

- Parsing malformed image, media, PDF, and DOCX input.
- Excessive memory or CPU use from large or highly compressed inputs.
- Filename handling, duplicate ZIP entries, and browser download behavior.
- Accidental introduction of file uploads, logging of file contents, or client-visible secrets.
- Dependencies used for parsing and encoding untrusted files.

Use synthetic inputs when investigating a report. Never commit real user files, `.env` files, API tokens, private keys, deployment metadata, or runtime logs. The included platform integration helpers remain disabled for this app; enabling them requires a separate security review and configuration.
