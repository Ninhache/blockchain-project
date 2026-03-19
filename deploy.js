#!/usr/bin/env node
/**
 * deploy.js — deploys OxAds.sol directly to Ganache, no Remix, no MetaMask
 * Usage: node deploy.js
 */

const fs   = require('fs');
const path = require('path');
const solc = require('solc');
const { Web3 } = require('web3');

const RPC      = 'http://127.0.0.1:8545';
const SOL_PATH = path.join(__dirname, 'contracts/OxAds.sol');
// Ganache deterministic account #0
const DEPLOYER_KEY = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';

async function main() {
  const source = fs.readFileSync(SOL_PATH, 'utf8');

  // ── Compile ──────────────────────────────────────────────────────────────
  console.log('Compiling OxAds.sol...');
  const input = {
    language: 'Solidity',
    sources: { 'OxAds.sol': { content: source } },
    settings: {
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors?.some(e => e.severity === 'error')) {
    console.error('Compilation errors:');
    output.errors.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }

  const contract  = output.contracts['OxAds.sol']['OxAds'];
  const abi       = contract.abi;
  const bytecode  = '0x' + contract.evm.bytecode.object;
  console.log(`Bytecode size: ${bytecode.length / 2 - 1} bytes`);

  // ── Connect + wait for Ganache ────────────────────────────────────────────
  console.log('Connecting to Ganache at', RPC);
  const web3 = new Web3(RPC);
  for (let i = 0; i < 20; i++) {
    try { await web3.eth.getBlockNumber(); break; }
    catch { process.stdout.write(i === 0 ? 'Waiting for Ganache.' : '.'); await new Promise(r => setTimeout(r, 1000)); }
    if (i === 19) { console.error('\nGanache not reachable'); process.exit(1); }
  }
  console.log('');

  // ── Deploy ───────────────────────────────────────────────────────────────
  const account = web3.eth.accounts.privateKeyToAccount(DEPLOYER_KEY);
  web3.eth.accounts.wallet.add(account);

  console.log('Deploying from', account.address);
  const txContract = new web3.eth.Contract(abi);
  const deploy     = txContract.deploy({ data: bytecode });
  const gas        = await deploy.estimateGas();

  console.log(`Estimated gas: ${gas}`);
  const deployed = await deploy.send({ from: account.address, gas: Math.ceil(Number(gas) * 1.2) });

  const address = deployed.options.address;
  console.log('\n✅ Deployed at:', address);

  // ── Auto-patch frontend files ─────────────────────────────────────────────
  const files = ['frontend/dashboard.html', 'frontend/ox-ads.js'];
  for (const f of files) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) continue;
    const before = fs.readFileSync(p, 'utf8');
    // Only replace CONTRACT_ADDRESS lines
    const after = before.replace(
      /(CONTRACT_ADDRESS\s*=\s*['"])[^'"]+(['"]);?/g,
      `$1${address}$2`
    );
    if (before !== after) {
      fs.writeFileSync(p, after);
      console.log(`  Patched ${f}`);
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
