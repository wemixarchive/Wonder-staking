import { ParamType } from "@ethersproject/abi";
import { ethers } from "hardhat";
import { IGov } from "../typechain-types";

//mainnet
// const REGISTRY_CONTRACT = "0x2e051a657014024f3e6099fbf3931f8dc14ef0f8";
//devnet
const REGISTRY_CONTRACT = "0xa68a135ccd37e720000fc30cfcc453b15f8040df";

export async function changeStaking() {
    const registry = await ethers.getContractAt("contracts/interfaces/IRegistry.sol:IRegistry", REGISTRY_CONTRACT);
    const B322S = ethers.utils.formatBytes32String;
    const U2B = ethers.utils.toUtf8Bytes;
    const gov = await ethers.getContractAt("contracts/interfaces/IGov.sol:IGov", await registry.getContractAddress(B322S("GovernanceContract"))) as IGov;

    let govMems = [];
    for (let i = 0; i < (await gov.getMemberLength()).toNumber(); i++) {
        govMems.push(await ethers.getImpersonatedSigner(await gov.getMember(i + 1)));
    }

    const govStaking = await ethers.getContractAt("IGovStaking", await registry.getContractAddress(B322S("Staking")), govMems[0]);

    const StakingImp = await ethers.getContractFactory("StakingImp");
    const stakingImp = await StakingImp.deploy();
    await stakingImp.deployed();

    const beforeStakingImp = await govStaking.implementation();
    await govStaking.upgradeStaking(stakingImp.address);
    const afterStakingImp = await govStaking.implementation();
    console.log(`${beforeStakingImp} -> ${afterStakingImp}`);

    const envStorage = await ethers.getContractAt("contracts/interfaces/IEnvStorage.sol:IEnvStorage", await registry.getContractAddress(B322S("EnvStorage")));

    let stakingMinMax = await envStorage.getStakingMinMax();
    let newStakingMax = ethers.constants.MaxUint256;
    let tx = await gov
        .connect(govMems[0])
        .addProposalToChangeEnv(
            ethers.utils.keccak256(U2B("stakingMinMax")),
            2,
            type2Bytes(["uint256", "uint256"], [stakingMinMax[0], newStakingMax]),
            U2B("change staking min max"),
            86400
        );
    await tx.wait();

    let ballotLen = await gov.ballotLength();
    for (let i = 0; i < govMems.length; i++) {
        await gov.connect(govMems[i]).vote(ballotLen, true);
        let inVoting = (await gov.getBallotInVoting()).toNumber();
        if(inVoting == 0) break;
    }
    // let afterStakingMinMax = await envStorage.getStakingMinMax();
    // console.log(`${stakingMinMax[0]} -> ${afterStakingMinMax[0]}`);
    // console.log(`${stakingMinMax[1]} -> ${afterStakingMinMax[1]}`);
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
