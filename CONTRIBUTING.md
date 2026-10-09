# Contributing to Dosser

Thank you for helping make local file compression more reliable and usable.

## Before you start

For substantial changes, open an issue describing the problem, the expected behavior, and a proposed approach. Keep bug reports reproducible and use synthetic or non-sensitive sample files. Never upload personal documents, tokens, credentials, or private logs to a public issue.

Contributions to the project are covered by its [MIT License](LICENSE). Dependencies remain subject to their respective licenses.

## Development workflow

1. Fork the repository and create a branch for one focused change.
2. Install dependencies with `npm ci` using Node.js 22.13 or newer in the 22.x release line.
3. Start development with `npm run dev`.
4. Add a regression test for behavior you fix when it can be tested meaningfully.
5. Run the checks below and test the affected behavior in a real browser.
6. Open a pull request explaining the problem, resulting behavior, and validation evidence.

```sh
npm test
npm run test:downloads
npm run typecheck
npm run build
```

Use `npm run lint` for lint feedback and format the files you change with the existing Prettier configuration. Avoid unrelated formatting or dependency updates.

## Browser verification

Changes to downloading or compression need browser validation as well as unit tests:

- Process and download a synthetic single file; inspect the downloaded bytes and filename.
- Prepare a ZIP, click to download it, and inspect its entries and content.
- Try repeated filenames to ensure every file is retained.
- Check cancellation and error handling where they apply.
- Check desktop and mobile layouts, keyboard access, and the browser console.
- Test the production build with `npm run preview` as well as development.

Record the browser, operating system, and whether the app was embedded. Do not claim support for a device or host you have not tested.

## Project conventions

- Keep file processing local. Introducing uploads, accounts, or persistent storage changes the product's privacy contract and requires an explicit design discussion.
- Keep a fresh user gesture available for downloading prepared ZIPs. Do not automatically trigger a download after asynchronous archive generation.
- Release object URLs only after the browser has had time to consume them, and handle archive naming without dropping duplicate files.
- Preserve the platform middleware, environment wrapper, preview bridge, and PWA/install assets.
- Put application routes in `src/routes/`; `server/` contains platform middleware.
- Do not commit generated build output, local metadata, runtime logs, secrets, or sample user files.

Use clear commit messages and keep each pull request small enough to review independently. The pull request template provides the expected summary and check list.
