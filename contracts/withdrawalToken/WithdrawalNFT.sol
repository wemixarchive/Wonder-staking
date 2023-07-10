// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/INCPStaking.sol";
import "../interfaces/IWithdrawalNFT.sol";

contract WithdrawalNFT is ERC721Upgradeable, IWithdrawalNFT, OwnableUpgradeable {

    mapping(uint256 /* tokenId */ => WithdrawalRequestInfo) public withdrawalRequests;

    uint256 public totalSupply;
    uint256 public currentTokenId;
    mapping(address /* user */ => uint256[] /* user token list */) public userTokenIdList;

    address public minter;

    modifier onlyMinter() {
        require(msg.sender == minter, "WithdrawalNFT: only minter");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _minter) public initializer {
        __ERC721_init("NCP-Staking", "NST");
        __Ownable_init();
        totalSupply = 0;
        currentTokenId = 0;
        require(_minter != address(0), "WithdrawalNFT: minter is the zero address");
        minter = _minter;
    }

    function mint(address to, uint256 pid, uint256 toPid, uint256 amount, uint256 unbondTime) public onlyMinter returns(uint256) {
        totalSupply += 1;
        currentTokenId += 1;
        _mint(to, currentTokenId);
        withdrawalRequests[currentTokenId] = WithdrawalRequestInfo(currentTokenId, pid, toPid, amount, block.number, block.number + unbondTime, to);
        emit Mint(currentTokenId, pid, toPid, amount, block.number, block.number + unbondTime, to);
        return currentTokenId;
    }

    function burn(address from, uint256 tokenId) public onlyMinter {
        require(_isApprovedOrOwner(from, tokenId), "WithdrawalNFT: caller is not owner nor approved");
        require(block.number >= withdrawalRequests[tokenId].claimableTime, "WithdrawalNFT: unbond time not reached");
        _burn(tokenId);
        delete withdrawalRequests[tokenId];
        emit Burn(from, tokenId);
        totalSupply -= 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        require(batchSize == 1, "WithdrawalNFT: batch size must be 1");
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        bool flag = false;
        for(uint256 i = 0;i<userTokenIdList[from].length;i++){
            if(userTokenIdList[from][i] == firstTokenId){
                flag = true;
                for(uint256 j = i;j<userTokenIdList[from].length-1;j++){
                    userTokenIdList[from][j] = userTokenIdList[from][j+1];
                }
                userTokenIdList[from].pop();
                break;
            }
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        require(batchSize == 1, "WithdrawalNFT: batch size must be 1");
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
        userTokenIdList[to].push(firstTokenId);
    }

    function getUserTokenList(address user) public view returns(uint256[] memory){
        return userTokenIdList[user];
    }

    function getWithdrawalRequestInfo(uint256 tokenId) public view returns(WithdrawalRequestInfo memory){
        return withdrawalRequests[tokenId];
    }

    function getWithdrawableTokenList(address user) public view returns(uint256[] memory){
        uint256[] memory withdrawableTokenList = new uint256[](userTokenIdList[user].length);
        uint256 withdrawableTokenListLength = 0;
        for(uint256 i = 0;i<userTokenIdList[user].length;i++){
            if(block.number >= withdrawalRequests[userTokenIdList[user][i]].claimableTime){
                withdrawableTokenList[withdrawableTokenListLength] = userTokenIdList[user][i];
                withdrawableTokenListLength += 1;
            }
        }
        uint256[] memory withdrawableTokenListTrimmed = new uint256[](withdrawableTokenListLength);
        for(uint256 i = 0;i<withdrawableTokenListLength;i++){
            withdrawableTokenListTrimmed[i] = withdrawableTokenList[i];
        }
        return withdrawableTokenListTrimmed;
    }

    function getFirstWithdrawableToken(uint256 pid, address user) public view returns(uint256){
        for(uint256 i = 0;i<userTokenIdList[user].length;i++){
            if(withdrawalRequests[userTokenIdList[user][i]].pid == pid && block.number >= withdrawalRequests[userTokenIdList[user][i]].claimableTime){
                return userTokenIdList[user][i];
            }
        }
        revert("WithdrawalNFT: no withdrawable token found");
    }

    function getWithdrawableTokenListWithPid(uint256 pid, address user) public view returns(uint256[] memory){
        uint256[] memory withdrawableTokenList = new uint256[](userTokenIdList[user].length);
        uint256 withdrawableTokenListLength = 0;
        for(uint256 i = 0;i<userTokenIdList[user].length;i++){
            if(withdrawalRequests[userTokenIdList[user][i]].pid == pid && block.number >= withdrawalRequests[userTokenIdList[user][i]].claimableTime){
                withdrawableTokenList[withdrawableTokenListLength] = userTokenIdList[user][i];
                withdrawableTokenListLength += 1;
            }
        }
        uint256[] memory withdrawableTokenListTrimmed = new uint256[](withdrawableTokenListLength);
        for(uint256 i = 0;i<withdrawableTokenListLength;i++){
            withdrawableTokenListTrimmed[i] = withdrawableTokenList[i];
        }
        return withdrawableTokenListTrimmed;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}