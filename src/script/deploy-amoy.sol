// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import {Script, console} from "forge-std/Script.sol";
import {Fund} from "./fund.sol";

/// Deploy de `Fund` en Polygon Amoy (chainId 80002).
///
/// Este script despliega SÓLO el contrato: el oráculo ya existe en la red, es el
/// feed real de Chainlink. El mock `MockV3Aggregator` es cosa del deploy local
/// (src/script/deploy.sol), no de acá.
///
/// El script es AGNÓSTICO AL FIRMANTE: no lee ninguna clave, ni del `.env` ni de
/// ningún otro lado. Quién firma lo elige la línea de comandos, así que las tres
/// vías son la misma llamada con un argumento distinto:
///
///   1) Keystore de Foundry (la vía recomendada). Se importa UNA sola vez:
///
///        cast wallet import deployer --interactive
///
///      y después se corre:
///
///        forge script src/script/deploy-amoy.sol --rpc-url amoy --broadcast --account deployer
///
///      (o `bun run deploy:amoy`, que es exactamente eso). Foundry pide la
///      password del keystore en la terminal; no vive en ningún archivo.
///
///   2) Clave privada al vuelo: `--private-key 0x…` en lugar de `--account`.
///      Sirve, pero escribe la clave en el historial del shell: por eso la vía
///      recomendada es el keystore.
///
///   3) Hardware wallet: `--ledger` (o `--trezor`) en el mismo lugar.
///
/// En los tres casos la clave privada queda FUERA de este script y de su salida:
/// acá no se lee ni se imprime, y lo único que se publica es la address del
/// contrato nuevo.
///
/// TRAMPA MEDIDA DEL PROYECTO (no la vuelvas a pagar): `forge script … --broadcast`
/// SIN `--account` / `--sender` / `--private-key` usa el *default sender* de
/// Foundry, **no despliega nada** —`cast code <address>` devuelve `0x`— y **igual
/// escribe** `broadcast/…/run-latest.json`, así que `check-config` queda en DRIFT
/// sin que haya nada en la chain. El firmante no es opcional.
contract DeployAmoyScript is Script {
    /// Feed ETH / USD de Chainlink en Polygon Amoy.
    ///
    /// Verificado en la chain: `description()` devuelve "ETH / USD" y
    /// `decimals()` devuelve 8 (o sea, el precio viene con 8 decimales, y
    /// `Fund.getConversionRate` lo reescala a 18). `latestRoundData()` respondía
    /// fresco al momento de fijarlo, así que el `STALENESS_THRESHOLD` de 3 horas
    /// del contrato lo acepta. Es ÉSTE y no otro porque es la dirección oficial
    /// del aggregator ETH/USD en Amoy.
    address internal constant AMOY_ETH_USD_FEED = 0xF0d50568e3A7e8259E16663972b11910F89BD8e7;

    function run() public {
        // Sin argumentos: el firmante lo pone la línea de comandos (`--account
        // deployer`, `--private-key` o `--ledger`). Acá NO se lee ninguna clave.
        vm.startBroadcast();

        Fund fund = new Fund(AMOY_ETH_USD_FEED);

        vm.stopBroadcast();

        // Lo único que se imprime es la address que se pega en `fund` de la
        // entrada 80002 en src/js/config.js. La address del deployer no se
        // imprime: adentro de un script `msg.sender` es la del script, no la del
        // broadcaster, así que no se puede derivar acá sin la clave. Sale de
        // `cast wallet address --account deployer`.
        console.log("Fund deployed at:", address(fund));
    }
}
