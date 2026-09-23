#!/usr/bin/env bash
#
# Entorno de desarrollo completo con un solo comando (`bun run dev`):
#
#   1. anvil — la chain local — **sólo si no hay ya una** escuchando en el RPC;
#   2. el deploy (mock del oráculo + Fund) **sólo si el contrato todavía no está**;
#   3. el servidor de desarrollo de Vite, con recarga en caliente.
#
# Al salir (Ctrl-C, o porque Vite murió) baja **sólo el anvil que levantó este
# script**: si ya tenías uno tuyo, lo deja como estaba. Ese es el motivo de que
# esto sea un script y no un `anvil & vite` en package.json: con el `&` suelto,
# el anvil sobrevive al comando y te deja el puerto 8545 ocupado.
#
# El deploy tampoco es incondicional a propósito: volver a deployar corre los
# nonces y las direcciones de `src/js/config.js` dejan de existir (ver AGENTS.md
# §4). Si el contrato ya está, no se toca nada.

set -uo pipefail

RPC="http://127.0.0.1:8545"
# La dirección del Fund de la red local, la misma de `src/js/config.js`.
FUND="0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"

export PATH="$HOME/.bun/bin:$HOME/.foundry/bin:$PATH"

ANVIL_PID=""
bajar_anvil() {
  if [ -n "$ANVIL_PID" ] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    echo "→ bajando el anvil que levanté (pid $ANVIL_PID)"
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
  ANVIL_PID=""
}
trap bajar_anvil EXIT
trap 'exit 130' INT TERM

rpc_responde() { cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; }

if ! command -v anvil >/dev/null 2>&1; then
  echo "!! no encuentro 'anvil'. Instalá Foundry o agregá \$HOME/.foundry/bin al PATH." >&2
  exit 1
fi

# 1. La chain.
if rpc_responde; then
  echo "→ ya hay una chain en $RPC: no levanto otra"
else
  echo "→ levantando anvil en $RPC"
  anvil --silent & ANVIL_PID=$!
  for _ in $(seq 1 40); do
    rpc_responde && break
    sleep 0.25
  done
  if ! rpc_responde; then
    if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
      echo "!! anvil no arrancó (¿el puerto de $RPC está ocupado por otra cosa?)" >&2
    else
      echo "!! anvil no llegó a responder en $RPC" >&2
    fi
    exit 1
  fi
fi

# 2. El deploy, sólo si hace falta.
CODIGO="$(cast code "$FUND" --rpc-url "$RPC" 2>/dev/null || true)"
if [ -z "$CODIGO" ]; then
  echo "!! no pude leer la chain en $RPC" >&2
  exit 1
elif [ "$CODIGO" = "0x" ]; then
  echo "→ el contrato no está deployado: lo deployo (bun run deploy)"
  bun run deploy
else
  echo "→ el contrato ya está deployado: no toco los nonces"
fi

# 3. Vite en primer plano (los argumentos extra se le pasan tal cual).
#    Sin `exec` a propósito: el shell tiene que sobrevivir para que el trap de
#    EXIT baje el anvil cuando Vite termine.
echo "→ servidor de desarrollo"
bunx --bun vite "$@"
