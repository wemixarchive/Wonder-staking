import { ParamType } from "@ethersproject/abi";
import { ethers } from "hardhat";
import path from "path";
import fs from "fs";
import { FeeData } from "@ethersproject/abstract-provider";
import { IGov } from "../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

//mainnet
const REGISTRY_CONTRACT = "0x2e051a657014024f3e6099fbf3931f8dc14ef0f8";

const NCPSTAKING = "0x6Af09e1A3c886dd8560bf4Cabd65dB16Ea2724D8";

async function getGov() {
    const registry = await ethers.getContractAt("contracts/interfaces/IRegistry.sol:IRegistry", REGISTRY_CONTRACT);
    const B322S = ethers.utils.formatBytes32String;
    const gov = (await ethers.getContractAt("contracts/interfaces/IGov.sol:IGov", await registry.getContractAddress(B322S("GovernanceContract")))) as IGov;

    const govStaking = await ethers.getContractAt("IGovStaking", await registry.getContractAddress(B322S("Staking")));

    const envStorage = await ethers.getContractAt("contracts/interfaces/IEnvStorage.sol:IEnvStorage", await registry.getContractAddress(B322S("EnvStorage")));
    return { govStaking, envStorage, registry, gov };
}


async function checkBalance(fromBlock: number, toBlock: number, pid : number) {
    const ncpStaking = await ethers.getContractAt("NCPStaking", NCPSTAKING);
    let DepositEvents = await ncpStaking.queryFilter(ncpStaking.filters.Deposit(null, pid, null, null, null), fromBlock, "latest");

    let checkUser: any = {};
    let users = [];
    // console.log(DepositEvents)
    for (const idx in DepositEvents) {
        const event = DepositEvents[idx].args;
        if (checkUser[event.user] == undefined) {
            const userInfo = await ncpStaking.getUserInfo(pid, event.user);
            if (userInfo.amount.gt(0)) {
                users.push(event.user);
                checkUser[event.user] = true;
            }
        }
        if (checkUser[event.to] == undefined) {
            const userInfo = await ncpStaking.getUserInfo(pid, event.to);
            if (userInfo.amount.gt(0)) {
                users.push(event.to);
                checkUser[event.to] = true;
            }
        }
    }

    let sum = ethers.BigNumber.from(0);
    users.push();
    for (let user of users) {
        const userInfo = await ncpStaking.getUserInfo(pid, user);
        const amount = userInfo.amount;
        sum = sum.add(amount);
        console.log(user.toString(), amount.toString());
    }
    let poolInfo = await ncpStaking.getPoolInfo(pid);
    let ncpInfo = await ncpStaking.getUserInfo(pid, poolInfo.ncp);
    sum = sum.add(ncpInfo.amount);
    users.push(poolInfo.ncp);
    console.log(poolInfo.ncp.toString(), ncpInfo.amount.toString());
    console.log("total user count : ", users.length);
    console.log(sum.div(ethers.utils.parseEther("1")).toString());

    console.log("pool total user : ", poolInfo.totalDepositors.toString());
    console.log(poolInfo.totalDeposit.div(ethers.utils.parseEther("1")).toString());
    if (sum.eq(poolInfo.totalDeposit)) {
        console.log("same");
    } else {
        console.log("not same");
        return;
    }

    pid = 40;
    DepositEvents = await ncpStaking.queryFilter(ncpStaking.filters.Deposit(null, pid, null, null, null), fromBlock, "latest");

    checkUser = {};
    users = [];
    for (const idx in DepositEvents) {
        const event = DepositEvents[idx].args;
        if (checkUser[event.user] == undefined) {
            const userInfo = await ncpStaking.getUserInfo(pid, event.user);
            if (userInfo.amount.gt(0)) {
                users.push(event.user);
                checkUser[event.user] = true;
            }
        }
        if (checkUser[event.to] == undefined) {
            const userInfo = await ncpStaking.getUserInfo(pid, event.to);
            if (userInfo.amount.gt(0)) {
                users.push(event.to);
                checkUser[event.to] = true;
            }
        }
    }

    sum = ethers.BigNumber.from(0);
    users.push();
    for (let user of users) {
        const userInfo = await ncpStaking.getUserInfo(pid, user);
        const amount = userInfo.amount;
        sum = sum.add(amount);
        console.log(user.toString(), amount.toString());
    }
    poolInfo = await ncpStaking.getPoolInfo(pid);
    ncpInfo = await ncpStaking.getUserInfo(pid, poolInfo.ncp);
    sum = sum.add(ncpInfo.amount);
    users.push(poolInfo.ncp);
    console.log(poolInfo.ncp.toString(), ncpInfo.amount.toString());
    console.log("total user count : ", users.length);
    console.log(sum.div(ethers.utils.parseEther("1")).toString());

    console.log("pool total user : ", poolInfo.totalDepositors.toString());
    console.log(poolInfo.totalDeposit.div(ethers.utils.parseEther("1")).toString());
    if (sum.eq(poolInfo.totalDeposit)) {
        console.log("same");
    } else {
        console.log("not same");
        return;
    }

}

