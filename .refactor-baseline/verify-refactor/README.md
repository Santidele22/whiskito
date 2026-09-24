# Verificación del refactor de módulos (`src/js/`)

Andamiaje de verificación, **no parte de la app**. Igual que el resto de
`.refactor-baseline/`, se puede borrar entero.

Sirve para el refactor que partió el `main.js` monolítico en módulos
(`config` · `constants` · `fund-abi` · `chain` · `solidity-functions` ·
`format` · `viewer-role` · `icons`) y dejó `main.js` como puerta de entrada.

## 1. Grafo de importaciones (sin navegador)

```bash
node .refactor-baseline/verify-refactor/resolve-imports.mjs . src/index.html
```

Recorre el grafo real de módulos ES desde los `<script type="module">` de la
página y falla si algún especificador relativo no resuelve a un archivo, o si
contiene espacios (el bug que tenía `from "../src/utils/constans.js "`).

**Ojo con la regex:** la versión ingenua
(`(?:import|export)\s+(?:[\s\S]*?from\s+)?["']…`) se come los imports de efecto
lateral (`import "x";`) porque el grupo opcional cruza líneas: reporta `OK`
salteándose un subárbol entero. Por eso acá hay tres patrones separados
(`from`, `import(`, `import "x"`). Cualquier reescritura debe revalidarse con
los controles negativos: un import faltante, un `import "x"` faltante, un
especificador multilínea roto y un especificador con espacio final.

## 2. Punta a punta (Firefox headless + el harness del proyecto)

```bash
python3 .refactor-baseline/verify-refactor/run-harness.py 8897
```

Levanta `serve.py` con `no-store`, abre `islands.html` (las 237 aserciones de
islas reactivas, Shadow DOM, QR y radio), y reporta el veredicto, **los 284
pedidos HTTP con su status** (un `404` es la señal directa de una ruta rota) y
qué módulos esperados bajó la página. Sale con código 1 si algo falla.

## 3. Cobertura del ABI

`src/js/solidity/fund-abi.js` es una copia de `src/fund.abi.json`; comparar los conjuntos
de `function`/`event`/`error`/`constructor` por nombre detecta entradas perdidas
al mover el archivo (el chequeo de imports no lo ve).
