# AGENTS.md — sg-okf-tools

> Reglas de desarrollo para agentes (estándar abierto: Claude Code, Codex, Gemini, Cursor).
> Este paquete es la **fuente única de verdad** del tooling OKF de SolidGraph (ADR-0016 de
> sg-webpage): los repos consumen `@solidgraph-io/okf-tools` desde el registry, nunca copias.

## Reglas

1. **TDD.** Un test en rojo antes de cada comportamiento; todo bug empieza por un test que lo
   reproduce (`pnpm test`, Vitest, fixtures sintéticos en `test/`).
2. **Config-driven, no fork.** Nada específico de un repo consumidor se hornea en el código:
   raíz del bundle, taxonomía, archivos reservados/generados y reglas de IDs van por
   `okf.config.json`. Los defaults reproducen el comportamiento validado en sg-webpage.
3. **Permisividad OKF (§9).** Duro solo lo mínimo (frontmatter parseable, `type` no vacío,
   `okf_version` en el index raíz); todo lo demás es warning. No lo endurezcas.
4. **Compatibilidad de salida.** El output generado (marcas de `okf index`, formato de bullets,
   prefijos de log) es contrato: los consumidores hacen diff/`--check` sobre él. Cambiarlo es
   **breaking change** (semver major/minor con changelog).
5. **Dependencias mínimas.** Runtime: solo `yaml` + builtins de Node. Piénsalo dos veces antes
   de añadir nada.
6. **Git Flow.** `main`/`develop`/`feature/*`; Conventional Commits (`feat|fix|chore|docs`,
   scopes `okf|cli|config`). Al cerrar un incremento: merge a `develop` y borrar la rama.
7. **Publicación = humano.** `npm publish` y el pipeline de release requieren OK explícito del
   humano (ver PUBLISHING.md). Nunca commitear tokens.
8. **Semver + CHANGELOG.** Cada release documenta sus cambios; `prepublishOnly` corre
   build + tests.

## Verificación antes de decir "listo"

```
pnpm build && pnpm test
node dist/cli.js check --config ./test/fixtures/okf.config.json
```
