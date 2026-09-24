#!/usr/bin/env bash
#
# Entorno de desarrollo completo con un solo comando (`bun run dev`):
#
#   1. anvil — la chain local — **sólo si no hay ya una** escuchando en el RPC
#      (y sólo si esa chain es la 31337: el nodo de otro proyecto no se usa);
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
# El chainId que este script considera "su" chain local. Si en 8545 contesta
# otra red, es el nodo de otro: no se lo toca ni se lo usa.
CHAIN_ID_LOCAL=31337
# La raíz del repo, para poder importar `config.js` aunque el script se corra
# desde otro directorio.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PATH="$HOME/.bun/bin:$HOME/.foundry/bin:$PATH"

# 0. La dirección del Fund de la red local, DERIVADA de `src/js/config.js` (no
#    copiada): si el deploy cambia de dirección, este script la sigue solo. El
#    módulo es puro y sin `location` `defaultChainId()` devuelve 31337, así que
#    se puede importar desde Node.
FUND="$(cd "$ROOT" && node --input-type=module -e '
import { NETWORKS, DEFAULT_CHAIN_ID } from "./src/js/config.js";
const red = NETWORKS[DEFAULT_CHAIN_ID];
if (!red?.fund) process.exit(1);
console.log(red.fund);
' 2>/dev/null)" || FUND=""
if [ -z "$FUND" ]; then
  echo "!! no pude derivar la dirección del Fund desde src/js/config.js (NETWORKS[DEFAULT_CHAIN_ID].fund)" >&2
  exit 1
fi
if ! [[ "$FUND" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "!! src/js/config.js devolvió una dirección de Fund que no es una address: '$FUND'" >&2
  exit 1
fi

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
chain_id_del_rpc() { cast chain-id --rpc-url "$RPC" 2>/dev/null || true; }

if ! command -v anvil >/dev/null 2>&1; then
  echo "!! no encuentro 'anvil'. Instalá Foundry o agregá \$HOME/.foundry/bin al PATH." >&2
  exit 1
fi

# 1. La chain.
if rpc_responde; then
  CHAIN_ID_ACTUAL="$(chain_id_del_rpc)"
  if [ "$CHAIN_ID_ACTUAL" != "$CHAIN_ID_LOCAL" ]; then
    echo "!! en $RPC contesta la red $CHAIN_ID_ACTUAL, no la $CHAIN_ID_LOCAL que usa este proyecto." >&2
    echo "   No la uso: podría ser el nodo de otro proyecto y el Fund de config.js no existe ahí." >&2
    exit 1
  fi
  echo "→ ya hay una chain en $RPC (chainId $CHAIN_ID_ACTUAL): no levanto otra"
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
