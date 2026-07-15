# PUBLISHING — @solidgraph-io/okf-tools

El paquete está **listo para publicar pero sin publicar** (ADR-0016 de sg-webpage: registry y
pipeline son infra del humano). Este documento describe el flujo cuando decidas activarlo.

## Prerrequisitos (una sola vez — pendientes del humano)

1. **Org npm `@solidgraph-io`** en npmjs.com (el scope `@solidgraph` quedó en una cuenta antigua
   sin acceso). Crear la org y añadir la cuenta que publica.
2. **`NPM_TOKEN`** de tipo *Automation* (o *Publish*) con permiso sobre el scope. Va **solo** por
   variable de entorno / secret de CI — nunca en el repo.
3. **Remote git** para `sg-okf-tools` en el host que uses y, si quieres releases automatizados,
   el pipeline (Drone u otro) con el secret dado de alta. Ajusta `repository.url` en
   `package.json` al host real si no es GitHub.

## Flujo de release manual

```sh
# 1. rama develop verde
pnpm install && pnpm build && pnpm test

# 2. versionar (semver) + changelog
#    - actualiza CHANGELOG.md con la sección de la nueva versión
npm version <patch|minor|major>   # crea commit + tag vX.Y.Z

# 3. publicar (prepublishOnly re-corre build+test)
NPM_TOKEN=… npm publish
#    publishConfig ya fija: access public + registry https://registry.npmjs.org
#    (opcional, recomendado en CI con OIDC): npm publish --provenance

# 4. push de rama y tag al remote
git push && git push --tags
```

## Pipeline de release (cuando exista — NO activo)

Esbozo del step de Drone equivalente; **no está creado a propósito** (requiere el secret y tu OK):

```yaml
# .drone.yml (futuro)
# - name: publish
#   image: node:22-alpine
#   environment:
#     NPM_TOKEN: { from_secret: npm_token }
#   commands:
#     - corepack enable && pnpm install
#     - echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc
#     - npm publish
#   when: { ref: { include: [refs/tags/v*] } }
```

## Checklist previo a cada publish

- [ ] `pnpm build && pnpm test` verdes
- [ ] CHANGELOG.md actualizado y versión semver correcta
- [ ] `npm pack --dry-run` muestra solo `dist/`, README, LICENSE, CHANGELOG
- [ ] Sin secretos en el árbol (`git grep -i token` limpio)
