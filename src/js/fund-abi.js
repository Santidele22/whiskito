import { parseAbi } from "https://esm.sh/viem";

export const FUND_ABI = parseAbi([
  "constructor(address _priceFeedAddress)",
  // ── Lecturas ──
  "function MINIMUM_USD() view returns (uint256)",
  "function STALENESS_THRESHOLD() view returns (uint256)",
  "function getLatestPrice() view returns (uint256)",
  "function getConversionRate(uint256 ethAmount) view returns (uint256)",
  "function balances(address) view returns (uint256)",
  "function getDonations(uint256 index) view returns (address donor, uint256 amount)",
  // ── Escrituras ──
  "function fund(address professional) payable",
  "function withdraw(uint256 amount)",
  "function withdrawAll()",
  // ── Eventos ──
  "event Funded(address indexed donor, address indexed professional, uint256 ethAmount, uint256 usdValue)",
  "event Withdrawn(address indexed professional, uint256 amount)",
  // ── Errores propios del contrato ──
  "error DonationIndexOutOfBounds()",
  "error InsufficientAmount()",
  "error InsufficientBalance()",
  "error InvalidPrice()",
  "error NoBalanceToWithdraw()",
  "error ProfessionalIndexOutOfBounds()",
  "error ProfessionalNotPass()",
  "error StalePrice()",
  "error TransferFailed()",
  "error ZeroAmount()",
]);
