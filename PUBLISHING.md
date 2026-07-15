# PUBLISHING — @solidgraph-io/okf-tools

Estado: `0.1.0-beta.0` publicada (2026-07-15) bajo el dist-tag `beta` — GitHub pre-release
[`v0.1.0-beta.0`](https://github.com/solidgraph-io/sg-okf-tools/releases/tag/v0.1.0-beta.0).
Nota: npm auto-asigna `latest` en el **primer** publish de un paquete aunque uses `--tag beta`,
y el registry no permite borrarlo (400 en `DELETE dist-tags/latest`); se corrige solo al
publicar la primera estable sin `--tag`.

## Autenticación — el panorama 2026/2027 (importante)

La cuenta usa **security keys** (WebAuthn) como único 2FA: no hay códigos OTP tecleables.
Además, GitHub/npm [deprecó los granular access tokens con bypass de 2FA](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/):

- **Agosto 2026** — los tokens bypass-2FA pierden las operaciones sensibles (gestión de
  tokens, acceso de paquetes, maintainers, trusted publishing, orgs…).
- **Enero 2027** — los tokens bypass-2FA **pierden la capacidad de publicar**.

Consecuencia: **no montes pipelines nuevos sobre `NPM_TOKEN` con bypass de 2FA** — nacerían
con fecha de caducidad. Los dos flujos soportados aquí son:

### A. Release manual con aprobación web 2FA (el flujo actual, probado)

npm soporta el 2FA por navegador también sin TTY real: dale una pseudo-TTY y un `BROWSER`
que abra la URL donde puedas aprobar con la security key. Desde WSL:

```sh
# opener: abre $1 en el navegador de Windows
cat > /tmp/open-url.sh <<'EOF'
#!/bin/sh
exec /mnt/c/Windows/System32/cmd.exe /c start "" "$1" >/dev/null 2>&1
EOF
chmod +x /tmp/open-url.sh

pnpm install && pnpm build && pnpm test
npm version <X.Y.Z[-beta.N]> --no-git-tag-version   # + CHANGELOG; tag lo pone git flow
# … git flow: release/* → main (--no-ff) + tag vX.Y.Z → develop → push --follow-tags
# … gh release create vX.Y.Z [--prerelease] --target main

printf '\n' | script -qec "BROWSER=/tmp/open-url.sh npm publish [--tag beta] --access public" /dev/null
# npm abre la pestaña → apruebas con Face ID / security key → publish completa
```

Prerelease = `--tag beta` (+ `--prerelease` en la GitHub release). Estable = sin `--tag`
(mueve `latest`).

### B. CI automatizado: Trusted Publishing (OIDC) — el camino recomendado

npm/GitHub recomiendan **Trusted Publishing**: el workflow de GitHub Actions se autentica
con un token OIDC efímero — sin secretos de larga duración, sin 2FA en el job, con
provenance. Pasos cuando se active:

1. En npmjs.com → package settings → **Trusted Publishing**: vincular
   `solidgraph-io/sg-okf-tools` + el workflow (p. ej. `.github/workflows/release.yml`).
   (Operación sensible: se hace interactivamente con la security key.)
2. Workflow disparado por tag `v*` con `permissions: id-token: write`, `npm publish`
   (npm ≥ 11.5 detecta OIDC solo; `--provenance` incluido).
3. El staged publishing (publicar a staging y promover con 2FA humana) es la variante
   más conservadora si npm la ofrece para el paquete.

> El esbozo anterior de pipeline Drone con `NPM_TOKEN` se retiró de este doc: era
> exactamente el patrón deprecado. Drone no puede hacer trusted publishing de npm
> (solo GitHub Actions/GitLab CI emiten el OIDC aceptado); si el release ha de ser
> automatizado, va por GitHub Actions.

## npm v12 — seguridad en install-time (consumidores)

npm v12 deshabilita por defecto lifecycle scripts (`postinstall`…), git deps y URLs
remotas. **Este paquete no tiene lifecycle scripts, ni git deps, ni deps remotas**
(runtime: solo `yaml`), así que los consumidores no necesitan aprobar nada. Mantenerlo
así es parte del contrato (AGENTS.md §5: dependencias mínimas).

## Checklist previo a cada publish

- [ ] `pnpm build && pnpm test` verdes
- [ ] CHANGELOG.md actualizado y versión semver correcta
- [ ] `npm pack --dry-run` muestra solo `dist/`, README, LICENSE, CHANGELOG
- [ ] Sin secretos en el árbol (`git grep -i token` limpio)
- [ ] Prerelease → `--tag beta` + GitHub `--prerelease`; estable → sin `--tag` (mueve `latest`)