export async function checkNCPBalanceByBlockNumber(hre : HardhatRuntimeEnvironment, blockNumber: number | undefined, pid : number) {
    const { govStaking, envStorage, registry, gov } = await getGov();
    const ncpStaking = await hre.ethers.getContractAt("NCPStaking", NCPSTAKING, );
    const ncpInfo = await ncpStaking.getPoolInfo(pid, {blockTag: blockNumber});
    console.log("Total deposit : ", hre.ethers.utils.formatEther(ncpInfo.totalDeposit));
    const ncpDirectDeposit = await ncpStaking.getUserInfo(pid, ncpInfo.ncp, {blockTag: blockNumber});
    console.log("NCP direct deposit : ", hre.ethers.utils.formatEther(ncpDirectDeposit.amount));
    const userDeposit = await govStaking.userTotalBalanceOf(ncpInfo.ncp, {blockTag: blockNumber});
    console.log("NCP user deposit : ", hre.ethers.utils.formatEther(userDeposit));
}

export async function checkWithdrawBalanceByBlockNumber(hre : HardhatRuntimeEnvironment, blockNumber : number | undefined, pid : number){
    const ncpStaking = await hre.ethers.getContractAt("NCPStaking", NCPSTAKING, );
    const ncpInfo = await ncpStaking.getPoolInfo(pid, {blockTag: blockNumber});
    console.log("Total withdrawal requested balance : ", hre.ethers.utils.formatEther(ncpInfo.totalRequestedWithdrawal));
}

export async function checkRewardBalanceByBlockNumber(hre : HardhatRuntimeEnvironment, blockNumber : number | undefined, pid : number){
    const ncpStaking = await hre.ethers.getContractAt("NCPStaking", NCPSTAKING, );
    const ncpInfo = await ncpStaking.getPoolInfo(pid, {blockTag: blockNumber});
    const rewarder = await ncpStaking.getRewarder(pid, {blockTag: blockNumber});
    const totalReward = await hre.ethers.provider.getBalance(rewarder, blockNumber);
    console.log("Total reward : ", hre.ethers.utils.formatEther(totalReward));
    const pendingRewardNCP = await ncpStaking.pendingReward(pid, ncpInfo.ncp, {blockTag: blockNumber});
    console.log("NCP reward : ", hre.ethers.utils.formatEther(pendingRewardNCP));
    const pendingRewardUser = totalReward.sub(pendingRewardNCP);
    console.log("User reward : ", hre.ethers.utils.formatEther(pendingRewardUser));
}

export async function checkGainRewardByBlockNumber(hre : HardhatRuntimeEnvironment, blockNumber : number, pid : number){
    const ncpStaking = await hre.ethers.getContractAt("NCPStaking", NCPSTAKING, );
    const ncpInfo = await ncpStaking.getPoolInfo(pid, {blockTag: blockNumber-1});
    const ncpncpInfo = await ncpStaking.getUserInfo(pid, ncpInfo.ncp, {blockTag: blockNumber-1});
    const rewarder = await ncpStaking.getRewarder(pid, {blockTag: blockNumber-1});
    const totalReward = await hre.ethers.provider.getBalance(rewarder, blockNumber -1);

    const pendingReward = await ncpStaking.pendingReward(pid, ncpInfo.ncp, {blockTag: blockNumber-1});

    const harvestEvents = await ncpStaking.queryFilter(ncpStaking.filters.Harvest(null, pid, null), blockNumber, blockNumber);
    let sum = ethers.BigNumber.from(0);
    let ncpSum = ethers.BigNumber.from(0);
    for (let event of harvestEvents) {
        const reward = event.args.amount;
        sum = sum.add(reward);
        if (event.args.user == ncpInfo.ncp) {
            ncpSum = ncpSum.add(reward);
        }
    }

    const afterncpInfo = await ncpStaking.getPoolInfo(pid, {blockTag: blockNumber});

    const afterncpncpInfo = await ncpStaking.getUserInfo(pid, ncpInfo.ncp, {blockTag: blockNumber});
    const afterpendingReward = await ncpStaking.pendingReward(pid, ncpInfo.ncp, {blockTag: blockNumber});

    const afterrewarder = await ncpStaking.getRewarder(pid, {blockTag: blockNumber});
    if(rewarder != afterrewarder){
        console.log("rewarder changed");
        return;
    }
    const aftertotalReward = await hre.ethers.provider.getBalance(rewarder, blockNumber);
    
    const gainedReward = aftertotalReward.add(sum).sub(totalReward);
    console.log("Total reward :\t", hre.ethers.utils.formatEther(gainedReward));
    let ncpReward = afterpendingReward.add(ncpSum).sub(pendingReward);
    if(ncpReward.eq(0)){
        const afterAfterpendingReward = await ncpStaking.pendingReward(pid, ncpInfo.ncp, {blockTag: blockNumber+1});
        ncpReward = (afterAfterpendingReward.add(ncpSum).sub(afterpendingReward)).div(2);
    }

    const beforeBeforependingReward = await ncpStaking.pendingReward(pid, ncpInfo.ncp, {blockTag: blockNumber-2});
    if(beforeBeforependingReward.eq(pendingReward)){
        ncpReward = ncpReward.div(2);
    }

    console.log("ncp reward :\t", ethers.utils.formatEther(ncpReward), "\t");
    console.log("user reward :\t", ethers.utils.formatEther(gainedReward.sub(ncpReward)));
}