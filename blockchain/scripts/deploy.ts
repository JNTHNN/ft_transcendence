import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
async function main() {
  const rpc = process.env.AVALANCHE_RPC_URL!;
  const pk = process.env.PRIVATE_KEY!;
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/Scores.sol/Scores.json","utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const c = await factory.deploy();
  const deployed = await c.waitForDeployment();
  console.log("Scores deployed at:", await deployed.getAddress());
}
main().catch((e)=>{ console.error(e); process.exit(1); });
