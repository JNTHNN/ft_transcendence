import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Déploiement du contrat MatchStats...");

  // Récupérer le signataire (wallet)
  const [deployer] = await ethers.getSigners();
  console.log("📝 Déployé par:", deployer.address);
  
  if (deployer.provider) {
    console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));
  }

  // Compiler et déployer
  const MatchStatsFactory = await ethers.getContractFactory("MatchStats");
  console.log("⏳ Déploiement en cours...");
  
  const matchStats = await MatchStatsFactory.deploy();
  await matchStats.waitForDeployment();

  const contractAddress = await matchStats.getAddress();
  console.log("✅ MatchStats déployé à l'adresse:", contractAddress);

  // Sauvegarder les infos de déploiement
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "fuji",
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    transactionHash: matchStats.deploymentTransaction()?.hash,
    blockNumber: await deployer.provider.getBlockNumber()
  };

  // Sauvegarder dans un fichier JSON
  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '../deployments');
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'fuji-matchstats-deployment.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("💾 Informations de déploiement sauvegardées");
  console.log("🔗 Voir sur Snowtrace:", `https://testnet.snowtrace.io/address/${contractAddress}`);

  // Test basique
  console.log("\n🧪 Test rapide...");
  try {
    const totalMatches = await matchStats.getTotalMatches();
    console.log("✅ Contrat fonctionnel - Total matches:", totalMatches.toString());
  } catch (error) {
    console.warn("⚠️ Erreur de test:", error);
  }
}

main().catch((error) => {
  console.error("❌ Erreur de déploiement:", error);
  process.exitCode = 1;
});