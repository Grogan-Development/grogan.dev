# grogan.dev

Personal site for Zack Grogan — a software developer.

This is not a development group, agency, studio, or hireable shop. The public
page is intentionally minimal.

## Deploy

Hosted on Railway as the `toolbox-home` service in the `grogan-foundry` project.
Custom domains: `grogan.dev`, `www.grogan.dev`.

```bash
railway up -p grogan-foundry -e production -s toolbox-home -c -m "personal blank site"
```

## Local

```bash
npm ci
npm run dev
```
