# Integrações por framework

O editor é framework-agnóstico — qualquer backend que sirva 3 endpoints
(upload, assets, save) consegue embutí-lo. Os guias por stack são pequenos
deltas em cima da API genérica:

- [django.md](django.md) — Django 4+ / 5 (referência completa)
- [laravel.md](laravel.md) — Laravel 10+ com CSRF via cookie XSRF-TOKEN
- [rails.md](rails.md) — Rails 7+ com `X-CSRF-Token`
- [express.md](express.md) — Node/Express com `csurf` ou cookie-csrf
- [static.md](static.md) — site estático (Netlify Forms / Cloudflare Pages)
