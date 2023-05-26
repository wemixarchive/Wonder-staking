// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IWeswapGateway {
    function getWemixPrice() external view returns (uint256 price);

    function getTokenPrice(address[] memory path)
        external
        view
        returns (uint256 price);

    function getPriceImpactIn(uint256 amountIn, address[] memory path)
        external
        view
        returns (uint256 priceImpact);

    function getPriceImpactOut(uint256 amountOut, address[] memory path)
        external
        view
        returns (uint256 priceImpact);

    function poolDepositInfo(
        address token0,
        address token1,
        uint256 inputAmount0,
        uint256 inputAmount1,
        bool zap
    )
        external
        view
        returns (
            uint256 depositAmount0,
            uint256 depositAmount1,
            uint256 percent0,
            uint256 percent1,
            uint256 swapFee,
            address swapFromAddrees,
            uint256 recvLPTokenAmount,
            uint256 poolShareRatio
        );

    function poolWithdrawInfo(
        address token0,
        address token1,
        uint256 amountInLP,
        address singleAddress
    )
        external
        view
        returns (
            uint256 recvTokenBalance0,
            uint256 recvTokenBalance1,
            uint256 swapFee,
            uint256 totalSupplyLP
        );

    function getAllPairs() external view returns (address[] memory);

    function userInfoAll(address user) external view returns (int256 value);

    struct UserValueInfo {
        int256 value0;
        int256 value1;
        uint256 when;
    }

    function userInfoEach(address user)
        external
        view
        returns (UserValueInfo[] memory userValueInfos);
}
