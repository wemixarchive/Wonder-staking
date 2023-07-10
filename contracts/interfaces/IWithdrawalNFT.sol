// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

interface IWithdrawalNFT is IERC721Upgradeable {
    /**
     * @notice Info of users withdraw info.
     * `amount` The amount of withdrawal request.
     * `requestTime` The time the withdrawal request came in.
     * `claimableTime` The time of claimable withdrawal.
     */
    struct WithdrawalRequestInfo {
        uint256 tokenid;
        uint256 pid;
        uint256 toPid;
        uint256 amount;
        uint256 requestTime;
        uint256 claimableTime;
        address drawer;
    }

    function mint(
        address to,
        uint256 pid,
        uint256 toPid,
        uint256 amount,
        uint256 unbondTime
    ) external returns (uint256);

    function burn(address from, uint256 tokenId) external;

    function getUserTokenList(
        address user
    ) external view returns (uint256[] memory);

    function getWithdrawalRequestInfo(
        uint256 tokenId
    ) external view returns (WithdrawalRequestInfo memory);

    function getWithdrawableTokenList(
        address user
    ) external view returns (uint256[] memory);

    function getFirstWithdrawableToken(uint256 pid, address user) external view returns(uint256);
    function getWithdrawableTokenListWithPid(uint256 pid, address user) external view returns(uint256[] memory);

    event Mint(uint256 tokenId, uint256 pid, uint256 toPid, uint256 amount, uint256 mintTime, uint256 unbondTime, address drawer);
    event Burn(address from, uint256 tokenId);
}
