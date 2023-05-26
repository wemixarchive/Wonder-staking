// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

interface IRewarder {
    function onReward(
        address payable to,
        uint256 amount,
        address payable feeCollector,
        uint256 fee,
        address payable platform,
        uint256 platformFee
    ) external returns(uint256);
    function update() external returns(uint256);
    function getLastReward() external view returns(uint256);
    function checkRewarder(address _rewarder) external view returns (uint256);

    function checkOwner(address _owner) external view returns (bool);
    event LogOnReward(address to, uint256 amount, address feeCollector, uint256 fee, address platform, uint256 platformFee);
}
