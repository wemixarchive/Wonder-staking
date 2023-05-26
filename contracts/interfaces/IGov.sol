// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGov {
    function isVoter(address addr) external view returns (bool);

    function isStaker(address addr) external view returns (bool);

    function isMember(address) external view returns (bool);

    function getMember(uint256) external view returns (address);

    function getMemberLength() external view returns (uint256);

    function getReward(uint256) external view returns (address);

    function getNodeIdxFromMember(address) external view returns (uint256);

    function getMemberFromNodeIdx(uint256) external view returns (address);

    function getNodeLength() external view returns (uint256);

    function getNode(
        uint256
    ) external view returns (bytes memory, bytes memory, bytes memory, uint);

    function getBallotInVoting() external view returns (uint256);

    function getVoter(uint256 idx) external view returns (address);

    function ballotLength() external view returns (uint256);

    function vote(uint256 ballotIdx, bool vote) external;

    function addProposalToChangeEnv(
        bytes32 envName,
        uint256 envType,
        bytes memory envVal,
        bytes memory memo,
        uint256 duration
    ) external returns (uint256 ballotIdx);
    function getMinStaking() external view returns (uint256);
    function getMaxStaking() external view returns (uint256);
    function reInitV3(address[] memory newRewards) external;
}
