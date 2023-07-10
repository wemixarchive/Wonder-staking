
import { ParamType } from "@ethersproject/abi";
import path from "path";
import fs from "fs";
import { FeeData } from "@ethersproject/abstract-provider";
import {  IGov, IGovStaking, IEnvStorage, IRegistry } from "../typechain-types";
import { LedgerSigner } from "@anders-t/ethers-ledger";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from "hardhat/types";

//mainnet
const REGISTRY_CONTRACT = "0x2e051a657014024f3e6099fbf3931f8dc14ef0f8";

const NCPSTAKING = "0x6Af09e1A3c886dd8560bf4Cabd65dB16Ea2724D8";

async function getGov(hre : HardhatRuntimeEnvironment, owner : any)
{
    const ethers = hre.ethers;
    const registry = await ethers.getContractAt("contracts/interfaces/IRegistry.sol:IRegistry", REGISTRY_CONTRACT);
    const B322S = ethers.utils.formatBytes32String;
    const gov = (await ethers.getContractAt("contracts/interfaces/IGov.sol:IGov", await registry.getContractAddress(B322S("GovernanceContract")))) as IGov;

    let govMems = [];
    for (let i = 0; i < (await gov.getMemberLength()).toNumber(); i++) {
        let govMemAddr = await gov.getMember(i + 1);
        govMems.push({ address: govMemAddr });
    }

    const govStaking = await ethers.getContractAt("IGovStaking", await registry.getContractAddress(B322S("Staking")), owner) as IGovStaking;

    const envStorage = await ethers.getContractAt("contracts/interfaces/IEnvStorage.sol:IEnvStorage", await registry.getContractAddress(B322S("EnvStorage")));
    return { govStaking, envStorage, registry, gov, govMems };
}

export async function compoundNCP(hre : HardhatRuntimeEnvironment, networkType : number, ncpIdx : number) {
    let rpc;
    if (networkType == 0) {
        rpc = "http://127.0.0.1:8545";
    }
    else if(networkType == 1) {
        rpc = "https://api.test.wemix.com";
    }
    else if(networkType == 2) {
        rpc =  "https://api.wemix.com";
    }
    const ethers = hre.ethers
    let overrideProvider = new ethers.providers.JsonRpcProvider(rpc);
    let owner;
    if(networkType == 0){
        console.log(rpc, ncpIdx);
        const registry = await ethers.getContractAt("contracts/interfaces/IRegistry.sol:IRegistry", REGISTRY_CONTRACT);
        const B322S = ethers.utils.formatBytes32String;
        const gov = (await ethers.getContractAt("contracts/interfaces/IGov.sol:IGov", await registry.getContractAddress(B322S("GovernanceContract")))) as IGov;
        owner = await ethers.getImpersonatedSigner(await gov.getMemberFromNodeIdx(ncpIdx));
    }
    else{
        overrideProvider.getFeeData = async () : Promise<FeeData> => {
            return {
                gasPrice : ethers.utils.parseUnits("101", "gwei"),
                maxFeePerGas : ethers.utils.parseUnits("101", "gwei"),
                maxPriorityFeePerGas : ethers.utils.parseUnits("100", "gwei"),
                lastBaseFeePerGas : ethers.utils.parseUnits("1", "wei"),
            };
        };
        owner = new LedgerSigner(overrideProvider, `m/44'/60'/0'/0/0`);
    }
    const ownerAddress = await owner.getAddress();
    console.log("Ledger : ",ownerAddress);
    const { govStaking, envStorage, registry, gov, govMems } = await getGov(hre, owner);
    const ncpStaking = await ethers.getContractAt("NCPStaking", NCPSTAKING, owner);
    const ncpId = await gov.getNodeIdxFromMember(ownerAddress);

    const pendingReward = await ncpStaking.pendingReward(ncpId, ownerAddress, {blockTag : 21697462});
    console.log("pending reward : ", ethers.utils.formatEther(pendingReward));
    const beforeBalance = await ethers.provider.getBalance(ownerAddress, 21697462);
    const depositAmount = ethers.utils.parseEther("100000");
    await govStaking.deposit({ value: depositAmount.sub(pendingReward) });
    const afterBalance = await ethers.provider.getBalance(ownerAddress);
    console.log("before + pending - depositAmount : ",beforeBalance.add(pendingReward).sub(depositAmount).toString(), afterBalance.toString(), afterBalance.eq(beforeBalance.add(pendingReward).sub(depositAmount)));
    console.log("current deposit Amount : ", depositAmount.sub(pendingReward).toString());

    const beforeLockedBalance = await govStaking.lockedBalanceOf(ownerAddress);
    await govStaking.lockMore(depositAmount.sub(pendingReward));
    const afterLockedBalance = await govStaking.lockedBalanceOf(ownerAddress);
    console.log("lock more : ", ethers.utils.formatEther(afterLockedBalance.sub(beforeLockedBalance)));
    console.log(await ncpStaking.getUserInfo(ncpId, ownerAddress));


    
}


