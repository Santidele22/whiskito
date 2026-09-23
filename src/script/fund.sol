// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract Fund {
    AggregatorV3Interface internal immutable priceFeed;
    uint8 internal immutable priceFeedDecimals;

    // 0.01 USD con 18 decimales. Antes eran 0.5 USD: con el precio real de POL (≈ $0,10)
    // ese piso equivalía a ~5 POL, y el faucet de Amoy da 0,5–1 POL, así que la demo
    // quedaba inusable. Con el piso nuevo, el mínimo es ~0,1 POL.
    uint256 public constant MINIMUM_USD = 1 * 1e16;
    uint256 public constant STALENESS_THRESHOLD = 3 hours; // margen de tolerancia

    //Struct
    struct Donation {
        address donor;
        uint256 amount;
        uint256 usdValue;
    }

    // Errores custom
    error StalePrice();
    error InvalidPrice();
    error InsufficientAmount();
    error ZeroAmount();
    error DonationIndexOutOfBounds();
    error ProfessionalIndexOutOfBounds();
    error ProfessionalNotPass();
    error InsufficientBalance();
    error TransferFailed();
    error NoBalanceToWithdraw();

    //MAPINGS
    //Mapeo la address(wallet) con el amount que dona.
    mapping(address => uint256) internal donation;
    // Mapeo la address para obtener el balance del profesional
    mapping(address => uint256) public balances;

    //Arrays
    Donation[] internal donations;

    //EVENTS
    event Funded(address indexed donor, address indexed professional, uint256 ethAmount, uint256 usdValue);
    event Withdrawn(address indexed professional, uint256 amount);

    constructor(address _priceFeedAddress) {
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        //Se deja en el constructor como una variable inmutable para ahorro de gas
        priceFeedDecimals = priceFeed.decimals();
    }

    function getLatestPrice() public view returns (uint256) {
        (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
        if (price <= 0) revert InvalidPrice();
        if (updatedAt == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > STALENESS_THRESHOLD) {
            revert StalePrice();
        }

        return uint256(price);
    }

    function getConversionRate(uint256 ethAmount) public view returns (uint256) {
        uint256 ethPrice = getLatestPrice();
        uint8 feedDecimals = priceFeedDecimals;

        // Escalado dinámico
        uint256 scaleFactor = 10 ** (18 - feedDecimals);
        uint256 ethPriceScaled = ethPrice * scaleFactor;
        // Devuelve el precio en usdc
        return (ethPriceScaled * ethAmount) / 1e18;
    }

    function _fund(address donor, uint256 usdValue, address professional) private {
        if (usdValue < MINIMUM_USD) revert InsufficientAmount();
        //Monto donado
        donation[donor] += msg.value;
        balances[professional] += msg.value;
        emit Funded(donor, professional, msg.value, usdValue);
        donations.push(Donation(donor, msg.value, usdValue));
        //Hay asignar lo donado a un profesional
    }

    function fund(address professional) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (professional == address(0)) revert ProfessionalNotPass();
        uint256 usdValue = getConversionRate(msg.value);
        _fund(msg.sender, usdValue, professional);
    }

    function getDonations(uint256 index) external view returns (address donor, uint256 amount) {
        if (index >= donations.length) revert DonationIndexOutOfBounds();
        Donation memory d = donations[index];
        return (d.donor, d.amount);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 currentBalance = balances[msg.sender];
        if (amount > currentBalance) revert InsufficientBalance();

        // Se descuenta ANTES de mandar el ETH, así una reentrada ve el balance ya actualizado
        balances[msg.sender] = currentBalance - amount;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    function withdrawAll() external {
        uint256 currentBalance = balances[msg.sender];
        if (currentBalance == 0) revert NoBalanceToWithdraw();

        balances[msg.sender] = 0;

        (bool success,) = payable(msg.sender).call{value: currentBalance}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, currentBalance);
    }
}
