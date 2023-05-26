import { ParamType } from "@ethersproject/abi";
import { ethers } from "hardhat";
import path from 'path';
import fs from 'fs';
import {FeeData } from "@ethersproject/abstract-provider";
import { IGov } from "../typechain-types";

//mainnet
// const REGISTRY_CONTRACT = "0x2e051a657014024f3e6099fbf3931f8dc14ef0f8";
//devnet
const REGISTRY_CONTRACT = "0xa68a135ccd37e720000fc30cfcc453b15f8040df";

export async function getGov() {

    const overrideProvider = new ethers.providers.JsonRpcProvider("https://api.test.wemix.com");
    overrideProvider.getFeeData = async () : Promise<FeeData> => {
        return {
            gasPrice : ethers.utils.parseUnits("101", "gwei"),
            maxFeePerGas : ethers.utils.parseUnits("101", "gwei"),
            maxPriorityFeePerGas : ethers.utils.parseUnits("100", "gwei"),
            lastBaseFeePerGas : ethers.utils.parseUnits("1", "wei"),
        };
    };

    const registry = await ethers.getContractAt("contracts/interfaces/IRegistry.sol:IRegistry", REGISTRY_CONTRACT);
    const B322S = ethers.utils.formatBytes32String;
    const gov = await ethers.getContractAt("contracts/interfaces/IGov.sol:IGov", await registry.getContractAddress(B322S("GovernanceContract"))) as IGov;

    let govMems = [];
    for (let i = 0; i < (await gov.getMemberLength()).toNumber(); i++) {
        govMems.push(await ethers.getImpersonatedSigner(await gov.getMember(i+1)));
    }

    const govStaking = await ethers.getContractAt("IGovStaking", await registry.getContractAddress(B322S("Staking")), govMems[0]);
    // const GovStakingImp = await ethers.getContractFactory("StakingImp", govMems[0]);
    // const govStakingImp = await GovStakingImp.deploy();
    // await govStakingImp.deployed();
    // await govStaking.upgradeStaking(govStakingImp.address);

    const envStorage = await ethers.getContractAt("contracts/interfaces/IEnvStorage.sol:IEnvStorage", await registry.getContractAddress(B322S("EnvStorage")));
    return { govStaking, envStorage, registry, gov, govMems};

}

// changeStaking()
//     .then(() => process.exit(0))
//     .catch((error) => {
//         console.error(error);
//         process.exit(1);
//     });

function type2Bytes(types: readonly (string | ParamType)[], inputs: readonly any[]) {
    const ABICoder = ethers.utils.AbiCoder;
    const abiCoder = new ABICoder();

    let parameters = abiCoder.encode(types, inputs);
    return parameters;
}