export async function claimNCP(hre : HardhatRuntimeEnvironment, networkType : number, ncpIdx : number) {
    let rpc;
    if (networkType == 0) {
        rpc = "http://127.0.0.1:8545";
    }
    else if(networkType == 1) {
        rpc = "https://api.test.wemix.com";
    }
    else if(networkType == 2) {
        rpc =  "https://api.wemix.com";
    }
    const ethers = hre.ethers
    let overrideProvider = new ethers.providers.JsonRpcProvider(rpc);
    let owner;
    if(networkType == 0){
        console.log(rpc, ncpIdx);
        const registry = await ethers.getContractAt("contracts/interfaces/IRegistry.sol:IRegistry", REGISTRY_CONTRACT);
        const B322S = ethers.utils.formatBytes32String;
        const gov = (await ethers.getContractAt("contracts/interfaces/IGov.sol:IGov", await registry.getContractAddress(B322S("GovernanceContract")))) as IGov;
        owner = await ethers.getImpersonatedSigner(await gov.getMemberFromNodeIdx(ncpIdx));
    }
    else{
        overrideProvider.getFeeData = async () : Promise<FeeData> => {
            return {
                gasPrice : ethers.utils.parseUnits("101", "gwei"),
                maxFeePerGas : ethers.utils.parseUnits("101", "gwei"),
                maxPriorityFeePerGas : ethers.utils.parseUnits("100", "gwei"),
                lastBaseFeePerGas : ethers.utils.parseUnits("1", "wei"),
            };
        };
        owner = new LedgerSigner(overrideProvider, `m/44'/60'/0'/0/0`);
    }
    const ownerAddress = await owner.getAddress();
    console.log("Ledger : ",ownerAddress);
    const { govStaking, envStorage, registry, gov, govMems } = await getGov(hre, owner);
    const ncpStaking = await ethers.getContractAt("NCPStaking", NCPSTAKING, owner);
    const ncpId = await gov.getNodeIdxFromMember(ownerAddress);
    let tx = await ncpStaking.claim(ncpId, ownerAddress)
    let txr = await tx.wait();
    let fee = txr.gasUsed.mul(txr.effectiveGasPrice)
    let bn = txr.blockNumber;
    console.log("fee : ", ethers.utils.formatEther(fee), "bn : ", bn);
    const pendingReward = await ncpStaking.pendingReward(ncpId, ownerAddress, {blockTag : bn -1});
    const beforeBalance = await ethers.provider.getBalance(ownerAddress, bn -1);
    const afterBalance = await ethers.provider.getBalance(ownerAddress);
    console.log("get reward : ", ethers.utils.formatEther(afterBalance.sub(beforeBalance).add(fee)), ethers.utils.formatEther(pendingReward), pendingReward.eq(afterBalance.sub(beforeBalance).add(fee)));
    
}