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
    const rpc = "https://api.test.wemix.com";
    const overrideProvider = new ethers.providers.JsonRpcProvider(rpc);
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
    const gov = (await ethers.getContractAt("contracts/interfaces/IGov.sol:IGov", await registry.getContractAddress(B322S("GovernanceContract")))) as IGov;

    let govMems = [];
    for (let i = 0; i < (await gov.getMemberLength()).toNumber(); i++) {
        let ww = fs.readFileSync(path.join(__dirname, '../keystore/acct.'+(i+1).toString().padStart(2, "0"))).toString();
        govMems.push((await ethers.Wallet.fromEncryptedJson(ww, 'password')).connect(overrideProvider));
    }

    const govStaking = await ethers.getContractAt("IGovStaking", await registry.getContractAddress(B322S("Staking")), govMems[0]);

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
