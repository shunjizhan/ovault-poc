import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';

task('send-ousdt', 'Send OUsdt tokens between chains')
  .addOptionalParam('dstNetwork', 'The destination network (sepolia or optimism-testnet)')
  .addOptionalParam('amount', 'Amount of tokens to send')
  .addOptionalParam('recipient', 'Recipient address (defaults to sender)')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    try {
      const [signer] = await hre.ethers.getSigners();
      console.log(`Connected with address: ${signer.address}`);
      console.log(`Source network: ${hre.network.name}`);

      // Define destination network options based on current network
      let dstNetworkChoices = [];
      if (hre.network.name === 'optimism-testnet') {
        dstNetworkChoices = ['sepolia'];
      } else if (hre.network.name === 'sepolia') {
        dstNetworkChoices = ['optimism-testnet'];
      } else {
        throw new Error('This task must be run on optimism-testnet or sepolia');
      }

      // If destination network not specified, prompt for it
      let dstNetwork = taskArgs.dstNetwork;
      if (!dstNetwork) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'dstNetwork',
            message: 'Select destination network:',
            choices: dstNetworkChoices,
          },
        ]);
        dstNetwork = answer.dstNetwork;
      }

      // If amount not specified, prompt for it
      let amount = taskArgs.amount;
      if (!amount) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'amount',
            message: 'Enter amount of OUSDT to send:',
            validate: function (input) {
              const num = Number(input);
              return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
            },
          },
        ]);
        amount = answer.amount;
      }

      // If recipient not specified, use sender address
      let recipient = taskArgs.recipient;
      if (!recipient) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'recipient',
            message: 'Enter recipient address (leave empty to use your address):',
            default: signer.address,
          },
        ]);
        recipient = answer.recipient;
      }

      // Get destination network's EID
      const dstNetworkConfig = hre.config.networks[dstNetwork];
      const dstEid = dstNetworkConfig.eid;
      console.log(`Destination network: ${dstNetwork} (EID: ${dstEid})`);

      // Get OUsdt contract
      const ousdtDeployment = await hre.deployments.get('OUsdt');
      const ousdt = await hre.ethers.getContractAt('OUsdt', ousdtDeployment.address, signer);
      console.log(`OUsdt address: ${ousdtDeployment.address}`);

      // Check balance
      const balance = await ousdt.balanceOf(signer.address);
      console.log(`Current balance: ${hre.ethers.utils.formatUnits(balance, 18)} OUSDT`);

      if (balance.lt(hre.ethers.utils.parseUnits(amount.toString(), 18))) {
        // Mint tokens if needed (assuming the contract has a mint function and user has permission)
        console.log(`Insufficient balance. Attempting to mint ${amount} OUSDT...`);
        const mintTx = await ousdt.mint(signer.address, hre.ethers.utils.parseUnits(amount.toString(), 18));
        await mintTx.wait();
        console.log(`Minted ${amount} OUSDT`);

        const newBalance = await ousdt.balanceOf(signer.address);
        console.log(`New balance: ${hre.ethers.utils.formatUnits(newBalance, 18)} OUSDT`);
      }

      // Create OFT options
      const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toBytes();
      const amountWei = parseEther(amount.toString());

      // Get quote for the transfer
      console.log('Getting fee quote...');
      const sendParam = {
        dstEid: dstEid,
        to: hre.ethers.utils.hexZeroPad(recipient, 32), // Convert address to bytes32
        amountLD: amountWei,
        minAmountLD: amountWei, // No slippage
        extraOptions: options,
        composeMsg: '0x', // No composed message
        oftCmd: '0x',  // No OFT command
      };

      const quotedFee = await ousdt.quoteSend(sendParam, false);
      console.log(`Fee: ${formatEther(quotedFee.nativeFee)} ETH`);

      // Confirm transaction
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Proceed with transaction?',
          default: true,
        },
      ]);

      if (!confirm) {
        console.log('Transaction cancelled.');
        return;
      }

      // Execute the transaction
      console.log(`Sending ${amount} OUSDT to ${recipient} on ${dstNetwork}...`);

      // Send the tokens
      const tx = await ousdt.send(
        sendParam,
        quotedFee,
        signer.address, // refund address
        { value: quotedFee.nativeFee }
      );

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`Check message status: https://testnet.layerzeroscan.com/tx/${receipt.transactionHash}`);

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export default {};
