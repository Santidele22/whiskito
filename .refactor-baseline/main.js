//LIBRARIES
import {
  createPublicClient,
  createWalletClient,
  custom,
} from "https://esm.sh/viem";

//DOM — IDs tomados de src/index.html
const connectButton = document.getElementById("connectButton");
const balanceDisplay = document.getElementById("balanceDisplay");
const ehtAmount = document.getElementById("ehtAmount");
const fundButton = document.getElementById("fundButton");

let walletClient;
let publicClient;

async function ConnectAccount() {
  //Solo detecta la wallet solamente si el usuario tiene descargado el plugin en su browser.
  if (typeof window.ethereum === "undefined") {
    //Investigar que tipo de error aparece en un proyecto real
    throw new Error("No hay wallet visible, por favor instala una");
  }
  walletClient = createWalletClient({
    transport: custom(window.ethereum),
  });
  console.log("Wallet", walletClient);
  publicClient = createPublicClient({
    transport: custom(window.ethereum),
  });
  console.log("CLIENT", publicClient);

  await walletClient.requestAddresses();
  connectButton.innerHTML = "<span>Conectado</span>";
}

async function GetBalances() {
  const balance = await publicClient.getBalances({
    addrees: "",
  });
  if (balance <= 0) {
    alert("no tenes saldo");
  }
}

async function Withdraw() {}

connectButton.addEventListener("click", ConnectAccount);
balanceDisplay.addEventListener("click", GetBalances);
// withdrawButton: el HTML nuevo no tiene botón de retiro (el panel de #panel es un mockup estático)
