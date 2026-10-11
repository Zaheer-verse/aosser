# Aosser security review

Review date: **11 October 2026**. This review covers the browser compression and download flow, the current authentication configuration, dependencies, and repository checks. It is not a penetration test or an independent certification.

## Checked locally

| Area                   | Result and scope                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dependency advisories  | The npm audit report contained **0 known vulnerabilities across 503 reported dependencies**, including production and development dependencies. This is a point-in-time result against the npm advisory service.                                                               |
| File processing        | Reviewed image, video, PDF, and DOCX compressor entry points plus the queue. These paths process local browser `File`/`Blob` objects and do not contain a file-upload API call.                                                                                                |
| Downloads              | Download URLs use local object URLs. Empty outputs are rejected. ZIP output replaces path separators and control characters, keeps entries at the archive root, and resolves duplicate names without overwriting files.                                                        |
| File lifetime          | Queue removal and clearing revoke associated object URLs; stale compression completions are discarded after cancellation or removal. Results are held in page memory.                                                                                                          |
| Input boundary         | Empty files and files larger than 1 GiB are rejected at queue entry. Files are processed sequentially. This does not impose an equivalent cap on decoded memory usage.                                                                                                         |
| Authentication         | Authentication remains disabled for this utility. Enabling it requires an explicit server-side OAuth secret; the previously embedded preview credential is absent from the current source. The historical exposure remains disclosed in `SECURITY.md`.                         |
| Workflow configuration | Added a scheduled npm audit and CodeQL security-extended analysis. Verified checkout, setup-node, and CodeQL version pins against their official GitHub release/tag records. Kept the existing checksum-verified Gitleaks checks and their exact historical finding exception. |

## Continuous checks

The repository runs [dependency auditing](https://github.com/Zaheer-verse/aosser/actions/workflows/dependency-audit.yml), [CodeQL](https://github.com/Zaheer-verse/aosser/actions/workflows/codeql.yml), and [secret scanning](https://github.com/Zaheer-verse/aosser/actions/workflows/secret-scan.yml). Each workflow runs on code changes and weekly. The Actions run associated with a commit is the authoritative result for that revision. CodeQL findings must also be reviewed in the repository's Security tab; a completed analysis job alone does not mean there are zero findings.

The secret scan treats the current checkout independently from the historical exception. A successful history scan means no unexcepted findings, not removal or revocation of the historical credential. Gitleaks was not run locally as part of this review; the repository workflow performs that scan.

## Remaining limits

- A malformed file, many queued files, a highly compressed DOCX archive, or a large decoded image/video/PDF can exhaust browser memory or CPU. The DOCX parser does not currently impose a separate limit on expanded archive bytes or entry count. Compression is not a safe sandbox for arbitrary hostile files.
- Compression does not certify that a document is harmless, remove all active content or metadata, or provide malware scanning. DOCX parts that are not recompressed are preserved; some results intentionally retain the original file when compression would make it larger.
- Browser codecs, parser dependencies, hosting configuration, and extensions affect security. The review did not test every file format variation, physical device, hosting provider, or browser extension.
- Local processing does not imply offline operation. App assets and Google Fonts can generate network requests. The optional platform extension is disabled by default in this version.
- The historical shared preview credential has an unknown revocation status. Only its issuer can revoke or replace it; deleting source does not revoke a credential.

Report suspected vulnerabilities through the private channel described in [SECURITY.md](../SECURITY.md).

## Workflow references

- [GitHub CodeQL workflow configuration](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options)
- [CodeQL Action v4.38.3](https://github.com/github/codeql-action/releases/tag/v4.38.3), pinned to `24c54180a607b1449ed407dd24f251e4e9147c8d`
- [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), pinned to `949feb2413d6458794dcd2491c4babbbce0c15c1`
- [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), pinned to `3d3c42e5aac5ba805825da76410c181273ba90b1`
