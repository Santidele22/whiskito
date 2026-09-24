# CI (`.github/workflows/test.yml`) — dos jobs. El contexto del proyecto está en `AGENTS.md`.
- **`check`** — sin nada vivo: `forge fmt --check`, `forge build --sizes`, `forge test -vvv`
  (18 tests en `test/PolUsdAdapter.t.sol`: la derivación POL/USD y el piso de `Fund`), `node --check` recursivo sobre
  los `*.js` de `src/js/` (los módulos viven en subcarpetas: `entries/`, `solidity/`, `config/`, `dom/`, `utils/`,
  `roles/`) y `src/components/*.js`, `resolve-imports.mjs`, `check-config.mjs` contra el `broadcast/` de Amoy
  versionado y `bun run build` (el bundle que publica Vercel).
- **`e2e`** — la puerta de verdad: `run-harness.py` y después `run-donate-probe.py`, en Firefox
  headless y secuenciales (comparten chain y saldos); el job falla si alguno no dice
  `VERDICT: PASS`.
## Por qué el e2e levanta lo suyo
- **anvil propio**: los runners exigen la chain en `http://127.0.0.1:8545` (lo fijan `config.js` e
  `islands.html`) y en el runner no hay ninguna. Se levanta anvil, va `bun run deploy` y `cast code`
  comprueba que el deploy **dejó código** (`AGENTS.md` §4).
- **Firefox propio**: el de apt en `ubuntu-latest` es un wrapper de snap que no arranca en CI, así
  que va `browser-actions/setup-firefox`. El perfil `.refactor-baseline/.ff` está gitignoreado:
  crealo con su `user.js` (`dom.events.testing.asyncClipboard=true`) y borrá `.parentlock` antes de
  cada corrida.
## Correr lo mismo a mano
```bash
export PATH="$HOME/.bun/bin:$HOME/.foundry/bin:$PATH"   # anvil debe quedar en 8545: los runners no aceptan otro puerto
anvil --silent --chain-id 31337 &
mkdir -p .refactor-baseline/.ff && echo 'user_pref("dom.events.testing.asyncClipboard", true);' > .refactor-baseline/.ff/user.js
bun install --frozen-lockfile && bun run deploy         # + `cast code <address de config.js>` ≠ 0x
rm -f .refactor-baseline/.ff/.parentlock && python3 .refactor-baseline/verify-refactor/run-harness.py 8899
rm -f .refactor-baseline/.ff/.parentlock && python3 .refactor-baseline/verify-refactor/run-donate-probe.py 8899
```
