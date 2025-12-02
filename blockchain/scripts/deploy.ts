import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Deploying Tournament Scores contract to Avalanche Fuji...");
  
  const rpc = process.env.AVALANCHE_RPC_URL!;
  const pk = process.env.PRIVATE_KEY!;
  
  if (!rpc || !pk) {
    throw new Error("❌ Missing environment variables: AVALANCHE_RPC_URL or PRIVATE_KEY");
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  
  console.log("📝 Deploying with account:", wallet.address);
  console.log("💰 Account balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "AVAX");

  // Load contract artifact
  const artifactPath = "./artifacts/contracts/Scores.sol/Scores.json";
  if (!fs.existsSync(artifactPath)) {
    throw new Error("❌ Contract artifact not found. Run 'npm run build' first.");
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  console.log("⏳ Deploying Scores contract...");
  const contract = await factory.deploy();
  const deployed = await contract.waitForDeployment();
  
  const contractAddress = await deployed.getAddress();
  console.log("✅ Scores deployed to:", contractAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "fuji",
    contractAddress: contractAddress,
    deployer: wallet.address,
    timestamp: new Date().toISOString(),
    blockNumber: await provider.getBlockNumber(),
    abi: artifact.abi
  };

  // Create deployments directory
  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Save deployment
  const deploymentPath = path.join(deploymentsDir, "fuji-deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to:", deploymentPath);

  // Test basic functionality
  console.log("\n🧪 Testing basic functionality...");
  try {
    const testTournamentId = ethers.keccak256(ethers.toUtf8Bytes("test-" + Date.now()));
    const testPlayers = [wallet.address, "0x742d35Cc6634C0532925a3b8D0C9abE4d4Fd9cAf"];
    
    const createTx = await deployed.createTournament(testTournamentId, "Test Tournament", testPlayers);
    await createTx.wait();
    console.log("✅ Test tournament created");
    
    const finalizeTx = await deployed.finalizeTournament(testTournamentId, [10, 8]);
    await finalizeTx.wait();
    console.log("✅ Test tournament finalized");
    
    const isValid = await deployed.verifyTournament(testTournamentId);
    console.log("✅ Tournament verification:", isValid ? "PASSED" : "FAILED");
  } catch (error) {
    console.log("⚠️ Test functionality error:", error.message);
  }

  console.log("\n🎉 Deployment completed!");
  console.log("🔗 View on Snowtrace:", `https://testnet.snowtrace.io/address/${contractAddress}`);
  console.log("\n📋 Add this to your backend .env:");
  console.log(`SCORES_CONTRACT_ADDRESS=${contractAddress}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
