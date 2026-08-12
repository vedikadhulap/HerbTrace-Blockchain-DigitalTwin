async function main() {
    const HerbTrace = await ethers.getContractFactory("HerbTrace");

    console.log("Deploying contract...");

    const herbTrace = await HerbTrace.deploy();

    await herbTrace.waitForDeployment();

    console.log(
        "✅ Contract deployed to:",
        await herbTrace.getAddress()
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});