# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in react-mnemonic, please report it
responsibly through
[GitHub Security Advisories](https://github.com/thirtytwobits/react-mnemonic/security/advisories/new).
This ensures the report is handled privately and you receive credit for the
discovery.

**Please do not open a public issue for security vulnerabilities.**

### What to include

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- The version(s) affected

### What to expect

We will acknowledge receipt of your report and provide an initial assessment as
soon as practical. Because react-mnemonic is currently in **alpha**, the project
does not guarantee any SLA for response times or fixes. We will make a
best-effort attempt to address confirmed vulnerabilities promptly, but timelines
may vary.

## Scope

react-mnemonic is a client-side React library that persists state to browser
storage. It does not make network requests, handle authentication, or process
untrusted server input. Security concerns most likely to apply include:

- Injection or XSS via stored values
- Prototype pollution through deserialization
- Denial of service through schema validation

## Supported Versions

During the alpha phase, only the latest published version receives security
fixes. There is no backporting to older alpha releases.

| Version      | Supported |
| ------------ | --------- |
| Latest alpha | Yes       |
| Older alphas | No        |
